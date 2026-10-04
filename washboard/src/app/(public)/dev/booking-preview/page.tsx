import IdentiteForm from '@/components/dashboard/admin/IdentiteForm'
import type { Washer } from '@/types'
import LegacyBookingPage from '@/components/booking/LegacyBookingPage'
import ApparenceV2 from '@/components/dashboard/ApparenceV2'
import { notFound } from 'next/navigation'
import BookingForm from '@/components/booking/BookingForm'
import BookingHero from '@/components/booking/BookingHero'
import type { Service, ServiceCategory } from '@/types'

/** Banc d'essai local : aucun accès à Supabase. Les API sont interceptées par le test navigateur. */
export default async function BookingPreview({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams
  if (process.env.NODE_ENV !== 'development' || process.env.BOOKING_UI_PREVIEW !== '1') notFound()
  if (mode === 'settings-web') return <IdentiteForm washer={{ id: 'demo', name: 'Brillance Mobile', slug: 'demo', booking_page_mode: 'default', brand_color: '#7c3aed', welcome_message: 'Bienvenue chez Brillance Mobile', plan: 'business', zone_config: null } as Washer} />
  if (mode === 'settings') return <ApparenceV2 nom="Brillance Mobile" slug="demo" initial={{ pageMode: 'default', logoUrl: null, couleur: '#7c3aed', fond: null, message: 'Bienvenue chez Brillance Mobile', site: null, avisGoogle: null }} />
  const washerId = '00000000-0000-4000-8000-000000000001'
  const category: ServiceCategory = { id: 'cars', washer_id: washerId, name: 'Voitures', display_order: 0,
    types: [{ id: 'citadine', name: 'Citadine' }, { id: 'berline', name: 'Berline' }, { id: 'SUV', name: 'SUV' }, { id: 'utilitaire', name: 'Utilitaire' }],
  }
  const services: Service[] = [
    { id: '00000000-0000-4000-8000-000000000011', name: 'Extérieur', description: 'Carrosserie, jantes, vitres, séchage sans traces', price: 35, duration_minutes: 60, addons: [] },
    { id: '00000000-0000-4000-8000-000000000012', name: 'Intérieur', description: 'Aspiration, plastiques, tapis, vitres intérieures', price: 45, duration_minutes: 75,
      addons: [{ id: 'seats', label: 'Shampoing des sièges', price: 30, duration_minutes: 30, category: 'Options' }, { id: 'pets', label: 'Poils d’animaux', price: 15, duration_minutes: 15, category: 'Options' }] },
    { id: '00000000-0000-4000-8000-000000000013', name: 'Complet', description: 'Intérieur et extérieur en une seule visite', price: 75, duration_minutes: 120, addons: [] },
  ].map(s => ({ ...s, washer_id: washerId, category_id: category.id, vehicle_types: category.types.map(t => t.id), vehicle_price_overrides: { SUV: s.price + 10 } }))
  if (mode === 'custom') return <LegacyBookingPage washer={{ id: washerId, name: 'Brillance Mobile', slug: 'demo', phone: null, logo_url: null, welcome_message: 'Bienvenue chez Brillance Mobile', brand_color: '#7c3aed', background_theme: null, website_url: null, base_address: null, team_size: 1, travel_fee_mode: 'base', travel_fee_tiers: [], reservation_jour_meme: false, plan: 'business', subscription_status: 'active' }} services={services} categories={[category]} availabilities={Array.from({ length: 7 }, (_, i) => ({ id: String(i), washer_id: washerId, day_of_week: i, start_time: '09:00', end_time: '18:00' }))} plafondAtteint={false} facturationPrete={true} pixelId={null} />
  return <div className="min-h-screen bg-[#f6f5f3] dark:bg-zinc-950">
    <BookingHero name="Brillance Mobile" message="Lavage auto à domicile par Karim, à Lyon et alentours. Trois questions et c’est réservé." accent="#2563eb" personalized whatsappHref="https://wa.me/33000000000" />
    <main className="relative max-w-lg mx-auto -mt-6 rounded-t-[28px] bg-[#f6f5f3] dark:bg-zinc-950 px-3.5 pt-3.5 pb-[calc(180px+env(safe-area-inset-bottom,0px))]">
      <BookingForm washer={{ id: washerId, name: 'Brillance Mobile', base_address: null, team_size: 1, travel_fee_mode: 'base', travel_fee_tiers: [], clients_pro: true, facturation_prete: true }}
        services={services} categories={[category]} availabilities={Array.from({ length: 7 }, (_, i) => ({ id: String(i), washer_id: washerId, day_of_week: i, start_time: '09:00', end_time: '18:00' }))}
        disponibilites={{ bookings: [], unavailabilities: [] }} whatsappHref="https://wa.me/33000000000" />
    </main>
  </div>
}
