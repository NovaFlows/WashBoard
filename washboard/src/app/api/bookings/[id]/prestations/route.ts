import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { quotaReservations } from '@/lib/plan'
import { estVerrouillee, seuilsVerrouillage } from '@/lib/reservationsVerrouillees'
import { ajouterPrestation, retirerPrestation } from '@/lib/prestationsRendezVous'
import type { PrestationCatalogue } from '@/lib/plusieursPrestations'
import { sendPrestationModifiee } from '@/lib/email'
import { estReservationDeTest } from '@/lib/e2e'
import { patchCalendarEvent } from '@/lib/google-calendar'
import { rateLimit } from '@/lib/rateLimit'

// POST { service_id } : le laveur ajoute une prestation de son catalogue à un rendez-vous.
// DELETE { service_id } : il retire une prestation ajoutée (lib/prestationsRendezVous.ts).
// Réservation prise en ligne : le client est prévenu par email. Saisie par le laveur : rien.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEURE_MS = 60 * 60_000
const MAILS_PAR_RDV = 3
const MAILS_PAR_LAVEUR = 20

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return modifier(request, ctx, 'ajout')
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return modifier(request, ctx, 'retrait')
}

async function modifier(request: NextRequest, { params }: { params: Promise<{ id: string }> }, sens: 'ajout' | 'retrait') {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (errWasher) logger.error('bookings.prestations.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const body = await request.json().catch(() => null) as { service_id?: unknown } | null
  const serviceId = body?.service_id
  // Identifiant de prestation = uuid : refusé ici plutôt qu'en erreur de base.
  if (typeof serviceId !== 'string' || !UUID.test(serviceId)) {
    return NextResponse.json({ error: 'Prestation manquante.' }, { status: 400 })
  }
  if (!UUID.test(id)) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  // Même accès que PATCH /api/bookings/[id] : admin, filtré sur le laveur.
  const admin = createAdminClient()
  const { data: booking, error: errBooking } = await admin
    .from('bookings')
    .select('*, services(name, price, duration_minutes)')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .single()
  if (errBooking) logger.error('bookings.prestations.booking.read_failed', { bookingId: id }, errBooking)
  if (!booking) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  const seuils = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  if (estVerrouillee(booking, seuils)) {
    return NextResponse.json(
      { error: 'Cette réservation dépasse le quota de votre offre. Changez d’offre pour la débloquer.' },
      { status: 403 },
    )
  }

  let verdict
  if (sens === 'ajout') {
    // Relue en base, chez ce laveur seulement : ni le prix ni le nom ne viennent du navigateur.
    const { data: prestation, error: errPrestation } = await admin
      .from('services')
      .select('id, washer_id, name, price, vehicle_price_overrides, duration_minutes, vehicle_types, en_veille')
      .eq('id', serviceId)
      .eq('washer_id', washer.id)
      .maybeSingle()
    if (errPrestation) logger.error('bookings.prestations.service.read_failed', { bookingId: id }, errPrestation)
    if (!prestation) return NextResponse.json({ error: 'Prestation introuvable.' }, { status: 404 })
    verdict = ajouterPrestation(booking, prestation as PrestationCatalogue, washer.id)
  } else {
    verdict = retirerPrestation(booking, serviceId)
  }
  if (!verdict.ok) return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut })

  // Écrit seulement si rien n'a bougé depuis la lecture (deux onglets, deux appareils) : ni facture
  // émise, ni annulation, ni déplacement, ni autre changement de prix ou de prestations. Sinon la
  // seconde écriture effacerait la première, ou recalculerait la fin depuis l'ancien horaire.
  let maj = admin
    .from('bookings')
    .update(verdict.colonnes)
    .eq('id', id)
    .eq('washer_id', washer.id)
    .is('facture_numero', null)
    .neq('status', 'cancelled')
    .eq('scheduled_at', booking.scheduled_at)
  maj = booking.booked_price == null ? maj.is('booked_price', null) : maj.eq('booked_price', booking.booked_price)
  // Comparaison jsonb : couvre deux ajouts simultanés d'une prestation à 0 €, que le prix ne voit pas.
  maj = booking.selected_addons == null ? maj.is('selected_addons', null) : maj.eq('selected_addons', JSON.stringify(booking.selected_addons))
  const { data: ecrit, error } = await maj
    .select('id, booked_price, vehicles_detail, selected_addons, ends_at')
    .maybeSingle()
  if (error) {
    logger.error('bookings.prestations.update.db', { bookingId: id, washerId: washer.id }, error)
    return NextResponse.json({ error: 'La modification a échoué.' }, { status: 400 })
  }
  if (!ecrit) {
    return NextResponse.json({ error: 'Ce rendez-vous vient d’être modifié ailleurs. Rechargez la page et recommencez.' }, { status: 409 })
  }

  // Événement Google Agenda (créé à la confirmation) : la fin suit la nouvelle durée.
  const finAvant = booking.ends_at ? new Date(booking.ends_at).getTime() : NaN
  if (booking.google_calendar_event_id && washer.google_refresh_token && finAvant !== new Date(verdict.colonnes.ends_at).getTime()) {
    await patchCalendarEvent(washer.google_refresh_token, booking.google_calendar_event_id, { endIso: verdict.colonnes.ends_at })
  }

  // Email au client plafonné : des ajouts et retraits en boucle ne doivent pas inonder sa boîte,
  // ni nuire à la réputation d'envoi commune à tous les laveurs. Au-delà, la modification reste
  // faite, sans email. Compteur en mémoire : un frein par instance, pas une barrière stricte.
  const priseEnLigne = !booking.saisie_par_laveur
  let prevenir = priseEnLigne && !!booking.client_email?.trim() && verdict.ecart !== 0
  if (prevenir && (!rateLimit(`prestations-mail:${id}`, MAILS_PAR_RDV, HEURE_MS).ok || !rateLimit(`prestations-mail:w:${washer.id}`, MAILS_PAR_LAVEUR, HEURE_MS).ok)) {
    logger.warn('bookings.prestations.email_plafonne', { bookingId: id, washerId: washer.id })
    prevenir = false
  }
  if (prevenir && !estReservationDeTest(booking.client_name)) {
    await sendPrestationModifiee({
      to: booking.client_email,
      clientName: booking.client_name,
      washerName: washer.name,
      prestation: verdict.libelle,
      ajout: sens === 'ajout',
      scheduledAt: booking.scheduled_at,
      ancienPrix: verdict.ancienPrix,
      nouveauPrix: verdict.nouveauPrix,
    }).catch(e => logger.error('bookings.prestations.email_failed', { bookingId: id }, e))
  }

  logger.info('bookings.prestations', { bookingId: id, washerId: washer.id, sens, ecart: verdict.ecart })
  return NextResponse.json({ ...ecrit, client_prevenu: prevenir })
}
