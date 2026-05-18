import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, patchCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'

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
  const { status, notes } = body as { status?: string; notes?: string }

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
  if (status !== undefined) updates.status = status
  if (notes  !== undefined) updates.notes  = notes

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

      // 2. Email de confirmation Resend
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        const d   = new Date(booking.scheduled_at)
        const dateStr = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

        await resend.emails.send({
          from: `${washer.name} <onboarding@resend.dev>`,
          to:   booking.client_email,
          subject: `✅ Réservation confirmée — ${svc?.name ?? 'Lavage'} du ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
          html: buildConfirmationEmail({
            clientName:  booking.client_name,
            washerName:  washer.name,
            serviceName: svc?.name ?? 'Lavage',
            price:       svc?.price ?? 0,
            duration:    svc?.duration_minutes ?? 60,
            dateStr,
            timeStr,
            address:     booking.address,
          }),
        })
      } catch (e) {
        console.error('[Resend] email error:', e)
      }
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

// ── Template email ────────────────────────────────────────────────────────
function buildConfirmationEmail(d: {
  clientName: string; washerName: string; serviceName: string
  price: number; duration: number; dateStr: string; timeStr: string; address: string
}) {
  const row = (label: string, value: string, highlight = false) => `
    <tr>
      <td style="padding:10px 0;color:#64748b;font-size:13px;border-bottom:1px solid #d1fae5">${label}</td>
      <td style="padding:10px 0;font-size:${highlight ? '15' : '13'}px;font-weight:600;color:${highlight ? '#16a34a' : '#0f172a'};text-align:right;border-bottom:1px solid #d1fae5">${value}</td>
    </tr>`

  return `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.08)">
    <div style="text-align:center;margin-bottom:24px">
      <div style="background:#dcfce7;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:28px;margin:0 auto 12px">✅</div>
      <h1 style="color:#0f172a;font-size:22px;margin:0 0 6px">Réservation confirmée !</h1>
      <p style="color:#64748b;font-size:14px;margin:0">Bonjour ${d.clientName}, votre réservation est bien enregistrée.</p>
    </div>
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px">
      <table style="width:100%;border-collapse:collapse">
        ${row('Prestation', d.serviceName)}
        ${row('Date', d.dateStr)}
        ${row('Heure', d.timeStr)}
        ${row('Adresse', d.address)}
        ${row('Durée', `${d.duration} min`)}
        ${row('Prix', `${d.price} €`, true)}
      </table>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;margin:0">
      Des questions ? Contactez directement ${d.washerName}.
    </p>
  </div>
</body></html>`
}
