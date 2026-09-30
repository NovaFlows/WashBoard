import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import MessagesAutomatiques from '@/components/dashboard/MessagesAutomatiques'
import { hasFeature, requiredPlanLabel } from '@/lib/plan'
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
const COLONNES =
  'id, client_name, client_email, client_phone, scheduled_at, created_at, status, is_professional, company_name, '
  + 'review_request_at, review_request_sent_at, review_sms_sent_at, followup_sent_at, services(name)'

export default async function MessagesAutomatiquesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'messages-automatiques')

  // Tous les rendez-vous du laveur, page par page (l'API plafonne à 1 000
  // lignes sans erreur). Les colonnes d'horodatage d'envoi sont celles que lisent
  // les crons ; si l'une manquait en base la lecture échouerait — l'écran le
  // dit (`lectureIncomplete`) au lieu d'afficher des listes fausses.
  const { data: rdvs, error, tronque } = await toutesLesLignes<RdvMessage>(
    (debut, fin) => supabase
      .from('bookings')
      .select(COLONNES)
      .eq('washer_id', washer.id)
      .order('created_at', { ascending: false })
      .order('id')
      .range(debut, fin) as unknown as PromiseLike<{ data: RdvMessage[] | null; error: unknown }>,
  )
  if (error) logger.warn('messages-automatiques.bookings.fetch_failed', { washerId: washer.id }, error)

  // Seuls les réglages utiles passent au navigateur : la fiche laveur porte
  // aussi des jetons (Google) qui n'ont rien à y faire.
  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <MessagesAutomatiques
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
        telephone={washer.phone ?? ''}
        slug={washer.slug}
        rdvs={rdvs}
        lectureIncomplete={!!error || tronque}
      />
    </DashboardShell>
  )
}
