import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BookingForm from '@/components/booking/BookingForm'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: washer } = await supabase
    .from('washers')
    .select('name, logo_url')
    .eq('slug', slug)
    .single()

  if (!washer) return { title: 'Réservation' }

  return {
    title: `${washer.name} — Réservation`,
    icons: washer.logo_url
      ? { icon: washer.logo_url, shortcut: washer.logo_url, apple: washer.logo_url }
      : undefined,
  }
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
    <>
    {washer.logo_url && <link rel="icon" href={washer.logo_url} type="image/png" />}
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {washer.logo_url ? (
              <img
                src={washer.logo_url}
                alt={washer.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xl font-bold text-slate-500 dark:text-slate-400 select-none">
                {washer.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 leading-none tracking-tight">{washer.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 leading-none">{washer.welcome_message || 'Réservation en ligne'}</p>
            </div>
          </div>
          <ThemeToggle large />
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
          accent={washer.brand_color ?? '#2563eb'}
        />
      </main>
    </div>
    </>
  )
}
