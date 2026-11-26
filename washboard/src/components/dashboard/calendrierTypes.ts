import type { CentreAutoPublic } from '@/lib/centreAuto'

// Formes envoyées par `calendrier/page.tsx` à l'agenda, partagées par ses écrans et ses hooks.
export type Service = { name: string; price: number; duration_minutes: number }
export type ServiceFull = { id: string; name: string; price: number; duration_minutes: number; vehicle_price_overrides: Record<string, number>; category_id: string | null; vehicle_types: string[]; en_veille?: boolean | null }
export type Category = { id: string; name: string; types: { id: string; name: string }[] }
export type Booking = {
  id: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  /** 'centre' : au centre auto du laveur (lib/centreAuto.ts). */
  lieu?: 'domicile' | 'centre' | null
  lat: number | null
  lng: number | null
  /** Prestation principale (les ajoutées voyagent en options `prestation:<id>`). */
  service_id?: string | null
  scheduled_at: string
  /** Fin du créneau en base (durée des prestations et options comprise). */
  ends_at?: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  is_smart_slot: boolean
  smart_discount: number
  booked_price: number | null
  /** Remise accordée par le laveur, déjà retranchée de `booked_price` (lib/remiseLaveur.ts). */
  remise_laveur?: number | null
  /** Saisi par le laveur dans son agenda : une remise ne prévient pas le client. */
  saisie_par_laveur?: boolean | null
  selected_addons: { id: string; label: string; price: number; category: string; duration_minutes?: number }[] | null
  travel_fee: number | null
  vehicle_count: number | null
  vehicles_detail: { type: string; count: number; unit_price: number; label?: string; models?: string[]; addons?: { id: string; label: string; price: number; category: string; duration_minutes?: number }[] }[] | null
  // Catégorie jointe : « Lavage complet » ne dit pas si c'est une voiture ou
  // un canapé, alors que ça change le matériel à emporter.
  services: (Service & { service_categories?: { name: string } | null }) | null
  facture_numero?: string | null
  // Clôture tardive et type de client : la fenêtre de confirmation en a besoin
  // pour dire ce qui va se passer, et le badge « Délai dépassé » pour s'afficher.
  closed_late?: boolean | null
  is_professional?: boolean | null
}

export type Unavailability = { id: string; start_date: string; end_date: string; label: string | null; team_members_off: number; start_time?: string | null; end_time?: string | null }

export type CalendrierProps = { bookings: Booking[]; unavailabilities: Unavailability[]; teamSize: number; services: ServiceFull[]; categories: Category[]; washerId: string; centreAuto?: CentreAutoPublic | null; facturationPrete: boolean; googleAgendaConnecte: boolean; joursMasques?: string[]; masquees?: { id: string; scheduled_at: string }[]; offreDeblocage?: string }
