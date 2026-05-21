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
  const { status, notes, closed_late } = body as { status?: string; notes?: string; closed_late?: boolean }

  if (status && !VALID_STATUSES.includes(status))
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })

  // Récupérer la réservation courante + service
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .single()

  if (!booking) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  // Mettre à jour le statut / les notes
  const updates: Record<string, unknown> = {}
  if (status      !== undefined) updates.status      = status
  if (notes       !== undefined) updates.notes       = notes
  if (closed_late !== undefined) updates.closed_late = closed_late

  const { data: updated, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('washer_id', washer.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // ── Opérations asynchrones (Google Calendar + email) ────────────────────
  if (status && status !== booking.status) {
    const svc = booking.services as { name: string; price: number; duration_minutes: number } | null
    const endIso = new Date(
      new Date(booking.scheduled_at).getTime() + (svc?.duration_minutes ?? 60) * 60_000
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
        })
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

    if (status === 'cancelled' && booking.google_calendar_event_id && washer.google_refresh_token) {
      await deleteCalendarEvent(washer.google_refresh_token, booking.google_calendar_event_id)
    }
  }

  return NextResponse.json(updated)
}

