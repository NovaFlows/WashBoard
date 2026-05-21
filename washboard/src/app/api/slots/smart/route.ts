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

  if (!washer?.smart_slot_enabled) return NextResponse.json(empty)

  const config = {
    discountType:  washer.smart_slot_discount_type  as 'fixed' | 'percent',
    discountValue: washer.smart_slot_discount_value as number,
  }

  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_at, address, services(duration_minutes)')
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', new Date(`${date}T00:00:00Z`).toISOString())
    .lte('scheduled_at', new Date(`${date}T23:59:59Z`).toISOString())

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

  // Contraintes de trajet pour TOUS les RDV du jour (filtre les créneaux physiquement impossibles)
  const bookingConstraints = bookings.map((b, i) => {
    const svc      = b.services as unknown as { duration_minutes: number } | null
    const duration = svc?.duration_minutes ?? 60
    const bStart   = new Date(b.scheduled_at).getTime()
    const bEnd     = bStart + duration * 60_000
    const toNew    = dmToNew.rows[i]?.elements[0]
    const fromNew  = dmFromNew.rows[0]?.elements[i]
    return {
      start:        new Date(bStart).toISOString(),
      end:          new Date(bEnd).toISOString(),
      travelToNew:  toNew?.status   === 'OK' ? toNew.duration.value   : 0, // secondes
      travelFromNew: fromNew?.status === 'OK' ? fromNew.duration.value : 0, // secondes
    }
  })

  // Créneaux intelligents : RDV PROCHES uniquement (pour la remise)
  const WINDOW_MIN    = 90
  const radiusSeconds = (washer.smart_slot_radius_minutes ?? 15) * 60
  const smartWindows: { start: string; end: string }[] = []

  for (let i = 0; i < bookings.length; i++) {
    const toNew = dmToNew.rows[i]?.elements[0]
    if (toNew?.status !== 'OK' || toNew.duration.value > radiusSeconds) continue
    const svc      = bookings[i].services as unknown as { duration_minutes: number } | null
    const duration = svc?.duration_minutes ?? 60
    const bStart   = new Date(bookings[i].scheduled_at).getTime()
    const bEnd     = bStart + duration * 60_000
    smartWindows.push({
      start: new Date(bStart - WINDOW_MIN * 60_000).toISOString(),
      end:   new Date(bEnd   + WINDOW_MIN * 60_000).toISOString(),
    })
  }

  return NextResponse.json({
    smartWindows,
    bookingConstraints,
    discountType:  config.discountType,
    discountValue: config.discountValue,
  })
}
