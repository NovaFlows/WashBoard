import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BookingList from '@/components/dashboard/BookingList'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!washer) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Profil laveur non trouvé. Contactez le support.</p>
      </main>
    )
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('washer_id', washer.id)
    .order('scheduled_at', { ascending: true })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{washer.name}</h1>
            <p className="text-sm text-gray-500">Tableau de bord</p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-gray-400 hover:text-gray-600">Déconnexion</button>
          </form>
        </div>

        <BookingList bookings={bookings ?? []} washerId={washer.id} />
      </div>
    </main>
  )
}
