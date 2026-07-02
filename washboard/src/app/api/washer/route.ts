import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { ZoneConfig } from '@/types'

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const {
    name, phone, slug, logo_url, welcome_message, brand_color, team_size,
    smart_slot_enabled, smart_slot_radius_minutes, smart_slot_discount_type, smart_slot_discount_value,
    travel_fee_tiers, base_address, travel_fee_mode, background_theme, website_url, google_place_id,
    review_enabled, review_delay_hours, google_review_url, sms_sender,
    zone_config,
  } = await request.json()

  // ── Validations ──────────────────────────────────────────────────────────
  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: "Le nom de l'entreprise est requis" }, { status: 400 })
  }
  if (phone !== undefined && String(phone).trim() && !/^[+0-9 ().-]{6,20}$/.test(String(phone).trim())) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  // Slug personnalisé : format strict + unicité
  if (slug !== undefined) {
    const s = String(slug).trim().toLowerCase()
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(s)) {
      return NextResponse.json({ error: 'Lien invalide : 3 à 40 caractères, lettres minuscules, chiffres et tirets uniquement (sans tiret au début/fin).' }, { status: 400 })
    }
    const { data: taken } = await supabase
      .from('washers').select('id').eq('slug', s).neq('user_id', user.id).maybeSingle()
    if (taken) {
      return NextResponse.json({ error: 'Ce lien est déjà utilisé. Choisissez-en un autre.' }, { status: 409 })
    }
    updates.slug = s
  }

  if (name !== undefined) updates.name = String(name).trim()
  if (phone !== undefined) updates.phone = phone?.trim() || null
  if (logo_url !== undefined) updates.logo_url = logo_url?.trim() || null
  if (welcome_message !== undefined) updates.welcome_message = welcome_message?.trim() || null
  if (brand_color !== undefined) updates.brand_color = brand_color || null
  if (team_size !== undefined) updates.team_size = Math.min(50, Math.max(1, Math.floor(Number(team_size)) || 1))
  if (smart_slot_enabled !== undefined) updates.smart_slot_enabled = Boolean(smart_slot_enabled)
  if (smart_slot_radius_minutes !== undefined) updates.smart_slot_radius_minutes = Math.min(60, Math.max(5, Number(smart_slot_radius_minutes)))
  if (smart_slot_discount_type !== undefined) updates.smart_slot_discount_type = smart_slot_discount_type
  if (smart_slot_discount_value !== undefined) updates.smart_slot_discount_value = Math.max(0, Number(smart_slot_discount_value))
  if (travel_fee_tiers !== undefined) {
    // Ne conserver que les paliers cohérents (durée > 0, frais >= 0)
    updates.travel_fee_tiers = Array.isArray(travel_fee_tiers)
      ? travel_fee_tiers.filter((t: { max_minutes: number; fee: number }) =>
          Number(t?.max_minutes) > 0 && Number.isFinite(Number(t?.fee)) && Number(t?.fee) >= 0)
      : []
  }
  if (base_address !== undefined) updates.base_address = base_address?.trim() || null
  if (travel_fee_mode !== undefined) updates.travel_fee_mode = travel_fee_mode
  if (background_theme !== undefined) updates.background_theme = background_theme || null
  if (website_url !== undefined) updates.website_url = website_url?.trim() || null
  if (google_place_id !== undefined) updates.google_place_id = google_place_id?.trim() || null
  if (review_enabled !== undefined) updates.review_enabled = Boolean(review_enabled)
  if (review_delay_hours !== undefined) updates.review_delay_hours = Math.min(168, Math.max(0, Math.floor(Number(review_delay_hours)) || 0))
  if (google_review_url !== undefined) updates.google_review_url = google_review_url?.trim() || null
  if (sms_sender !== undefined) updates.sms_sender = sms_sender?.trim().slice(0, 20) || null

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
