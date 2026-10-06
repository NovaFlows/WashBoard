import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Horaires from '@/components/dashboard/Horaires'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { logger } from '@/lib/logger'
import type { Availability, Unavailability } from '@/types'

// Refonte 2026 — « Horaires » : les plages d'ouverture de la semaine (ce que le
// client final voit sur la page de réservation, `StepSlot`) et les congés. Réservé
// à la PWA installée (voir Horaires.tsx, le garde-fou : le site est renvoyé vers
// `/dashboard/admin#disponibilites`).
//
// L'adresse est sous `/dashboard/parametres/` pour que « Plus » reste allumé dans
// la barre du bas (BarreBasV2 : `startsWith('/dashboard/parametres')`) — c'est un
// écran de « Plus », comme `parametres/prestations`.
//
// Lecture seule ici : les écritures passent par `/api/availabilities` et
// `/api/unavailabilities` depuis le navigateur. Mêmes requêtes que
// `/dashboard/admin` (`admin/page.tsx`).
export default async function HorairesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'horaires')

  const [
    { data: availabilities, error: errDispos },
    { data: unavailabilities, error: errConges },
  ] = await Promise.all([
    supabase.from('availabilities').select('*').eq('washer_id', washer.id).order('day_of_week'),
    supabase.from('unavailabilities').select('*').eq('washer_id', washer.id).order('start_date'),
  ])

  // Une lecture en échec ne doit surtout pas se lire « aucun horaire » : l'écran
  // propose alors, à un compte vide, de choisir « Lun–Ven 8h–18h » — un laveur
  // déjà configuré écraserait donc sa semaine, ou en ferait des doublons. Et des
  // congés qui « disparaissent » de l'écran sont des créneaux qu'il croirait
  // rouverts. Les deux lectures sont signalées à l'écran (`lectureIncomplete`).
  for (const [table, erreur] of [['availabilities', errDispos], ['unavailabilities', errConges]] as const) {
    if (erreur) logger.error('horaires.read_failed', { washerId: washer.id, table }, erreur)
  }

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug} subscriptionEndsAt={washer.subscription_ends_at ?? null} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Horaires
        availabilities={(availabilities ?? []) as Availability[]}
        unavailabilities={(unavailabilities ?? []) as Unavailability[]}
        teamSize={washer.team_size ?? 1}
        jourMemeAutorise={!!washer.reservation_jour_meme}
        adresseDepart={!!washer.base_address?.trim()}
        lectureIncomplete={!!errDispos || !!errConges}
        // Liste « Plus », pour la colonne de gauche sur grand écran : `nom`/`slug`/`plan`/
        // `grandfathered`/`brandColor` viennent du `select('*')` déjà fait par
        // `washerDuUtilisateur` ci-dessus ; `resumeHoraires` est recalculé dans HorairesV2.tsx
        // lui-même, depuis les horaires affichés (voir son en-tête) — aucune requête de plus.
        liste={{
          nom: washer.name,
          slug: washer.slug,
          brandColor: washer.brand_color,
          plan: washer.plan,
          grandfathered: washer.grandfathered,
        }}
        betaRefonte={washer.beta_refonte}
      />
    </DashboardShell>
  )
}
