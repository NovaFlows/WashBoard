import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const washerId = searchParams.get('washer_id')
  const address  = searchParams.get('address')
  const date     = searchParams.get('date') // YYYY-MM-DD

  const empty = { smartSlots: [], discountType: 'fixed', discountValue: 0 }

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

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd   = new Date(`${date}T23:59:59`)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_at, address, services(duration_minutes)')
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', dayStart.toISOString())
    .lte('scheduled_at', dayEnd.toISOString())

  if (!bookings?.length) return NextResponse.json({ ...empty, ...config })

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ ...empty, ...config })

  // Appel Distance Matrix : bookings → adresse client
  const origins      = bookings.map(b => encodeURIComponent(b.address)).join('|')
  const destination  = encodeURIComponent(address)
  const dmUrl        = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destination}&mode=driving&key=${apiKey}`

  let dmData: { status: string; rows: { elements: { status: string; duration: { value: number } }[] }[] }
  try {
    const dmRes = await fetch(dmUrl)
    dmData = await dmRes.json()
  } catch {
    return NextResponse.json({ ...empty, ...config })
  }

  if (dmData.status !== 'OK') return NextResponse.json({ ...empty, ...config })

  const radiusSeconds = (washer.smart_slot_radius_minutes ?? 15) * 60
  const nearbyBookings: typeof bookings = []
  dmData.rows.forEach((row, i) => {
    const el = row.elements[0]
    if (el.status === 'OK' && el.duration.value <= radiusSeconds) {
      nearbyBookings.push(bookings[i])
    }
  })

  if (!nearbyBookings.length) return NextResponse.json({ ...empty, ...config })

  // Générer les créneaux intelligents : ±90 min autour des RDV proches
  const WINDOW_MIN = 90
  const smartSet   = new Set<string>()

  for (const booking of nearbyBookings) {
    const bStart    = new Date(booking.scheduled_at)
    const svc = booking.services as unknown as { duration_minutes: number } | null
    const duration  = svc?.duration_minutes ?? 60
    const bEnd      = new Date(bStart.getTime() + duration * 60_000)
    const winStart  = new Date(bStart.getTime() - WINDOW_MIN * 60_000)
    const winEnd    = new Date(bEnd.getTime()   + WINDOW_MIN * 60_000)

    // Itérer par tranches de 15 min dans la fenêtre
    const t = new Date(winStart)
    t.setSeconds(0, 0)
    t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15)

    while (t <= winEnd) {
      const h = t.getHours().toString().padStart(2, '0')
      const m = t.getMinutes().toString().padStart(2, '0')
      smartSet.add(`${h}:${m}`)
      t.setMinutes(t.getMinutes() + 15)
    }
  }

  return NextResponse.json({
    smartSlots:    Array.from(smartSet),
    discountType:  config.discountType,
    discountValue: config.discountValue,
  })
}
