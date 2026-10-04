import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ClientsView from '@/components/dashboard/ClientsView'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import type { ClientBooking, ClientDocument, ClientReglages } from '@/lib/clientProfile'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import type { ReglagesRelance } from '@/lib/clientsARelancer'
import type { ContactEntreprise, EntrepriseListItem } from '@/lib/entrepriseProfile'
import { quotaReservations, planEffectif, offreQuiCouvre, hasFeature, requiredPlanLabel, PLAN_LABELS } from '@/lib/plan'
import { minVehiclePrice } from '@/lib/pricing'
import { DELAI_AVIS_DEFAUT_HEURES, DELAI_RELANCE_DEFAUT_JOURS } from '@/lib/messagesAutomatiques'
import { seuilsVerrouillage, masquerVerrouillees, compterReservationsDeLaPeriode, montantVerrouille } from '@/lib/reservationsVerrouillees'
import { FUSEAU } from '@/lib/dateUtils'

// Fichier clients : tiré des réservations, un client par email (voir
// lib/listeClients.ts). Seules les colonnes utiles à la liste et à la fiche
// partent vers le navigateur — ni notes internes, ni contenu des factures.
//
// `created_at` et `followup_sent_at` s'ajoutent depuis le 2026-09-28 : c'est ce qu'il faut pour
// reproduire la décision du cron de relance (`lib/clientsARelancer.ts`, onglet « À relancer »).
// `review_request_sent_at` sert à la timeline mélangée de la fiche (`lib/clientTimeline.ts`).
// `vehicles_detail` s'ajoute le même jour : le modèle que le client tape lui-même en réservant
// (`StepService.tsx`), repris dans la fiche plutôt que redemandé au laveur (`clientProfile.ts`,
// `vehiculesReserves`). `created_at` sert AUSSI au verrouillage des réservations hors quota :
// sans lui, la règle ne peut rien trancher et l'annuaire les afficherait toutes.
const COLONNES = 'id, client_name, client_email, client_phone, address, scheduled_at, created_at, saisie_par_laveur, facture_numero, status, closed_late, booked_price, is_professional, company_name, followup_sent_at, review_request_sent_at, vehicles_detail, services(name, price, duration_minutes)'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'clients')
  // `bookings` via l'admin : `authenticated` ne la lit plus (le laveur y
  // contournait le masque en direct). Le filtre `washer_id` est la seule
  // barrière entre laveurs.
  const admin = createAdminClient()

  // Page par page : l'API coupe à 1 000 lignes sans erreur (voir `toutesLesLignes`).
  const { data: bookings, error } = await toutesLesLignes(
    (debut, fin) => admin
      .from('bookings')
      .select(COLONNES)
      .eq('washer_id', washer.id)
      .order('scheduled_at', { ascending: false })
      .order('id')
      .range(debut, fin),
  )
  // Sans trace, un fichier vide ne se distinguerait pas d'un laveur sans client.
  if (error) logger.error('clients.bookings.fetch_failed', { washerId: washer.id }, error)

  // Réservations au-delà du quota. Elles ne rejoignent PAS l'annuaire : celui-ci
  // regroupe par email, et ces réservations n'en ont pas — elles se fondraient
  // toutes en une seule fiche fantôme. Elles ont donc leur propre carte,
  // au-dessus, avec le jour seul — le nom est masqué comme le reste.
  const seuils = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  const montantBloque = montantVerrouille(bookings, seuils)
  const marquees = masquerVerrouillees(bookings, seuils)
  const visibles = marquees.filter(b => !b.verrouillee)
  const bloquees = marquees
    .filter(b => b.verrouillee)
    // Midi UTC du jour de Paris : le jour quitte le serveur, jamais l'heure (même règle que
    // dashboard/page.tsx — oubliée ici, l'heure exacte se lisait au Ctrl+U malgré l'écran qui
    // ne l'affiche pas, trouvé le 2026-10-02).
    .map(b => ({
      id: b.id as string,
      scheduled_at: `${new Date(b.scheduled_at as string).toLocaleDateString('en-CA', { timeZone: FUSEAU })}T12:00:00Z`,
    }))

  // L'offre proposée dépend du VOLUME du mois, pas du simple fait d'être
  // bloqué : à sept réservations sur une offre plafonnée à cinq, le Starter
  // suffit et coûte trente euros de moins que le Pro. Le comptage n'a lieu que
  // s'il y a quelque chose à débloquer — sinon c'est une requête pour rien sur
  // chaque affichage de la page.
  const volumeDuMois = bloquees.length === 0 ? null : await compterReservationsDeLaPeriode(admin, washer)
  const offreProposee = offreQuiCouvre(planEffectif(washer), volumeDuMois)

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

  // Section « Automatismes » (2026-09-30) : les prix ne servent qu'à l'exemple chiffré de la
  // feuille des créneaux intelligents. Sans eux la feuille reste utilisable, sans exemple.
  const { data: services, error: errServices } = await supabase
    .from('services')
    .select('*')
    .eq('washer_id', washer.id)
  if (errServices) logger.warn('clients.services.fetch_failed', { washerId: washer.id }, errServices)

  // Le typage déduit une LISTE pour la jointure `services`, mais PostgREST
  // renvoie un objet : une réservation n'a qu'une prestation. On accepte les
  // deux formes plutôt que de forcer le type.
  const lignes: ClientBooking[] = visibles.map(b => ({
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

  // Les campagnes déclarées, pour le résumé de la ligne « Publicités » des
  // Automatismes. Table seule, sans agrégation : la ligne dit un décompte et,
  // le cas échéant, qu'un budget a vieilli — jamais un retour, qui coûterait
  // deux agrégations complètes à chaque ouverture de l'écran.
  //
  // Un échec est silencieux et rend une liste vide : la migration 006 peut ne
  // pas avoir tourné, et l'écran Clients n'a aucune raison de tomber pour ça.
  const { data: campagnesLues } = await supabase
    .from('campagnes')
    .select('debut, fin, budget_maj_le')
    .eq('washer_id', washer.id)

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} subscriptionEndsAt={washer.subscription_ends_at ?? null} createdAt={washer.created_at} slug={washer.slug} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <ClientsView
        nomLaveur={washer.name}
        bookings={lignes}
        bloques={bloquees}
        offreDeblocage={PLAN_LABELS[offreProposee]}
        montantBloque={montantBloque}
        documents={(documents ?? []) as unknown as ClientDocument[]}
        reglages={reglages}
        reglagesMessages={{
          followup_enabled: !!washer.followup_enabled,
          followup_delay_days: washer.followup_delay_days ?? 90,
          followup_message: washer.followup_message ?? null,
        } satisfies ReglagesRelance}
        entreprises={entreprises}
        automatismes={{
          messages: {
            review_enabled: !!washer.review_enabled,
            review_delay_hours: washer.review_delay_hours ?? DELAI_AVIS_DEFAUT_HEURES,
            google_review_url: washer.google_review_url ?? null,
            review_channel: washer.review_channel === 'sms' ? 'sms' : 'email',
            followup_enabled: !!washer.followup_enabled,
            followup_delay_days: washer.followup_delay_days ?? DELAI_RELANCE_DEFAUT_JOURS,
            followup_message: washer.followup_message ?? null,
          },
          smsAutorise: hasFeature(washer, 'avis_sms'),
          avisAutorise: hasFeature(washer, 'avis_email'),
          relanceAutorisee: hasFeature(washer, 'followup'),
          libellePlanAvis: requiredPlanLabel('avis_email'),
          libellePlanRelance: requiredPlanLabel('followup'),
          creneaux: {
            actif: !!washer.smart_slot_enabled,
            proximite: washer.smart_slot_radius_minutes ?? 15,
            type: washer.smart_slot_discount_type === 'percent' ? 'percent' : 'fixed',
            valeur: Number(washer.smart_slot_discount_value ?? 0),
          },
          prestationsPrix: (services ?? []).map(s => ({ nom: s.name as string, prix: minVehiclePrice(s) })),
          campagnes: (campagnesLues ?? []).map(c => ({
            debut: c.debut as string,
            fin: (c.fin as string | null) ?? null,
            budget_maj_le: (c.budget_maj_le as string | null | undefined) ?? null,
          })),
          publicitesAutorisees: hasFeature(washer, 'campagnes'),
          libellePlanPublicites: requiredPlanLabel('campagnes'),
        }}
      />
    </DashboardShell>
  )
}
