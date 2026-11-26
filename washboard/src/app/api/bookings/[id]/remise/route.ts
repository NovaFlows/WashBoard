import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { quotaReservations } from '@/lib/plan'
import { estVerrouillee, seuilsVerrouillage } from '@/lib/reservationsVerrouillees'
import { appliquerRemiseLaveur } from '@/lib/remiseLaveur'
import { sendRemiseLaveur } from '@/lib/email'
import { estReservationDeTest } from '@/lib/e2e'
import { lireFuseauLaveur } from '@/lib/fuseauLaveur'

// POST { prix } : le laveur baisse le prix d'un rendez-vous (lib/remiseLaveur.ts).
// Réservation prise en ligne : le client est prévenu par email. Saisie par le laveur : rien.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('*').eq('user_id', user.id).single()
  if (errWasher) logger.error('bookings.remise.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const body = await request.json().catch(() => null) as { prix?: unknown } | null
  if (!body || body.prix === undefined) return NextResponse.json({ error: 'Prix manquant.' }, { status: 400 })

  // Même accès que PATCH /api/bookings/[id] : admin, filtré sur le laveur.
  const admin = createAdminClient()
  const { data: booking, error: errBooking } = await admin
    .from('bookings')
    .select('*, services(name, price)')
    .eq('id', id)
    .eq('washer_id', washer.id)
    .single()
  if (errBooking) logger.error('bookings.remise.booking.read_failed', { bookingId: id }, errBooking)
  if (!booking) return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })

  const seuils = await seuilsVerrouillage(admin, washer, quotaReservations(washer))
  if (estVerrouillee(booking, seuils)) {
    return NextResponse.json(
      { error: 'Cette réservation dépasse le quota de votre offre. Changez d’offre pour la débloquer.' },
      { status: 403 },
    )
  }

  const verdict = appliquerRemiseLaveur(booking, body.prix)
  if (!verdict.ok) return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut })

  // `facture_numero` nul dans le filtre : une facture émise entre la lecture et l'écriture
  // n'est pas réécrite.
  const { data: maj, error } = await admin
    .from('bookings')
    .update(verdict.colonnes)
    .eq('id', id)
    .eq('washer_id', washer.id)
    .is('facture_numero', null)
    .select('id, booked_price, remise_laveur')
    .maybeSingle()
  if (error) {
    logger.error('bookings.remise.update.db', { bookingId: id, washerId: washer.id }, error)
    return NextResponse.json({ error: 'La modification a échoué.' }, { status: 400 })
  }
  if (!maj) return NextResponse.json({ error: 'La facture est déjà émise : le prix ne peut plus changer.' }, { status: 409 })

  const priseEnLigne = !booking.saisie_par_laveur
  if (priseEnLigne && booking.client_email?.trim() && !estReservationDeTest(booking.client_name)) {
    const svc = booking.services as { name?: string } | null
    await sendRemiseLaveur({
      to: booking.client_email,
      clientName: booking.client_name,
      washerName: washer.name,
      serviceName: svc?.name ?? 'Lavage',
      scheduledAt: booking.scheduled_at,
      fuseau: await lireFuseauLaveur(admin, washer.id),
      ancienPrix: verdict.ancienPrix,
      nouveauPrix: verdict.nouveauPrix,
    }).catch(e => logger.error('bookings.remise.email_failed', { bookingId: id }, e))
  }

  logger.info('bookings.remise', { bookingId: id, washerId: washer.id, remise: verdict.ancienPrix - verdict.nouveauPrix })
  return NextResponse.json({ ...maj, client_prevenu: priseEnLigne && !!booking.client_email?.trim() })
}
