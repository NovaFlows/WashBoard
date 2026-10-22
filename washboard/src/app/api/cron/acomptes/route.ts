import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron, parseTestMode, createAdminClient } from '@/lib/cronRequest'
import { notifierLaveur } from '@/lib/push'
import { sendAnnulationAcompte, sendRappelAcompte } from '@/lib/email'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import { ReglagesAcompteSchema, AVANCE_MAX_RAPPEL_MS, liensDePaiement, rappelAcompteDu, virementPour, weroPour, type ReglagesAcompte } from '@/lib/acompte'
import { SITE_URL_FALLBACK } from '@/lib/plan'
import { logger } from '@/lib/logger'

// Annule les réservations dont l'acompte n'a pas été réglé à temps (lib/acompte.ts) : le
// laveur a choisi un délai, le client l'a lu avant de réserver. Avant l'échéance, le client
// reçoit un rappel, une seule fois (`rappelAcompteDu`).
//
// Seulement les réservations encore « en attente » : un laveur qui a CONFIRMÉ le rendez-vous
// sans avoir reçu l'acompte a fait son choix, on ne le défait pas à sa place (et l'événement
// de son agenda Google resterait orphelin).
//
// Planification : cron-job.org, toutes les 15 minutes. Mode test : ?test=1&washer=<id> — limité
// à ce laveur, et le rappel part sans attendre son heure (toujours une seule fois).
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const test = parseTestMode(request)
  if ('error' in test) return NextResponse.json({ error: test.error }, { status: 400 })

  const admin = createAdminClient()
  const instant = new Date()
  const maintenant = instant.toISOString()

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
    if (migrationEnAttente(error)) return NextResponse.json({ ok: true, annulees: 0, rappels: 0, enAttente: true })
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

    const { data: laveur, error: errLaveur } = await admin.from('washers').select('name, slug').eq('id', b.washer_id).maybeSingle()
    if (errLaveur) logger.warn('cron.acomptes.washer_read_failed', { washerId: b.washer_id }, errLaveur)
    await notifierLaveur(b.washer_id, {
      title: 'Réservation annulée',
      body: `${b.client_name} n’a pas réglé l’acompte à temps : la réservation est annulée et le créneau libéré.`,
      url: '/dashboard/calendrier',
      tag: `acompte-${b.id}`,
    })
    if (b.client_email) {
      const slug = laveur?.slug as string | null | undefined
      try {
        const { error: errEnvoi } = await sendAnnulationAcompte({
          to: b.client_email, clientName: b.client_name, washerName: (laveur?.name as string | undefined) ?? 'Votre laveur', scheduledAt: b.scheduled_at,
          lienReservation: slug ? `${SITE_URL_FALLBACK}/book/${encodeURIComponent(slug)}` : null,
        })
        if (errEnvoi) throw errEnvoi
      } catch (e) {
        logger.error('cron.acomptes.email_failed', { bookingId: b.id }, e)
      }
    }
  }

  const rappel = await envoyerRappels(admin, instant, test.enabled ? test.washerId : null)
  echecs += rappel.echecs

  logger.info('cron.acomptes.done', { annulees, rappels: rappel.envoyes, echecs })
  return NextResponse.json({
    ok: echecs === 0, annulees, rappels: rappel.envoyes, echecs,
    ...(rappel.enAttente ? { rappelsEnAttente: true } : {}),
  })
}

type Admin = ReturnType<typeof createAdminClient>
type Laveur = { name: string; reglages: ReglagesAcompte | null }

