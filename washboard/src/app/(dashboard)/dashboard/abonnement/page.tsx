import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import AbonnementPanel from '@/components/dashboard/AbonnementPanel'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { planEffectif, doitChoisirFormule, accesComplet, quotaReservations, quotaPrestations, debutPeriodeQuota, debutSoumisAuPlafond, libelleRemiseAZero } from '@/lib/plan'
import { logger } from '@/lib/logger'

export default async function AbonnementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'abonnement')

  // Où en est le laveur de ses plafonds. On ne compte que si l'offre en a un :
  // deux requêtes de plus à chaque visite pour afficher « illimité » seraient
  // deux requêtes de trop.
  const plafondReservations = quotaReservations(washer)
  const plafondPrestations  = quotaPrestations(washer)

  const [resaCeMois, prestations] = await Promise.all([
    plafondReservations === null ? null : supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('washer_id', washer.id)
      .neq('status', 'cancelled')
      // MÊME borne que partout ailleurs : le début de la période, mais jamais
      // avant l'entrée en vigueur du plafond. Sans `debutSoumisAuPlafond`,
      // cette page annonçait 18 / 5 pendant que la jauge de l'accueil disait
      // 8 / 5 — deux chiffres pour la même chose sur deux écrans voisins.
      .gte('created_at', debutSoumisAuPlafond(debutPeriodeQuota(washer.created_at)).toISOString()),
    plafondPrestations === null ? null : supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('washer_id', washer.id),
  ])

  // Un comptage illisible n'empêche pas d'afficher la page : c'est la jauge
  // qui disparaît, pas l'abonnement. Le vrai contrôle est côté route.
  if (resaCeMois?.error)  logger.warn('abonnement.resaCeMois.read_failed', { washerId: washer.id }, resaCeMois.error)
  if (prestations?.error) logger.warn('abonnement.prestations.read_failed', { washerId: washer.id }, prestations.error)

  return (
    <DashboardShell
      washerName={washer.name}
      trialEndsAt={washer.trial_ends_at}
      subscriptionStatus={washer.subscription_status}
      plan={washer.plan}
      grandfathered={washer.grandfathered} createdAt={washer.created_at} slug={washer.slug}
      stripeSubscriptionId={washer.stripe_subscription_id ?? null}
      cancelsAt={washer.cancels_at ?? null}
      betaRefonte={washer.beta_refonte}
    >
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Abonnement</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gérez votre abonnement WashBoard</p>
      </div>
      <AbonnementPanel
        subscriptionStatus={washer.subscription_status ?? 'trial'}
        trialEndsAt={washer.trial_ends_at ?? null}
        subscriptionEndsAt={washer.subscription_ends_at ?? null}
        plan={planEffectif(washer)}
        doitChoisir={doitChoisirFormule(washer)}
        grandfathered={accesComplet(washer)}
        plafondReservations={plafondReservations}
        reservationsCeMois={resaCeMois?.error ? null : resaCeMois?.count ?? null}
        plafondPrestations={plafondPrestations}
        prestationsAuCatalogue={prestations?.error ? null : prestations?.count ?? null}
        remiseAZero={libelleRemiseAZero(washer.created_at)}
      />
    </DashboardShell>
  )
}
