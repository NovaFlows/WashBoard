import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendBookingRequest, sendWasherNotification } from '@/lib/email'
import { computeTravelFee } from '@/lib/travelFee'
import { vehiclePrice, effectiveDuration, addonsDuration } from '@/lib/pricing'
import { countConflicts, effectiveTeamSize } from '@/lib/slots'
import { rateLimit, cleanupRateLimit } from '@/lib/rateLimit'
import { withErrorHandling, errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import { z } from 'zod'

// Plafonds anti-spam (réservation publique)
const IP_LIMIT = 8           // réservations max par IP
const IP_WINDOW_MS = 10 * 60 * 1000  // sur 10 minutes
const WASHER_DAILY_CAP = 60  // réservations max par laveur et par jour

const BookingSchema = z.object({
  hp:              z.string().optional(),   // honeypot : doit rester vide
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
  notes:           z.string().max(1000).optional(),
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
    label:      z.string().optional(),
    models:     z.array(z.string()).optional(),
  })).optional(),
  selected_addons: z.array(z.object({
    id:               z.string(),
    label:            z.string(),
    price:            z.number(),
    category:         z.string(),
    duration_minutes: z.number().optional(),
  })).optional(),
  travel_fee: z.number().min(0).optional().default(0),
})

export const POST = withErrorHandling('bookings.create', async (req: Request) => {
  // ── Anti-spam #1 : rate-limit par IP ────────────────────────────────────
  cleanupRateLimit()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
    || req.headers.get('x-real-ip') || 'unknown'
  const rl = rateLimit(`book:${ip}`, IP_LIMIT, IP_WINDOW_MS)
  if (!rl.ok) {
    return Response.json(
      { error: 'Trop de réservations en peu de temps. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const body = await req.json()
  const parsed = BookingSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json(
      { error: 'Données invalides', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // ── Anti-spam #2 : honeypot (champ piège rempli uniquement par les bots) ──
  const { hp, ...cleanData } = parsed.data
  if (hp && hp.trim()) {
    // On renvoie un succès factice pour ne pas révéler le piège au bot.
    return Response.json({ data: { id: randomUUID() } }, { status: 201 })
  }

  const {
    vehicle_type, vehicle_count, is_smart_slot, smart_discount,
    booked_price: bookedPriceInput, is_professional, company_name, siret, billing_address,
    vehicles_detail, selected_addons, travel_fee,
    ...bookingData
  } = cleanData
  const id = randomUUID()

  // ── Anti-spam #3 : plafond de réservations par laveur et par jour ────────
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
  const { count: dailyCount } = await admin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('washer_id', bookingData.washer_id)
    .gte('created_at', startOfDay.toISOString())
  if ((dailyCount ?? 0) >= WASHER_DAILY_CAP) {
    return Response.json(
      { error: 'Ce prestataire a atteint sa limite de réservations pour aujourd\'hui. Réessayez demain.' },
      { status: 429 },
    )
  }

  const supabase = await createClient()

  // L'auteur est-il le laveur lui-même ? (réservation manuelle = autorisée à forcer)
  const { data: { user: authUser } } = await supabase.auth.getUser()

  // Récupérer washer + service pour l'email et le calcul du prix
  const [{ data: washer }, { data: service }] = await Promise.all([
    supabase.from('washers').select('name, phone, user_id, google_refresh_token, team_size').eq('id', bookingData.washer_id).single(),
    supabase.from('services').select('name, price, vehicle_price_overrides, duration_minutes').eq('id', bookingData.service_id).single(),
  ])

  // ── Barrière anti-double-réservation (uniquement pour le public, pas le laveur) ──
  const isOwner = !!authUser && washer?.user_id === authUser.id
  if (!isOwner && service) {
    const newStart = new Date(bookingData.scheduled_at).getTime()
    const newDur   = effectiveDuration((service.duration_minutes ?? 60) + addonsDuration(selected_addons), vehicle_count ?? 1)
    const newEnd   = newStart + newDur * 60_000
    // RDV proches : créés jusqu'à 12h avant le début (couvre les longues prestations)
    const windowStart = new Date(newStart - 12 * 60 * 60_000).toISOString()
    const [{ data: nearby }, { data: unavs }] = await Promise.all([
      admin.from('bookings')
        .select('scheduled_at, vehicle_count, selected_addons, services(duration_minutes)')
        .eq('washer_id', bookingData.washer_id)
        .neq('status', 'cancelled')
        .gte('scheduled_at', windowStart)
        .lte('scheduled_at', new Date(newEnd).toISOString()),
      admin.from('unavailabilities')
        .select('start_date, end_date, team_members_off')
        .eq('washer_id', bookingData.washer_id),
    ])
    const intervals = (nearby ?? []).map((b) => {
      const svc = b.services as { duration_minutes: number } | { duration_minutes: number }[] | null
      const dur = Array.isArray(svc) ? svc[0]?.duration_minutes : svc?.duration_minutes
      const bAddons = (b.selected_addons as { duration_minutes?: number }[] | null) ?? []
      return { startMs: new Date(b.scheduled_at).getTime(), durationMin: effectiveDuration((dur ?? 60) + addonsDuration(bAddons), b.vehicle_count) }
    })
    const conflicts = countConflicts(newStart, newEnd, intervals)
    const dateStr   = new Date(bookingData.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    const capacity  = effectiveTeamSize(washer?.team_size ?? 1, unavs ?? [], dateStr)
    if (conflicts >= capacity) {
      return Response.json(
        { error: 'Ce créneau vient d\'être réservé. Merci de choisir un autre horaire.' },
        { status: 409 },
      )
    }
  }

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
  const unit_price   = service ? vehiclePrice(service, vehicle_type) : 0
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
    return errorResponse('bookings.insert.db', error, { washerId: bookingData.washer_id })
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
        vehicleType: vehicle_type ?? undefined,
        vehicleCount: vehicle_count ?? undefined,
        vehiclesDetail: vehicles_detail ?? undefined,
        notes: bookingData.notes ?? undefined,
        selectedAddons: selected_addons ?? undefined,
      }).catch(err => logger.error('bookings.email.client_failed', { bookingId: id }, err)),
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
          vehicleType: vehicle_type ?? undefined,
          vehicleCount: vehicle_count ?? undefined,
          vehiclesDetail: vehicles_detail ?? undefined,
          notes: bookingData.notes ?? undefined,
          selectedAddons: selected_addons ?? undefined,
          address: bookingData.address,
          scheduledAt: bookingData.scheduled_at,
          bookedPrice: booked_price,
          bookingId: id,
        }).catch(err => logger.error('bookings.email.washer_failed', { bookingId: id }, err))
      )
    } else {
      logger.warn('bookings.email.washer_missing', { bookingId: id, washerUserId: washer?.user_id })
    }

    await Promise.all(emailJobs)
  }

  logger.info('bookings.created', { bookingId: id, washerId: bookingData.washer_id, bookedPrice: booked_price })
  return Response.json({ data: { id } }, { status: 201 })
})
