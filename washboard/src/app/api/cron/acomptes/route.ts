import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron, parseTestMode, createAdminClient } from '@/lib/cronRequest'
import { notifierLaveur } from '@/lib/push'
import { sendAnnulationAcompte } from '@/lib/email'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import { logger } from '@/lib/logger'

// Annule les réservations dont l'acompte n'a pas été réglé à temps (lib/acompte.ts) : le
// laveur a choisi un délai, le client l'a lu avant de réserver.
//
// Seulement les réservations encore « en attente » : un laveur qui a CONFIRMÉ le rendez-vous
// sans avoir reçu l'acompte a fait son choix, on ne le défait pas à sa place (et l'événement
// de son agenda Google resterait orphelin).
//
// Planification : cron-job.org, toutes les 15 minutes. Mode test : ?test=1&washer=<id>.
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const test = parseTestMode(request)
  if ('error' in test) return NextResponse.json({ error: test.error }, { status: 400 })

  const admin = createAdminClient()
  const maintenant = new Date().toISOString()

  let requete = admin
    .from('bookings')
    .select('id, washer_id, client_name, client_email, scheduled_at, acompte_montant')
    .eq('acompte_statut', 'en_attente')
    .eq('status', 'pending')
    .lt('acompte_echeance', maintenant)
    .limit(200)
  if (test.enabled) requete = requete.eq('washer_id', test.washerId)
  const { data: expirees, error } = await requete

  if (error) {
    if (migrationEnAttente(error)) return NextResponse.json({ ok: true, annulees: 0, enAttente: true })
    logger.error('cron.acomptes.read_failed', {}, error)
    return NextResponse.json({ ok: false, error: 'Lecture impossible' }, { status: 500 })
  }

  let annulees = 0
  let echecs = 0
  for (const b of expirees ?? []) {
    // Les filtres sont redits à l'écriture : un acompte marqué reçu entre la lecture et
    // maintenant ne doit pas faire annuler le rendez-vous.
    const { data: maj, error: errMaj } = await admin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', b.id)
      .eq('status', 'pending')
      .eq('acompte_statut', 'en_attente')
      .select('id')
    if (errMaj) { echecs++; logger.error('cron.acomptes.cancel_failed', { bookingId: b.id }, errMaj); continue }
    if (!maj?.length) continue
    annulees++

    const { data: laveur } = await admin.from('washers').select('name').eq('id', b.washer_id).maybeSingle()
    await notifierLaveur(b.washer_id, {
      title: 'Réservation annulée',
      body: `${b.client_name} n’a pas réglé l’acompte à temps : la réservation est annulée et le créneau libéré.`,
      url: '/dashboard/calendrier',
      tag: `acompte-${b.id}`,
    })
    if (b.client_email) {
      await sendAnnulationAcompte({
        to: b.client_email, clientName: b.client_name, washerName: (laveur?.name as string | undefined) ?? 'Votre laveur', scheduledAt: b.scheduled_at,
      }).catch(e => logger.error('cron.acomptes.email_failed', { bookingId: b.id }, e))
    }
  }

  logger.info('cron.acomptes.done', { annulees, echecs })
  return NextResponse.json({ ok: echecs === 0, annulees, echecs })
}