// Étape séparée de l'annulation : tant que la colonne `acompte_rappel_le` n'existe pas en base,
// elle s'arrête sans rien envoyer, et l'annulation ci-dessus continue de tourner normalement.
async function envoyerRappels(admin: Admin, instant: Date, washerTest: string | null): Promise<{ envoyes: number; echecs: number; enAttente: boolean }> {
  const maintenant = instant.toISOString()
  let requete = admin
    .from('bookings')
    .select('id, washer_id, client_name, client_email, scheduled_at, created_at, acompte_montant, acompte_echeance, acompte_rappel_le')
    .eq('acompte_statut', 'en_attente')
    .eq('status', 'pending')
    .is('acompte_rappel_le', null)
    .not('client_email', 'is', null)
    .gt('acompte_echeance', maintenant)
    .limit(200)
  requete = washerTest
    ? requete.eq('washer_id', washerTest)
    : requete.lte('acompte_echeance', new Date(instant.getTime() + AVANCE_MAX_RAPPEL_MS).toISOString())
  const { data: aRappeler, error } = await requete

  if (error) {
    if (migrationEnAttente(error)) return { envoyes: 0, echecs: 0, enAttente: true }
    logger.error('cron.acomptes.rappel_read_failed', {}, error)
    return { envoyes: 0, echecs: 1, enAttente: false }
  }

  const laveurs = new Map<string, Laveur | null>()
  let envoyes = 0
  let echecs = 0
  for (const b of aRappeler ?? []) {
    if (!b.client_email?.trim()) continue
    if (!washerTest && !rappelAcompteDu({ creeLe: b.created_at, echeance: b.acompte_echeance, rappelLe: b.acompte_rappel_le, maintenant: instant })) continue
    const montant = Number(b.acompte_montant)
    if (!(montant > 0)) continue

    if (!laveurs.has(b.washer_id)) {
      const { data, error: errLaveur } = await admin.from('washers').select('name, acompte').eq('id', b.washer_id).maybeSingle()
      if (errLaveur) logger.error('cron.acomptes.rappel_washer_read_failed', { washerId: b.washer_id }, errLaveur)
      const reglages = data ? ReglagesAcompteSchema.safeParse(data.acompte) : null
      laveurs.set(b.washer_id, data ? { name: data.name as string, reglages: reglages?.success ? reglages.data : null } : null)
    }
    const laveur = laveurs.get(b.washer_id)
    if (!laveur) { echecs++; continue }
    // Réglages relus même si le laveur a coupé l'acompte depuis : la réservation, elle, sera
    // quand même annulée à l'échéance, le client doit pouvoir payer d'ici là.
    const r = laveur.reglages
    if (!r) {
      logger.warn('cron.acomptes.rappel_reglages_invalides', { washerId: b.washer_id, bookingId: b.id })
      continue
    }
    const acompte = { montant, liens: liensDePaiement(r.liens, montant), virement: virementPour(r, b.id), wero: weroPour(r) }
    if (!acompte.liens.length && !acompte.virement && !acompte.wero) {
      logger.warn('cron.acomptes.rappel_sans_moyen', { washerId: b.washer_id, bookingId: b.id })
      continue
    }

    // Marquer AVANT d'envoyer, avec les filtres redits : deux passages simultanés du cron, ou un
    // acompte noté reçu entre-temps, ne peuvent pas faire partir de rappel.
    const { data: pris, error: errPris } = await admin
      .from('bookings')
      .update({ acompte_rappel_le: maintenant })
      .eq('id', b.id)
      .eq('status', 'pending')
      .eq('acompte_statut', 'en_attente')
      .is('acompte_rappel_le', null)
      .gt('acompte_echeance', maintenant)
      .select('id')
    if (errPris) { echecs++; logger.error('cron.acomptes.rappel_mark_failed', { bookingId: b.id }, errPris); continue }
    if (!pris?.length) continue

    try {
      const { error: errEnvoi } = await sendRappelAcompte({
        to: b.client_email, clientName: b.client_name, washerName: laveur.name, scheduledAt: b.scheduled_at,
        echeance: b.acompte_echeance, bookingId: b.id, acompte,
      })
      if (errEnvoi) throw errEnvoi
      envoyes++
    } catch (e) {
      echecs++
      logger.error('cron.acomptes.rappel_email_failed', { bookingId: b.id }, e)
      // Le rappel n'est pas parti : on rend la main au passage suivant plutôt que de le
      // croire envoyé.
      const { error: errRetour } = await admin
        .from('bookings')
        .update({ acompte_rappel_le: null })
        .eq('id', b.id)
        .eq('acompte_rappel_le', maintenant)
      if (errRetour) logger.error('cron.acomptes.rappel_unmark_failed', { bookingId: b.id }, errRetour)
    }
  }
  return { envoyes, echecs, enAttente: false }
}
