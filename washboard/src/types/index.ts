export type ZoneConfig =
  | { enabled: true; type: 'road';        center_address: string; radius_km: number }
  | { enabled: true; type: 'crow';        center_address: string; radius_km: number; center_lat?: number; center_lng?: number }
  | { enabled: true; type: 'departments'; departments: string[] }
  | { enabled: false }
  | null

export type Washer = {
  id: string
  user_id: string | null
  name: string
  slug: string
  phone: string | null
  logo_url: string | null
  welcome_message: string | null
  brand_color: string | null
  zone_config: ZoneConfig
  google_refresh_token: string | null
  team_size: number
  smart_slot_enabled: boolean
  smart_slot_radius_minutes: number
  smart_slot_discount_type: 'fixed' | 'percent'
  smart_slot_discount_value: number
  travel_fee_tiers: { max_minutes: number; fee: number }[]
  base_address: string | null
  travel_fee_mode: 'base' | 'previous'
  background_theme: string | null
  website_url: string | null
  account_status: 'active' | 'deactivated' | 'pending_deletion'
  deletion_scheduled_at: string | null
  plan: 'essentiel' | 'pro' | 'business'
  grandfathered: boolean
  review_enabled: boolean
  review_delay_hours: number
  google_review_url: string | null
  created_at: string
}

export type ServiceAddon = {
  id: string
  label: string
  price: number
  category: string
}

export type CategoryType = {
  id: string
  name: string
}

export type ServiceCategory = {
  id: string
  washer_id: string
  name: string
  types: CategoryType[]
  display_order: number
}

export type Service = {
  id: string
  washer_id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  duration_minutes: number
  vehicle_types: string[]
  vehicle_price_overrides: Record<string, number>
  addons: ServiceAddon[]
}

export type Availability = {
  id: string
  washer_id: string
  day_of_week: number
  start_time: string
  end_time: string
}

export type Booking = {
  id: string
  washer_id: string
  service_id: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  lat: number | null
  lng: number | null
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  notes: string | null
  google_calendar_event_id: string | null
  is_smart_slot: boolean
  smart_discount: number
  closed_late: boolean
  booked_price: number | null
  vehicle_count: number
  is_professional: boolean
  company_name: string | null
  siret: string | null
  billing_address: string | null
  vehicles_detail: VehicleItem[] | null
  created_at: string
}

export type Unavailability = {
  id: string
  washer_id: string
  start_date: string
  end_date: string
  label: string | null
  team_members_off: number
  created_at: string
}

export type VehicleItem = {
  type: string
  count: number
  unit_price: number
  label?: string
}

export type BookingFormData = {
  service_id: string
  vehicle_type: string
  vehicle_count: number
  booked_price: number
  is_professional: boolean
  company_name?: string
  siret?: string
  billing_address?: string
  vehicles_detail?: VehicleItem[]
  selected_addons?: ServiceAddon[]
  travel_fee?: number
  travel_fee_tiers?: { max_minutes: number; fee: number }[]
  address: string
  scheduled_at: string
  client_name: string
  client_email: string
  client_phone: string
  is_smart_slot?: boolean
  smart_discount?: number
}
