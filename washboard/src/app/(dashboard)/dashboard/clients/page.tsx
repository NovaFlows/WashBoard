import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsView from '@/components/dashboard/ClientsView'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import type { ClientBooking, ClientDocument, ClientReglages } from '@/lib/clientProfile'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import type { ReglagesRelance } from '@/lib/clientsARelancer'
import type { ContactEntreprise, EntrepriseListItem } from '@/lib/entrepriseProfile'

// Fichier clients : tiré des réservations, un client par email (voir
// lib/listeClients.ts). Seules les colonnes utiles à la liste et à la fiche
// partent vers le navigateur — ni notes internes, ni contenu des factures.
//
// `created_at` et `followup_sent_at` s'ajoutent depuis le 2026-09-28 : c'est ce qu'il faut pour
// reproduire la décision du cron de relance (`lib/clientsARelancer.ts`, onglet « À relancer »).
// `review_request_sent_at` sert à la timeline mélangée de la fiche (`lib/clientTimeline.ts`).
// `vehicles_detail` s'ajoute le même jour : le modèle que le client tape lui-même en réservant
// (`StepService.tsx`), repris dans la fiche plutôt que redemandé au laveur (`clientProfile.ts`,
// `vehiculesReserves`).
const COLONNES = 'id, client_name, client_email, client_phone, address, scheduled_at, created_at, status, closed_late, booked_price, is_professional, company_name, followup_sent_at, review_request_sent_at, vehicles_detail, services(name, price, duration_minutes)'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'clients')

  // Page par page : l'API coupe à 1 000 lignes sans erreur (voir `toutesLesLignes`).
  const { data: bookings, error } = await toutesLesLignes(
    (debut, fin) => supabase
      .from('bookings')
      .select(COLONNES)
      .eq('washer_id', washer.id)
      .order('scheduled_at', { ascending: false })
      .order('id')
      .range(debut, fin),
  )
  // Sans trace, un fichier vide ne se distinguerait pas d'un laveur sans client.
  if (error) logger.error('clients.bookings.fetch_failed', { washerId: washer.id }, error)

  // Les devis et factures écrits à la main font naître des clients qui n'ont jamais réservé
  // (Alexandre, 2026-09-27). La RLS limite déjà la lecture à ce laveur ; le filtre explicite
  // est là pour que la requête reste juste si la policy change un jour.
  const { data: documents, error: errDocuments } = await supabase
    .from('documents')
    .select('id, genre, numero, statut, emis_le, created_at, contenu, paye_le')
    .eq('washer_id', washer.id)
    .order('created_at', { ascending: false })
    .limit(500)
  // Sans eux la liste reste celle des réservations : dégradée, pas cassée.
  if (errDocuments) logger.warn('clients.documents.fetch_failed', { washerId: washer.id }, errDocuments)

  // Réglages écrits à la main (table `clients`, SQL du 2026-09-28) : « ne plus contacter », le
  // rattachement à une entreprise, « masque_le » (glisser pour supprimer), et les notes et
  // véhicules du client. UNE lecture pour tout (même table, même filtre) — inutile de la faire
  // cinq fois. Absente de la base tant que le SQL n'a pas été exécuté : une erreur ici dégrade
  // la liste (personne ne paraît opposé, rattaché ni masqué, aucune note ni véhicule), elle ne
  // la casse pas.
  const { data: lignesClients, error: errClients } = await supabase
    .from('clients')
    .select('cle, ne_plus_contacter, entreprise_id, role_entreprise, masque_le, notes, vehicules, nom, telephone')
    .eq('washer_id', washer.id)
  if (errClients) logger.warn('clients.reglages.fetch_failed', { washerId: washer.id }, errClients)

  // Entreprises (fiche entreprise, 2026-09-28) : leurs sites, et leurs contacts tirés de
  // `lignesClients` ci-dessus (un contact EST un client `entreprise_id` renseigné — voir
  // `lib/entrepriseProfile.ts`). Aucune agrégation ici : le chiffre d'affaires et les derniers
  // passages se calculent dans le navigateur, à partir des mêmes réservations et documents que
  // le reste de l'écran (`buildEntrepriseProfile`).
  const { data: entreprisesBrutes, error: errEntreprises } = await supabase
    .from('entreprises')
    .select('id, nom, delai_paiement_jours')
    .eq('washer_id', washer.id)
    .order('nom')
  if (errEntreprises) logger.warn('clients.entreprises.fetch_failed', { washerId: washer.id }, errEntreprises)

  const idsEntreprises = (entreprisesBrutes ?? []).map(e => e.id)
  const { data: sitesBruts, error: errSites } = idsEntreprises.length === 0
    ? { data: [] as { id: string; entreprise_id: string; adresse: string; note: string | null }[], error: null }
    : await supabase.from('sites').select('id, entreprise_id, adresse, note').in('entreprise_id', idsEntreprises)
  if (errSites) logger.warn('clients.sites.fetch_failed', { washerId: washer.id }, errSites)

  // Le typage déduit une LISTE pour la jointure `services`, mais PostgREST
  // renvoie un objet : une réservation n'a qu'une prestation. On accepte les
  // deux formes plutôt que de forcer le type.
  const lignes: ClientBooking[] = bookings.map(b => ({
    ...b,
    services: (Array.isArray(b.services) ? b.services[0] : b.services) ?? null,
  }))
  const reglages: ClientReglages[] = (lignesClients ?? []).map(r => ({
    cle: r.cle, nePlusContacter: r.ne_plus_contacter, masque: !!r.masque_le,
    notes: r.notes, vehicules: r.vehicules, nom: r.nom, telephone: r.telephone,
  }))
  const contactsBruts: ContactEntreprise[] = (lignesClients ?? [])
    .filter(r => r.entreprise_id)
    .map(r => ({ cle: r.cle, entrepriseId: r.entreprise_id as string, role: r.role_entreprise }))
  const entreprises: EntrepriseListItem[] = (entreprisesBrutes ?? []).map(e => ({
    id: e.id,
    nom: e.nom,
    delaiPaiementJours: e.delai_paiement_jours,
    sites: (sitesBruts ?? [])
      .filter(s => s.entreprise_id === e.id)
      .map(s => ({ id: s.id, entrepriseId: s.entreprise_id, adresse: s.adresse, note: s.note })),
    contacts: contactsBruts.filter(c => c.entrepriseId === e.id),
  }))

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <ClientsView
        nomLaveur={washer.name}
        bookings={lignes}
        documents={(documents ?? []) as unknown as ClientDocument[]}
        reglages={reglages}
        reglagesMessages={{
          followup_enabled: !!washer.followup_enabled,
          followup_delay_days: washer.followup_delay_days ?? 90,
          followup_message: washer.followup_message ?? null,
        } satisfies ReglagesRelance}
        entreprises={entreprises}
      />
    </DashboardShell>
  )
}
