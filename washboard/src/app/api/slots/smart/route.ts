import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type DmResponse = {
  status: string
  rows: { elements: { status: string; duration: { value: number } }[] }[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const washerId = searchParams.get('washer_id')
  const address  = searchParams.get('address')
  const date     = searchParams.get('date') // YYYY-MM-DD local date

  const empty = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 }

  if (!washerId || !address || !date) return NextResponse.json(empty)

  const supabase = await createClient()

  const { data: washer } = await supabase
    .from('washers')
    .select('smart_slot_enabled, smart_slot_radius_minutes, smart_slot_discount_type, smart_slot_discount_value')
    .eq('id', washerId)
    .single()

  const config = {
    discountType:  (washer?.smart_slot_discount_type  ?? 'fixed')  as 'fixed' | 'percent',
    discountValue: (washer?.smart_slot_discount_value ?? 0)        as number,
  }

  // Réservations du même jour (plage UTC couvrant la journée locale France)
  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_at, address, vehicle_count, services(duration_minutes)')
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', new Date(`${date}T00:00:00`).toISOString())
    .lte('scheduled_at', new Date(`${date}T23:59:59`).toISOString())

  // Pas de RDV ce jour → aucune contrainte de trajet
  if (!bookings?.length) return NextResponse.json({ ...empty, ...config })

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ ...empty, ...config })

  const bookingAddrs = bookings.map(b => encodeURIComponent(b.address)).join('|')
  const newAddr      = encodeURIComponent(address)
  const base         = `https://maps.googleapis.com/maps/api/distancematrix/json?mode=driving&key=${apiKey}`

  // 2 appels en parallèle : bookings→client ET client→bookings
  let dmToNew: DmResponse, dmFromNew: DmResponse
  try {
    const [r1, r2] = await Promise.all([
      fetch(`${base}&origins=${bookingAddrs}&destinations=${newAddr}`),
      fetch(`${base}&origins=${newAddr}&destinations=${bookingAddrs}`),
    ])
    ;[dmToNew, dmFromNew] = await Promise.all([r1.json(), r2.json()])
  } catch {
    return NextResponse.json({ ...empty, ...config })
  }

  if (dmToNew.status !== 'OK' || dmFromNew.status !== 'OK') {
    return NextResponse.json({ ...empty, ...config })
  }

  // Contraintes de trajet — toujours calculées (indépendant des smart slots)
  // La durée effective tient compte du vehicle_count (90 min × 2 véhicules = 180 min occupés)
  const bookingConstraints = bookings.map((b, i) => {
    const svc          = b.services as unknown as { duration_minutes: number } | null
    const durationMin  = (svc?.duration_minutes ?? 60) * Math.max(1, (b.vehicle_count ?? 1))
    const bStart       = new Date(b.scheduled_at).getTime()
    const bEnd         = bStart + durationMin * 60_000
    const toNew        = dmToNew.rows[i]?.elements[0]
    const fromNew      = dmFromNew.rows[0]?.elements[i]
    return {
      start:         new Date(bStart).toISOString(),
      end:           new Date(bEnd).toISOString(),
      travelToNew:   toNew?.status   === 'OK' ? toNew.duration.value   : 0, // secondes
      travelFromNew: fromNew?.status === 'OK' ? fromNew.duration.value : 0, // secondes
    }
  })

  // Créneaux intelligents — uniquement si le laveur a activé la fonctionnalité
  const WINDOW_MIN = 90
  const smartWindows: { start: string; end: string }[] = []

  if (washer?.smart_slot_enabled) {
    const radiusSeconds = (washer.smart_slot_radius_minutes ?? 15) * 60
    for (let i = 0; i < bookings.length; i++) {
      const toNew = dmToNew.rows[i]?.elements[0]
      if (toNew?.status !== 'OK' || toNew.duration.value > radiusSeconds) continue
      const svc         = bookings[i].services as unknown as { duration_minutes: number } | null
      const durationMin = (svc?.duration_minutes ?? 60) * Math.max(1, (bookings[i].vehicle_count ?? 1))
      const bStart      = new Date(bookings[i].scheduled_at).getTime()
      const bEnd        = bStart + durationMin * 60_000
      smartWindows.push({
        start: new Date(bStart - WINDOW_MIN * 60_000).toISOString(),
        end:   new Date(bEnd   + WINDOW_MIN * 60_000).toISOString(),
      })
    }
  }

  return NextResponse.json({
    smartWindows,
    bookingConstraints,
    discountType:  config.discountType,
    discountValue: config.discountValue,
  })
}
