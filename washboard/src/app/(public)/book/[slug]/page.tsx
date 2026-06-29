import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import BookingForm from '@/components/booking/BookingForm'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { getBgStyle } from '@/lib/themes'
import { scrapeWebsiteReviews } from '@/lib/googleReviews'

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
  // Compte désactivé ou en cours de suppression : page de réservation masquée
  if (washer.account_status && washer.account_status !== 'active') notFound()

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('washer_id', washer.id)

  const { data: categories } = await supabase
    .from('service_categories')
    .select('*')
    .eq('washer_id', washer.id)
    .order('display_order')

  const { data: availabilities } = await supabase
    .from('availabilities')
    .select('*')
    .eq('washer_id', washer.id)

  const [
    { data: existingBookings },
    { data: unavailabilities },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('scheduled_at, vehicle_count, services(duration_minutes)')
      .eq('washer_id', washer.id)
      .neq('status', 'cancelled')
      .gte('scheduled_at', new Date().toISOString()),
    supabase
      .from('unavailabilities')
      .select('id, start_date, end_date')
      .eq('washer_id', washer.id),
  ])

  const bgStyle = getBgStyle(washer.background_theme)
  const themed  = !!bgStyle

  const reviewData = washer.website_url ? await scrapeWebsiteReviews(washer.website_url) : { reviews: [] }
  const hasReviews = reviewData.reviews.length > 0 || !!reviewData.aggregate

  return (
    <>
    {washer.logo_url && <link rel="icon" href={washer.logo_url} type="image/png" />}
    <div
      className={`min-h-screen ${themed ? '' : 'bg-slate-50 dark:bg-slate-950'}`}
      style={bgStyle ?? undefined}
    >
      <header className={
        themed
          ? 'border-b border-white/10 bg-black/30 backdrop-blur-sm'
          : 'border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
      }>
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {washer.logo_url ? (
              <img
                src={washer.logo_url}
                alt={washer.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl font-bold select-none ${
                themed
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}>
                {washer.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className={`text-2xl font-extrabold leading-none tracking-tight ${themed ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                {washer.name}
              </p>
              <p className={`text-xs mt-1 leading-none ${themed ? 'text-white/60' : 'text-slate-400 dark:text-slate-500'}`}>
                {washer.welcome_message || 'Réservation en ligne'}
              </p>
            </div>
          </div>
          {!themed && <ThemeToggle large />}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        {!themed && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{washer.name}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Réservez votre lavage à domicile en quelques clics</p>
          </div>
        )}
        {themed && (
          <>
            <h1 className="sr-only">Réservez votre lavage avec {washer.name}</h1>
            <div className="mb-6" />
          </>
        )}

        <BookingForm
          washer={washer}
          services={services ?? []}
          categories={categories ?? []}
          availabilities={availabilities ?? []}
          existingBookings={(existingBookings ?? []) as unknown as { scheduled_at: string; vehicle_count: number | null; services: { duration_minutes: number } | null }[]}
          unavailabilities={(unavailabilities ?? []) as { id: string; start_date: string; end_date: string }[]}
          accent={washer.brand_color ?? '#2563eb'}
        />

        {hasReviews && (
          <div className="mt-6">
            <div className={`rounded-2xl overflow-hidden ${
              themed
                ? 'bg-white/10 backdrop-blur-sm border border-white/15'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm'
            }`}>
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <p className={`text-sm font-semibold ${themed ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                  Avis clients
                </p>
                {reviewData.aggregate && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-amber-400 text-sm">★</span>
                    <span className={`text-sm font-bold ${themed ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                      {reviewData.aggregate.value.toFixed(1)}
                    </span>
                    {reviewData.aggregate.count > 0 && (
                      <span className={`text-xs ${themed ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
                        · {reviewData.aggregate.count} avis
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto px-5 pb-4 scrollbar-none">
                {reviewData.reviews.map((rv, i) => (
                  <div
                    key={i}
                    className={`shrink-0 w-56 rounded-xl p-3.5 ${
                      themed
                        ? 'bg-white/10 border border-white/15'
                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <span key={s} className={s < rv.rating ? 'text-amber-400' : (themed ? 'text-white/20' : 'text-slate-200 dark:text-slate-600')}>★</span>
                      ))}
                    </div>
                    <p className={`text-xs leading-relaxed line-clamp-4 mb-2 ${themed ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'}`}>
                      &ldquo;{rv.text}&rdquo;
                    </p>
                    <p className={`text-[11px] font-semibold ${themed ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
                      — {rv.author}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {washer.phone && (
          <div className="mt-6 flex justify-center">
            <a
              href={`https://wa.me/${washer.phone.replace(/\D/g, '').replace(/^0/, '33')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Nous contacter sur WhatsApp
            </a>
          </div>
        )}
      </main>
    </div>
    </>
  )
}
