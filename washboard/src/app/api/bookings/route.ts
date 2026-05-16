import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const BookingSchema = z.object({
  washer_id: z.string().uuid(),
  service_id: z.string().uuid(),
  vehicle_type: z.string().min(1),
  address: z.string().min(5),
  scheduled_at: z.string().datetime(),
  client_name: z.string().min(2),
  client_email: z.string().email(),
  client_phone: z.string().min(10),
})

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = BookingSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { vehicle_type, ...bookingData } = parsed.data
  const id = randomUUID()

  const supabase = await createClient()
  const { error } = await supabase
    .from('bookings')
    .insert({ id, ...bookingData })

  if (error) {
    console.error('Booking insert error:', error)
    return Response.json({ error: 'Erreur lors de la réservation' }, { status: 500 })
  }

  return Response.json({ data: { id } }, { status: 201 })
}
