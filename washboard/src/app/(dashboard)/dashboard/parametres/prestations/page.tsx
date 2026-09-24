import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import Prestations from '@/components/dashboard/Prestations'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { logger } from '@/lib/logger'
import type { Availability, Service, ServiceCategory } from '@/types'

// Refonte 2026 — « Prestations et prix » : les lavages proposés aux clients, leurs
// catégories, types, prix et options. Réservé à la PWA installée (voir
// Prestations.tsx, le garde-fou : le site est renvoyé vers
// `/dashboard/admin#prestations`).
//
// L'adresse est sous `/dashboard/parametres/` pour que « Plus » reste allumé dans
// la barre du bas (BarreBasV2 : `startsWith('/dashboard/parametres')`) — c'est un
// écran de « Plus », comme `parametres/messages`.
//
// Lecture seule ici : les écritures passent par `/api/services` et
// `/api/categories` depuis le navigateur. Mêmes requêtes que
// `/dashboard/admin` (`admin/page.tsx`).
export default async function PrestationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'prestations')

  const [
    { data: services, error: errServices },
    { data: categories, error: errCategories },
    { data: availabilities, error: errDispos },
  ] = await Promise.all([
    supabase.from('services').select('*').eq('washer_id', washer.id).order('created_at'),
    supabase.from('service_categories').select('*').eq('washer_id', washer.id).order('display_order'),
    supabase.from('availabilities').select('*').eq('washer_id', washer.id).order('day_of_week'),
  ])

  // Une lecture en échec ne doit surtout pas se lire « aucune prestation » : cet
  // écran propose, à un compte vide, de créer sa première catégorie — un laveur
  // déjà configuré referait donc sa configuration en doublon. Les deux lectures
  // qui décident de « vide » sont signalées à l'écran (`lectureIncomplete`) ; les
  // disponibilités n'alimentent qu'un avertissement, on trace seulement.
  for (const [table, erreur] of [
    ['services', errServices], ['service_categories', errCategories], ['availabilities', errDispos],
  ] as const) {
    if (erreur) logger.error('prestations.read_failed', { washerId: washer.id, table }, erreur)
  }

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <Prestations
        services={(services ?? []) as Service[]}
        categories={(categories ?? []) as ServiceCategory[]}
        availabilities={(availabilities ?? []) as Availability[]}
        lectureIncomplete={!!errServices || !!errCategories}
      />
    </DashboardShell>
  )
}
