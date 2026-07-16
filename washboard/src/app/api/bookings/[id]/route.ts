import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, patchCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'
import { sendBookingConfirmation } from '@/lib/email'

const VALID_STATUSES = ['pending', 'confirmed', 'done', 'cancelled']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const body = await request.json()
  const { status, notes, closed_late, scheduled_at } = body as { status?: string; notes?: string; closed_late?: boolean; scheduled_at?: string }

  if (status && !VALID_STATUSES.includes(status))
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })

  if (scheduled_at !== undefined && isNaN(new Date(scheduled_at).getTime()))
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })

  // Récupérer la réservation courante + service
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  // Mettre à jour le statut / les notes / l'horaire
  const updates: Record<string, unknown> = {}
  if (status       !== undefined) updates.status       = status
  if (notes        !== undefined) updates.notes        = notes
  if (closed_late  !== undefined) updates.closed_late  = closed_late
  if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at

  const { data: updated, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('washer_id', washer.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const vehicleCount = Math.max(1, booking.vehicle_count ?? 1)

  // ── Déplacement d'horaire : mettre à jour l'événement Google Calendar ────
  if (scheduled_at !== undefined && scheduled_at !== booking.scheduled_at
      && booking.google_calendar_event_id && washer.google_refresh_token) {
    const svc = booking.services as { duration_minutes: number } | null
    const newEndIso = new Date(
      new Date(scheduled_at).getTime() + (svc?.duration_minutes ?? 60) * vehicleCount * 60_000
    ).toISOString()
    await patchCalendarEvent(washer.google_refresh_token, booking.google_calendar_event_id, {
      startIso: scheduled_at,
      endIso:   newEndIso,
    })
  }

  // ── Opérations asynchrones (Google Calendar + email) ────────────────────
  if (status && status !== booking.status) {
    const svc = booking.services as { name: string; price: number; duration_minutes: number } | null
    const endIso = new Date(
      new Date(booking.scheduled_at).getTime() + (svc?.duration_minutes ?? 60) * vehicleCount * 60_000
    ).toISOString()

    const eventTitle = `🚗 ${svc?.name ?? 'Lavage'} — ${booking.client_name}`

    if (status === 'confirmed') {
      // 1. Créer l'événement Google Calendar
      if (washer.google_refresh_token) {
        const eventId = await createCalendarEvent(washer.google_refresh_token, {
          summary: eventTitle,
          description: [
            `Client : ${booking.client_name}`,
            `Tél : ${booking.client_phone}`,
            `Email : ${booking.client_email}`,
            svc ? `Prix : ${svc.price} €` : '',
          ].filter(Boolean).join('\n'),
          location: booking.address,
          startIso: booking.scheduled_at,
          endIso,
        }, washer.id)
        if (eventId) {
          await supabase
            .from('bookings')
            .update({ google_calendar_event_id: eventId })
            .eq('id', id)
        }
      }

      // 2. Email reçu professionnel
      sendBookingConfirmation({
        to:            booking.client_email,
        clientName:    booking.client_name,
        clientEmail:   booking.client_email,
        washerName:    washer.name,
        washerPhone:   washer.phone ?? null,
        serviceName:   svc?.name ?? 'Lavage',
        vehicleType:    booking.vehicle_type ?? undefined,
        vehicleCount:   booking.vehicle_count ?? undefined,
        vehiclesDetail: (booking.vehicles_detail as import('@/types').VehicleItem[] | null) ?? undefined,
        notes:          booking.notes ?? undefined,
        servicePrice:  Number(booking.booked_price ?? svc?.price ?? 0),
        isSmartSlot:   booking.is_smart_slot,
        smartDiscount: Number(booking.smart_discount ?? 0),
        address:       booking.address,
        scheduledAt:   booking.scheduled_at,
        bookingId:     booking.id,
      }).catch(e => console.error('[Resend] email error:', e))
    }

    if (status === 'done' && booking.google_calendar_event_id && washer.google_refresh_token) {
      await patchCalendarEvent(washer.google_refresh_token, booking.google_calendar_event_id, {
        summary: `✅ Terminé — ${eventTitle}`,
      })
    }

    // Suivi client : planifier la demande d'avis Google (envoi différé par le cron)
    if (status === 'done' && washer.review_enabled && washer.google_review_url
        && booking.client_email && !booking.review_request_sent_at) {
      const delayMs = Math.max(0, Number(washer.review_delay_hours ?? 3)) * 3_600_000
      await supabase
        .from('bookings')
        .update({ review_request_at: new Date(Date.now() + delayMs).toISOString() })
        .eq('id', id)
    }

    if (status === 'cancelled' && booking.google_calendar_event_id && washer.google_refresh_token) {
      await deleteCalendarEvent(washer.google_refresh_token, booking.google_calendar_event_id)
    }
  }

  return NextResponse.json(updated)
}

