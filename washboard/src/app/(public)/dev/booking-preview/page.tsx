import IdentiteForm from '@/components/dashboard/admin/IdentiteForm'
import type { Washer } from '@/types'
import LegacyBookingPage from '@/components/booking/LegacyBookingPage'
import ApparenceV2 from '@/components/dashboard/ApparenceV2'
import { notFound } from 'next/navigation'
import BookingForm from '@/components/booking/BookingForm'
import BookingHero from '@/components/booking/BookingHero'
import type { Service, ServiceCategory } from '@/types'
import Onboarding from '@/app/(public)/onboarding/Onboarding'
import BandeauPromotion from '@/components/booking/BandeauPromotion'
import PromotionsV2 from '@/components/dashboard/PromotionsV2'
import AcompteV2 from '@/components/dashboard/AcompteV2'
import FideliteV2 from '@/components/dashboard/FideliteV2'
import EncartFidelite from '@/components/booking/EncartFidelite'
import CarteApresReservation from '@/components/booking/CarteApresReservation'
import CarteFidelite3D, { type ScenarioCarte } from '@/components/fidelite/CarteFidelite3D'
import EncartAcompte from '@/components/booking/EncartAcompte'
import type { PromotionPublique } from '@/lib/promotion'

// Fin de la promotion d'exemple, calculée au chargement du module et non pendant le rendu
// (un rendu doit rester pur).
const FIN_PROMO_EXEMPLE = new Date(Date.now() + 2.5 * 86400000).toISOString()

