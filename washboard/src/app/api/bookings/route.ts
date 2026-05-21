import { createClient } from '@/lib/supabase/server'
import { sendBookingRequest } from '@/lib/email'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const BookingSchema = z.object({
  washer_id:       z.string().uuid(),
  service_id:      z.string().uuid(),
  vehicle_type:    z.string().min(1),
  vehicle_count:   z.number().int().min(1).max(99).optional().default(1),
  booked_price:    z.number().min(0).optional(),
  address:         z.string().min(5),
  scheduled_at:    z.string().datetime(),
  client_name:     z.string().min(2),
  client_email:    z.string().email(),
  client_phone:    z.string().min(10),
  is_smart_slot:   z.boolean().optional().default(false),
  smart_discount:  z.number().min(0).optional().default(0),
  is_professional: z.boolean().optional().default(false),
  company_name:    z.string().optional(),
  siret:           z.string().regex(/^\d{14}$/, 'SIRET invalide').optional(),
  billing_address: z.string().optional(),
  vehicles_detail: z.array(z.object({
    type:       z.string(),
    count:      z.number().int().min(1),
    unit_price: z.number().min(0),
  })).optional(),
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

  const {
    vehicle_type, vehicle_count, is_smart_slot, smart_discount,
    booked_price: bookedPriceInput, is_professional, company_name, siret, billing_address,
    vehicles_detail,
    ...bookingData
  } = parsed.data
  const id = randomUUID()

  const supabase = await createClient()

  // Récupérer washer + service pour l'email et le calcul du prix
  const [{ data: washer }, { data: service }] = await Promise.all([
    supabase.from('washers').select('name, phone').eq('id', bookingData.washer_id).single(),
    supabase.from('services').select('name, price, vehicle_price_overrides').eq('id', bookingData.service_id).single(),
  ])

  // Prix effectif : prix unitaire × quantité
  const overrides    = (service?.vehicle_price_overrides ?? {}) as Record<string, number>
  const unit_price   = overrides[vehicle_type] ?? service?.price ?? 0
  const count        = vehicle_count ?? 1
  const booked_price = bookedPriceInput ?? unit_price * count

  const { error } = await supabase
    .from('bookings')
    .insert({
      id, ...bookingData,
      is_smart_slot:   is_smart_slot ?? false,
      smart_discount:  smart_discount ?? 0,
      booked_price,
      vehicle_count:   count,
      is_professional: is_professional ?? false,
      company_name:    company_name ?? null,
      siret:           siret ?? null,
      billing_address: billing_address ?? null,
      vehicles_detail: vehicles_detail ?? null,
    })

  if (error) {
    console.error('Booking insert error:', error)
    return Response.json({ error: 'Erreur lors de la réservation' }, { status: 500 })
  }

  // Envoi email en arrière-plan — ne bloque pas la réponse
  if (washer && service) {
    sendBookingRequest({
      to: bookingData.client_email,
      clientName: bookingData.client_name,
      washerName: washer.name,
      serviceName: service.name,
      servicePrice: booked_price,
      isSmartSlot: is_smart_slot,
      smartDiscount: smart_discount,
      address: bookingData.address,
      scheduledAt: bookingData.scheduled_at,
      bookingId: id,
    }).catch(err => console.error('Email send error:', err))
  }

  return Response.json({ data: { id } }, { status: 201 })
}
