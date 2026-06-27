import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendBookingRequest, sendWasherNotification } from '@/lib/email'
import { computeTravelFee } from '@/lib/travelFee'
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
  selected_addons: z.array(z.object({
    id:       z.string(),
    label:    z.string(),
    price:    z.number(),
    category: z.string(),
  })).optional(),
  travel_fee: z.number().min(0).optional().default(0),
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
    vehicles_detail, selected_addons, travel_fee,
    ...bookingData
  } = parsed.data
  const id = randomUUID()

  const supabase = await createClient()

  // Récupérer washer + service pour l'email et le calcul du prix
  const [{ data: washer }, { data: service }] = await Promise.all([
    supabase.from('washers').select('name, phone, user_id, google_refresh_token').eq('id', bookingData.washer_id).single(),
    supabase.from('services').select('name, price, vehicle_price_overrides, duration_minutes').eq('id', bookingData.service_id).single(),
  ])

  // Récupérer l'email du laveur via le service role (auth.users)
  let washerEmail: string | null = null
  if (washer?.user_id) {
    try {
      const admin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      const { data: { user: washerUser } } = await admin.auth.admin.getUserById(washer.user_id)
      washerEmail = washerUser?.email ?? null
    } catch { /* pas bloquant */ }
  }

  // Calcul des frais de déplacement (mode base ou RDV précédent)
  const computed_travel_fee = bookingData.address
    ? await computeTravelFee(supabase, bookingData.washer_id, bookingData.address, bookingData.scheduled_at)
    : (travel_fee ?? 0)

  // Prix effectif : base (service + options) + frais de déplacement
  const overrides    = (service?.vehicle_price_overrides ?? {}) as Record<string, number>
  const unit_price   = overrides[vehicle_type] ?? service?.price ?? 0
  const count        = vehicle_count ?? 1
  const base_price   = bookedPriceInput ?? (unit_price * count)
  const booked_price = base_price + computed_travel_fee

  // L'événement Google Agenda est créé uniquement à la confirmation du RDV
  // (voir PATCH /api/bookings/[id] quand status passe à 'confirmed'),
  // pas à la création — les RDV en attente ne sont pas ajoutés à l'agenda.

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
      vehicles_detail:  vehicles_detail ?? null,
      selected_addons:  selected_addons ?? [],
      travel_fee:       computed_travel_fee,
    })

  if (error) {
    console.error('Booking insert error:', error)
    return Response.json({ error: 'Erreur lors de la réservation' }, { status: 500 })
  }

  // Envoi emails (awaités — Vercel coupe les fire-and-forget avant qu'ils partent)
  if (washer && service) {
    const emailJobs: Promise<unknown>[] = [
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
      }).catch(err => console.error('[email/client]', err)),
    ]

    if (washerEmail) {
      emailJobs.push(
        sendWasherNotification({
          to: washerEmail,
          washerName: washer.name,
          clientName: bookingData.client_name,
          clientEmail: bookingData.client_email,
          clientPhone: bookingData.client_phone,
          serviceName: service.name,
          address: bookingData.address,
          scheduledAt: bookingData.scheduled_at,
          bookedPrice: booked_price,
          bookingId: id,
        }).catch(err => console.error('[email/washer]', err))
      )
    } else {
      console.warn('[email/washer] washerEmail null, notification non envoyée — washer.user_id:', washer?.user_id)
    }

    await Promise.all(emailJobs)
  }

  return Response.json({ data: { id } }, { status: 201 })
}