/** Banc d'essai local : aucun accès à Supabase. Les API sont interceptées par le test navigateur. */
export default async function BookingPreview({ searchParams }: { searchParams: Promise<{ mode?: string; etape?: string; promo?: string; scenario?: string; couleur?: string; tampons?: string }> }) {
  const { mode, etape, promo, scenario, couleur, tampons } = await searchParams
  if (process.env.NODE_ENV !== 'development' || process.env.BOOKING_UI_PREVIEW !== '1') notFound()
  // `?promo=1` : une promotion d'exemple, finie dans deux jours et demi.
  const promotion: PromotionPublique | null = promo === '1' ? {
    nom: 'Saint-Valentin', type_remise: 'pourcentage', valeur: 20, fin: FIN_PROMO_EXEMPLE, service_ids: null,
    bandeau_actif: true, bandeau_texte: 'Offrez un lavage à votre moitié', bandeau_couleur: '#C2185B', bandeau_compteur: true,
  } : null
  if (mode === 'onboarding') return <Onboarding slug="eclat-mobile" nom="Éclat Mobile" etapeInitiale={([1, 2, 3, 4, 5, 6] as const).find(n => String(n) === etape) ?? 1} />
  if (mode === 'settings-web') return <IdentiteForm washer={{ id: 'demo', name: 'Brillance Mobile', slug: 'test-config-15d2', booking_page_mode: 'default', brand_color: '#7c3aed', welcome_message: 'Bienvenue chez Brillance Mobile', plan: 'business', zone_config: null } as Washer} />
  if (mode === 'settings') return <ApparenceV2 nom="Brillance Mobile" slug="test-config-15d2" initial={{ pageMode: 'default', logoUrl: null, couleur: '#7c3aed', fond: null, message: 'Bienvenue chez Brillance Mobile', site: null, avisGoogle: null }} liste={{ nom: 'Brillance Mobile', slug: 'test-config-15d2', brandColor: '#7c3aed', plan: 'business', grandfathered: false }} />
  const washerId = '00000000-0000-4000-8000-000000000001'
  const category: ServiceCategory = { id: 'cars', washer_id: washerId, name: 'Voitures', display_order: 0,
    types: [{ id: 'citadine', name: 'Citadine' }, { id: 'citadine_2p', name: 'Citadine 2p' }, { id: 'berline', name: 'Berline' }, { id: 'SUV', name: 'SUV' }, { id: 'monospace', name: 'Monospace' }, { id: '7places', name: '7 places' }, { id: 'utilitaire', name: 'Utilitaire' }, { id: '5d0c7f3e-2a41-4b8e-9c61-7e2f0a9b3d14', name: 'Moto' }, { id: '8a6e1b29-4c3d-4f5a-b7e8-1d2c3b4a5f60', name: 'Camion' }, { id: 'camping-car', name: 'Camping-car' }],
  }
  const services: Service[] = [
    { id: '00000000-0000-4000-8000-000000000011', name: 'Extérieur', description: 'Carrosserie, jantes, vitres, séchage sans traces', price: 35, duration_minutes: 60, addons: [] },
    { id: '00000000-0000-4000-8000-000000000012', name: 'Intérieur', description: 'Aspiration, plastiques, tapis, vitres intérieures', price: 45, duration_minutes: 75,
      addons: [{ id: 'seats', label: 'Shampoing des sièges', price: 30, duration_minutes: 30, category: 'Options' }, { id: 'pets', label: 'Poils d’animaux', price: 15, duration_minutes: 15, category: 'Options' }] },
    { id: '00000000-0000-4000-8000-000000000013', name: 'Complet', description: 'Intérieur et extérieur en une seule visite', price: 75, duration_minutes: 120, addons: [] },
  ].map(s => ({ ...s, washer_id: washerId, category_id: category.id, vehicle_types: category.types.map(t => t.id), vehicle_price_overrides: { SUV: s.price + 10 } }))
  if (mode === 'promotions') return <PromotionsV2 slug="demo" services={services.map(s => ({ id: s.id, name: s.name }))} liste={{ nom: 'Brillance Mobile', slug: 'demo', plan: 'business', grandfathered: false }} />
  if (mode === 'acompte') return <AcompteV2 slug="demo" liste={{ nom: 'Brillance Mobile', slug: 'demo', plan: 'business', grandfathered: false }} />
  if (mode === 'fidelite') return <FideliteV2 slug="demo" liste={{ nom: 'Brillance Mobile', slug: 'demo', plan: 'business', grandfathered: false }} marque="#7c3aed" />
  // La carte en 3D seule (`?scenario=reservation|tampon|consultation&couleur=0F7A55&tampons=7`).
  if (mode === 'carte-fidelite') return <main className="min-h-screen bg-[#F6F5F3] px-4 py-8 dark:bg-[#0E0E11]"><div className="mx-auto max-w-md">
    <CarteFidelite3D couleur={`#${couleur ?? '6D28D9'}`} finition="holo" nom="Brillance Mobile" numero="4F2A" requis={10} tampons={Number(tampons ?? 7)}
      recompense="Prestation offerte" scenario={(scenario ?? 'tampon') as ScenarioCarte} largeur={380} legende="Votre tampon est arrivé" />
  </div></main>
  if (mode === 'confirmation-fidelite') return <main className="mx-auto max-w-md bg-white p-4 text-center dark:bg-slate-900">
    <CarteApresReservation fidelite={{ jeton: '4f2a9c0e00000000000000000000000000ab', remise: 0, etat: { progression: 7, requis: 10, disponibles: 0 }, phrase: 'Plus que 3 prestations avant une prestation offerte.',
      carte: { couleur: `#${couleur ?? '0F7A55'}`, finition: 'holo', nom: 'Brillance Mobile', logo: null, numero: '4F2A', recompense: 'Prestation offerte' } }} />
  </main>
  if (mode === 'encart-fidelite') return <div className="mx-auto flex max-w-lg flex-col gap-4 p-4">
    <EncartFidelite total={59} apercu={{ progression: 7, requis: 10, disponibles: 0, remise: 0, offerte: false, phrase: 'Plus que 3 prestations avant une prestation offerte.' }} />
    <EncartFidelite total={59} apercu={{ progression: 0, requis: 10, disponibles: 1, remise: 45, offerte: true, phrase: '' }} />
    <EncartFidelite total={59} apercu={{ progression: 0, requis: 10, disponibles: 1, remise: 9, offerte: false, phrase: '' }} />
  </div>
  if (mode === 'encart-acompte') return <div className="mx-auto max-w-lg p-4"><EncartAcompte montant={16.05} conditions={['À régler dans les 48 h après la réservation, sinon elle est annulée.', 'Remboursé si vous annulez au moins 48 h avant le rendez-vous.', 'Le reste se règle sur place.']}
    liens={[{ libelle: 'PayPal', url: 'https://paypal.me/eclat/16.05EUR', montantExact: true }, { libelle: 'Stripe', url: 'https://buy.stripe.com/test', montantExact: false }]}
    wero={{ telephone: '06 12 34 56 78', lien: 'https://share.weropay.eu/p/1/c/exemple' }}
    virement={{ titulaire: 'Éclat Mobile', iban: 'FR76 3000 6000 0112 3456 7890 189', reference: 'WB-54CF8F67' }} /></div>
  if (mode === 'custom') return <LegacyBookingPage washer={{ id: washerId, name: 'Brillance Mobile', slug: 'demo', phone: null, logo_url: null, welcome_message: 'Bienvenue chez Brillance Mobile', brand_color: '#7c3aed', background_theme: null, website_url: null, base_address: null, team_size: 1, travel_fee_mode: 'base', travel_fee_tiers: [], reservation_jour_meme: false, plan: 'business', subscription_status: 'active' }} services={services} categories={[category]} availabilities={Array.from({ length: 7 }, (_, i) => ({ id: String(i), washer_id: washerId, day_of_week: i, start_time: '09:00', end_time: '18:00' }))} plafondAtteint={false} facturationPrete={true} pixelId={null} promotion={promotion} />
  return <><div className="min-h-screen bg-[#f6f5f3] dark:bg-zinc-950">
    {promotion && <BandeauPromotion promo={promotion} />}
    <BookingHero name="Brillance Mobile" message="Lavage auto à domicile par Karim, à Lyon et alentours. Trois questions et c’est réservé." accent="#2563eb" personalized whatsappHref="https://wa.me/33000000000" />
    <main className="relative max-w-lg mx-auto -mt-6 rounded-t-[28px] bg-[#f6f5f3] dark:bg-zinc-950 px-3.5 pt-3.5 pb-[calc(180px+env(safe-area-inset-bottom,0px))]">
      <BookingForm washer={{ id: washerId, name: 'Brillance Mobile', base_address: null, team_size: 1, travel_fee_mode: 'base', travel_fee_tiers: [], clients_pro: true, facturation_prete: true }}
        services={services} categories={[category]} availabilities={Array.from({ length: 7 }, (_, i) => ({ id: String(i), washer_id: washerId, day_of_week: i, start_time: '09:00', end_time: '18:00' }))}
        disponibilites={{ bookings: [], unavailabilities: [] }} whatsappHref="https://wa.me/33000000000" promotion={promotion} />
    </main>
  </div></>
}
