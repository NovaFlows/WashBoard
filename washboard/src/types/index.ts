export type Washer = {
  id: string
  user_id: string | null
  name: string
  slug: string
  phone: string | null
  logo_url: string | null
  welcome_message: string | null
  brand_color: string | null
  zone_config: Record<string, unknown>
  google_refresh_token: string | null
  team_size: number
  created_at: string
}

export type Service = {
  id: string
  washer_id: string
  name: string
  price: number
  duration_minutes: number
  vehicle_types: string[]
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
  created_at: string
}

export type BookingFormData = {
  service_id: string
  vehicle_type: string
  address: string
  scheduled_at: string
  client_name: string
  client_email: string
  client_phone: string
}
