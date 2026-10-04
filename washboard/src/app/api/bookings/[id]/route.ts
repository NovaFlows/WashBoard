import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCalendarEvent, patchCalendarEvent, deleteCalendarEvent } from '@/lib/google-calendar'
import { sendBookingConfirmation, sendFacture } from '@/lib/email'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { emettreFacture } from '@/lib/emettreFacture'
import { doitEnvoyerFactureAuClient } from '@/lib/facture'
import { quotaReservations } from '@/lib/plan'
import { estVerrouillee, seuilsVerrouillage } from '@/lib/reservationsVerrouillees'
import { genererJetonReservation } from '@/lib/bookingToken'

const VALID_STATUSES = ['pending', 'confirmed', 'done', 'cancelled']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()

  if (errWasher) logger.error('bookings.id.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const body = await request.json()
  const { status, notes, closed_late, scheduled_at } = body as { status?: string; notes?: string; closed_late?: boolean; scheduled_at?: string }

  if (status && !VALID_STATUSES.includes(status))
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })

  if (scheduled_at !== undefined && isNaN(new Date(scheduled_at).getTime()))
    return NextResponse.json({ error: 'Date invalide' }, { status: 400 })

  // La session a servi à savoir QUI écrit. La réservation, elle, se lit et
  // s'écrit par l'admin : `authenticated` n'a plus de droit direct sur
  // `bookings` (un laveur y écrivait `saisie_par_laveur` pour déverrouiller une
  // réservation hors quota). Chaque requête ci-dessous porte donc son filtre
  // `washer_id` — sans RLS, c'est la seule barrière entre laveurs.
  const admin = createAdminClient()

  // Récupérer la réservation courante + service
  const { data: booking, error: errBooking } = await admin
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .single()
  if (errBooking) logger.error('bookings.id.booking.read_failed', {}, errBooking)

  if (!booking) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  // Une réservation annulée l'est pour de bon : aucun écran ne propose de
  // revenir en arrière (vérifié dans tout le dashboard, 2026-10-04). Sans ce
  // garde-fou, annuler une réservation DANS le quota puis la repasser en
  // "pending" la sortait un instant du compte de la période — assez pour
  // déverrouiller en clair la réservation suivante, la confirmer, et annuler
  // l'opération une fois fait : deux appels, aucune trace. Trouvé par `cyber`
  // le 2026-10-02, tranché par Ryan le 2026-10-04 (rendre `cancelled`
  // définitif plutôt que de compter les annulations dans le quota, qui
  // pénaliserait un laveur pour une annulation faite par son CLIENT).
  if (booking.status === 'cancelled' && status !== undefined && status !== 'cancelled') {
    return NextResponse.json({ error: 'Une réservation annulée ne peut plus changer de statut.' }, { status: 409 })
  }

  // Une réservation verrouillée (au-delà du quota de l'offre) ne peut pas être
  // modifiée par ce chemin : la réponse renvoie la ligne complète en clair, et
  // confirmer créerait l'événement Google Agenda avec le vrai nom — deux fuites
  // qui videraient `masquerVerrouillees` de son sens. Aucun écran ne mène ici
  // pour une réservation verrouillée (`BookingList` affiche `CarteVerrouillee`
  // à la place, sans bouton d'action) : n'importe quelle requête qui l'atteint
  // quand même n'a rien de légitime à y faire.
  const seuils = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  if (estVerrouillee(booking, seuils)) {
    return NextResponse.json(
      { error: 'Cette réservation dépasse le quota de votre offre. Changez d’offre pour la débloquer.' },
      { status: 403 },
    )
  }

  // Mettre à jour le statut / les notes / l'horaire
  const updates: Record<string, unknown> = {}
  if (status       !== undefined) updates.status       = status
  if (notes        !== undefined) updates.notes        = notes
  if (closed_late  !== undefined) updates.closed_late  = closed_late
  if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at

  const { data: updated, error } = await admin
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('washer_id', washer.id)
    .select()
    .single()

  if (error) {
    // Le message de Postgres décrivait la contrainte ou la colonne fautive :
    // utile dans les journaux, pas dans une réponse HTTP.
    logger.error('bookings.id.update.db', { bookingId: id, washerId: washer.id }, error)
    return NextResponse.json({ error: 'La modification a échoué.' }, { status: 400 })
  }

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
          // Sans cet id, l'annulation ne retrouvera pas l'événement à supprimer.
          const { error: errEvent } = await admin
            .from('bookings')
            .update({ google_calendar_event_id: eventId })
            .eq('id', id)
            .eq('washer_id', washer.id)
          if (errEvent) logger.error('bookings.id.calendar_event_id.write_failed', { bookingId: id }, errEvent)
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
        jeton:         genererJetonReservation(booking.id),
      }).catch(e => logger.error('bookings.update.email_failed', { bookingId: id }, e))
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
      // Sans cette date, le cron ne demandera jamais l'avis.
      const { error: errAvis } = await admin
        .from('bookings')
        .update({ review_request_at: new Date(Date.now() + delayMs).toISOString() })
        .eq('id', id)
        .eq('washer_id', washer.id)
      if (errAvis) logger.error('bookings.id.review_request_at.write_failed', { bookingId: id }, errAvis)
    }

    if (status === 'cancelled' && booking.google_calendar_event_id && washer.google_refresh_token) {
      await deleteCalendarEvent(washer.google_refresh_token, booking.google_calendar_event_id)
    }
  }

  // ── Facture : émise dès que la prestation est terminée ──────────────────
  //
  // Seulement si le laveur a rempli ses informations de facturation. Jamais
  // bloquant pour le changement de statut : sans facture, il l'émet plus tard
  // depuis le détail du rendez-vous (POST /api/bookings/[id]/facture).
  let factureNumero: string | null = null
  if (status === 'done' && booking.status !== 'done') {
    const facture = await emettreFacture(admin, id)
    if (facture.ok) {
      factureNumero = facture.numero
      // Même règle que l'émission à la demande (POST .../facture) : elle vit
      // dans `doitEnvoyerFactureAuClient`, pour que les deux chemins ne
      // puissent plus diverger.
      if (doitEnvoyerFactureAuClient(booking, facture)) {
        await sendFacture({
          to: booking.client_email,
          clientName: booking.client_name,
          washerName: washer.name,
          numero: facture.numero,
          bookingId: id,
          jeton: genererJetonReservation(id),
        }).catch(e => logger.error('facture.email_failed', { bookingId: id }, e))
      }
    }
  }

  return NextResponse.json({ ...updated, ...(factureNumero ? { facture_numero: factureNumero } : {}) })
}

