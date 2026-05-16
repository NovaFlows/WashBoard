import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BookingForm from '@/components/booking/BookingForm'

type Props = {
  params: Promise<{ slug: string }>
}

export default async function BookingPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: washer } = await supabase
    .from('washers')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!washer) notFound()

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('washer_id', washer.id)

  const { data: availabilities } = await supabase
    .from('availabilities')
    .select('*')
    .eq('washer_id', washer.id)

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{washer.name}</h1>
          <p className="text-gray-500 mt-1">Réservez votre lavage à domicile</p>
        </div>
        <BookingForm
          washer={washer}
          services={services ?? []}
          availabilities={availabilities ?? []}
        />
      </div>
    </main>
  )
}
