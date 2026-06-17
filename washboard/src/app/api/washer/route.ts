import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { ZoneConfig } from '@/types'

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const {
    name, phone, logo_url, welcome_message, brand_color, team_size,
    smart_slot_enabled, smart_slot_radius_minutes, smart_slot_discount_type, smart_slot_discount_value,
    travel_fee,
    zone_config,
  } = await request.json()

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name?.trim() ?? null
  if (phone !== undefined) updates.phone = phone?.trim() || null
  if (logo_url !== undefined) updates.logo_url = logo_url?.trim() || null
  if (welcome_message !== undefined) updates.welcome_message = welcome_message?.trim() || null
  if (brand_color !== undefined) updates.brand_color = brand_color || null
  if (team_size !== undefined) updates.team_size = Math.max(1, Math.floor(Number(team_size)))
  if (smart_slot_enabled !== undefined) updates.smart_slot_enabled = Boolean(smart_slot_enabled)
  if (smart_slot_radius_minutes !== undefined) updates.smart_slot_radius_minutes = Math.min(60, Math.max(5, Number(smart_slot_radius_minutes)))
  if (smart_slot_discount_type !== undefined) updates.smart_slot_discount_type = smart_slot_discount_type
  if (smart_slot_discount_value !== undefined) updates.smart_slot_discount_value = Math.max(0, Number(smart_slot_discount_value))
  if (travel_fee !== undefined) updates.travel_fee = Math.max(0, Number(travel_fee))

  if (zone_config !== undefined) {
    let config = zone_config as ZoneConfig
    // Pour le mode vol d'oiseau, géocoder l'adresse de base une seule fois à la sauvegarde
    if (config?.enabled && config.type === 'crow' && config.center_address) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (apiKey) {
        try {
          const url  = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(config.center_address)}&key=${apiKey}`
          const data = await (await fetch(url)).json()
          const loc  = data.results?.[0]?.geometry?.location
          if (loc) config = { ...config, center_lat: loc.lat, center_lng: loc.lng }
        } catch { /* geocoding facultatif */ }
      }
    }
    updates.zone_config = config
  }

  const { error } = await supabase
    .from('washers')
    .update(updates)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
