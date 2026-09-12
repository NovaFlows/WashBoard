import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingList from '@/components/dashboard/BookingList'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { logger } from '@/lib/logger'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer, error: washerError } = await supabase
    .from('washers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Une lecture qui échoue n'est pas un profil absent. Avant, les deux menaient
  // à la déconnexion : un simple raté réseau au réveil de l'application
  // installée fermait la session pour de bon. C'est la page d'ouverture de
  // l'application, la plus exposée. Une erreur affiche désormais l'écran
  // « Réessayer » et la session reste intacte.
  // PGRST116 = aucune ligne : c'est le seul cas où le profil manque vraiment.
  if (washerError && washerError.code !== 'PGRST116') {
    logger.error('dashboard.washer.read_failed', { userId: user.id }, washerError)
    throw new Error('Lecture du profil laveur impossible')
  }

  // Session orpheline (ligne washer supprimée mais session auth encore active) :
  // on déconnecte pour éviter la boucle "profil non trouvé".
  if (!washer) redirect('/api/auth/logout')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, price, duration_minutes, service_categories(name))')
    .eq('washer_id', washer.id)
    .order('scheduled_at', { ascending: true })

  const all = bookings ?? []
  const pending = all.filter(b => b.status === 'pending').length
  const confirmed = all.filter(b => b.status === 'confirmed').length
  const done = all.filter(b => b.status === 'done').length

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null}>
      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="En attente" value={pending} color="amber" />
        <StatCard label="Confirmés" value={confirmed} color="emerald" />
        <StatCard label="Terminés" value={done} color="slate" />
      </div>

      <BookingList bookings={all} washerId={washer.id} />
    </DashboardShell>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'amber' | 'emerald' | 'slate' }) {
  const colors = {
    amber:   'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    slate:   'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400',
  }
  return (
    <div className={`rounded-xl border p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  )
}
