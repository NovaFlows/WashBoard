import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import BookingForm from '@/components/booking/BookingForm'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">WashBoard</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{washer.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Réservez votre lavage à domicile en quelques clics</p>
        </div>

        <BookingForm
          washer={washer}
          services={services ?? []}
          availabilities={availabilities ?? []}
        />
      </main>
    </div>
  )
}
