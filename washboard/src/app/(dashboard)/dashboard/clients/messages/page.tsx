import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import MessagesAutomatiques from '@/components/dashboard/MessagesAutomatiques'
import { hasFeature, requiredPlanLabel, quotaReservations } from '@/lib/plan'
import { seuilsVerrouillage, masquerVerrouillees } from '@/lib/reservationsVerrouillees'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { logger } from '@/lib/logger'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import {
  DELAI_AVIS_DEFAUT_HEURES, DELAI_RELANCE_DEFAUT_JOURS, type RdvMessage,
} from '@/lib/messagesAutomatiques'

// Refonte 2026 — « Messages automatiques » : les deux automatismes (demande
// d'avis, relance), leur réglage, ce qui est programmé et ce qui est parti.
// Réservé à la PWA installée (voir MessagesAutomatiques.tsx, le garde-fou : le
// site est renvoyé vers `/dashboard/parametres/tout#avis`).
//
// L'adresse est sous `/dashboard/clients/` pour que « Clients » reste allumé dans la
// barre du bas (BarreBasV2 : `startsWith('/dashboard/clients')`) : depuis le 2026-09-30 cet
// écran se range avec les clients (lignes « Avis Google » et « Relance client » de la section
// « Automatismes »), il n'est plus dans « Plus ».
//
// Lecture seule ici : les écritures passent par `PATCH /api/washer` depuis le
// navigateur. Aucun cron n'est déclenché, aucun message n'est envoyé.
//
// `saisie_par_laveur` ne s'affiche pas : sans lui, `estVerrouillee` masquerait aussi les
// rendez-vous que le laveur a saisis lui-même.
const COLONNES =
  'id, client_name, client_email, client_phone, scheduled_at, created_at, saisie_par_laveur, facture_numero, status, is_professional, company_name, '
  + 'review_request_at, review_request_sent_at, review_sms_sent_at, followup_sent_at, relance_reportee_au, relance_annulee_le, services(name)'

type RdvLu = RdvMessage & { saisie_par_laveur?: boolean | null }

export default async function MessagesAutomatiquesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'messages-automatiques')
  // `bookings` via l'admin : `authenticated` ne la lit plus (le laveur y
  // contournait le masque en direct). Le filtre `washer_id` est la seule
  // barrière entre laveurs.
  const admin = createAdminClient()

  // Tous les rendez-vous du laveur, page par page (l'API plafonne à 1 000
  // lignes sans erreur). Les colonnes d'horodatage d'envoi sont celles que lisent
  // les crons ; si l'une manquait en base la lecture échouerait — l'écran le
  // dit (`lectureIncomplete`) au lieu d'afficher des listes fausses.
  const { data: lus, error, tronque } = await toutesLesLignes<RdvLu>(
    (debut, fin) => admin
      .from('bookings')
      .select(COLONNES)
      .eq('washer_id', washer.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin) as unknown as PromiseLike<{ data: RdvLu[] | null; error: unknown }>,
  )
  if (error) logger.warn('messages-automatiques.bookings.fetch_failed', { washerId: washer.id }, error)

  // Écartées plutôt que masquées, comme sur /dashboard/crm : sans nom ni email elles ne
  // donneraient ici que des lignes anonymes, et leur heure partirait quand même au navigateur.
  const seuilsVerrou = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  const rdvs = masquerVerrouillees(lus, seuilsVerrou).filter(b => !b.verrouillee)

  // Clients « ne plus contacter » (table `clients`) : les crons les écartent, l'écran aussi —
  // sinon « Programmé » annonçait une relance qui ne partira jamais. Même lecture que l'écran
  // Clients ; en cas d'échec on ne masque rien (la liste reste celle d'avant), mais on le note.
  const { data: refus, error: errRefus } = await supabase
    .from('clients')
    .select('cle')
    .eq('washer_id', washer.id)
    .eq('ne_plus_contacter', true)
  if (errRefus) logger.warn('messages-automatiques.refus.fetch_failed', { washerId: washer.id }, errRefus)

  // Seuls les réglages utiles passent au navigateur : la fiche laveur porte
  // aussi des jetons (Google) qui n'ont rien à y faire.
  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <MessagesAutomatiques
        betaRefonte={washer.beta_refonte}
        reglages={{
          review_enabled: !!washer.review_enabled,
          review_delay_hours: washer.review_delay_hours ?? DELAI_AVIS_DEFAUT_HEURES,
          google_review_url: washer.google_review_url ?? null,
          review_channel: washer.review_channel === 'sms' ? 'sms' : 'email',
          followup_enabled: !!washer.followup_enabled,
          followup_delay_days: washer.followup_delay_days ?? DELAI_RELANCE_DEFAUT_JOURS,
          followup_message: washer.followup_message ?? null,
        }}
        smsAutorise={hasFeature(washer, 'avis_sms')}
        avisAutorise={hasFeature(washer, 'avis_email')}
        libellePlanAvis={requiredPlanLabel('avis_email')}
        relanceAutorisee={hasFeature(washer, 'followup')}
        libellePlanRelance={requiredPlanLabel('followup')}
        nomLaveur={washer.name}
        expediteurSms={washer.sms_sender ?? ''}
        expediteurStatut={washer.sms_sender_statut ?? null}
        telephone={washer.phone ?? ''}
        slug={washer.slug}
        rdvs={rdvs}
        clesSansContact={(refus ?? []).map(r => r.cle as string)}
        lectureIncomplete={!!error || tronque}
      />
    </DashboardShell>
  )
}
