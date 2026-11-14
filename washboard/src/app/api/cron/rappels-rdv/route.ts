import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron, parseTestMode, createAdminClient } from '@/lib/cronRequest'
import { sendRappelRdv } from '@/lib/email'
import { graceEnded } from '@/lib/plan'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import {
  RAPPEL_HEURES_MAX, heuresEnvoyees, normaliserHeures, rappelsActifs, rappelsDus,
} from '@/lib/rappelsRdv'
import { logger } from '@/lib/logger'

// Rappels de rendez-vous par email, quelques heures avant (règles : lib/rappelsRdv.ts).
// Allumés par défaut pour tous les laveurs ; chacun peut les couper et choisir ses délais
// (`washers.rappel_rdv_actif`, `washers.rappel_rdv_heures`).
//
// Seuls les rendez-vous CONFIRMÉS reçoivent un rappel : un client dont la demande attend encore
// la réponse du laveur n'a pas de rendez-vous à se rappeler.
//
// Ce qui est parti est noté dans `bookings.rappels_rdv_envoyes` (les heures déjà envoyées), APRÈS
// l'envoi : un échec est rejoué au passage suivant, et la clé d'idempotence de l'email empêche le
// doublon si le fournisseur avait en fait livré.
//
// Planification : cron-job.org, toutes les 15 minutes, « Authorization: Bearer <CRON_SECRET> ».
// Mode test : ?test=1&washer=<id>&booking=<id> — envoie tout de suite le rappel de CE rendez-vous,
// sans attendre son heure (il en faut un : sans ça, tous les clients du laveur le recevraient).
//
// Refus Resend qu'un nouvel essai ne changera pas : adresse refusée, ou clé d'idempotence déjà
// utilisée avec un autre contenu.
const ECHECS_DEFINITIFS = new Set(['validation_error', 'invalid_idempotent_request'])

function echecDefinitif(e: unknown): boolean {
  return !!e && typeof e === 'object' && ECHECS_DEFINITIFS.has((e as { name?: unknown }).name as string)
}

type Laveur = {
  name: string
  phone: string | null
  actif: boolean
  heures: number[]
  coupe: boolean
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const test = parseTestMode(request)
  if ('error' in test) return NextResponse.json({ error: test.error }, { status: 400 })
  const bookingTest = new URL(request.url).searchParams.get('booking')
  if (test.enabled && !bookingTest) {
    return NextResponse.json({ error: 'Le mode test exige aussi ?booking=<id> : sans lui, tous les clients du laveur recevraient leur rappel en avance' }, { status: 400 })
  }

  const admin = createAdminClient()
  const instant = Date.now()

  let requete = admin
    .from('bookings')
    .select('id, washer_id, client_name, client_email, scheduled_at, created_at, address, lieu, rappels_rdv_envoyes, services(name)')
    .eq('status', 'confirmed')
    .not('client_email', 'is', null)
    .gt('scheduled_at', new Date(instant).toISOString())
    .order('scheduled_at')
    .limit(500)
  requete = test.enabled && bookingTest
    ? requete.eq('washer_id', test.washerId).eq('id', bookingTest)
    : requete.lte('scheduled_at', new Date(instant + RAPPEL_HEURES_MAX * 3_600_000).toISOString())
  const { data: rdvs, error } = await requete

  if (error) {
    // La colonne `rappels_rdv_envoyes` n'existe pas encore : rien à envoyer, rien n'est cassé.
    if (migrationEnAttente(error)) return NextResponse.json({ ok: true, envoyes: 0, enAttente: true })
    logger.error('cron.rappels-rdv.read_failed', {}, error)
    return NextResponse.json({ ok: false, error: 'Lecture impossible' }, { status: 500 })
  }

  const laveurs = new Map<string, Laveur | null>()
  let envoyes = 0
  let echecs = 0

  for (const b of rdvs ?? []) {
    if (!b.client_email?.trim()) continue

    if (!laveurs.has(b.washer_id)) {
      const { data, error: errLaveur } = await admin
        .from('washers')
        .select('name, phone, rappel_rdv_actif, rappel_rdv_heures, account_status, subscription_status, subscription_ends_at, trial_ends_at')
        .eq('id', b.washer_id)
        .maybeSingle()
      if (errLaveur && !migrationEnAttente(errLaveur)) logger.error('cron.rappels-rdv.washer_read_failed', { washerId: b.washer_id }, errLaveur)
      laveurs.set(b.washer_id, data
        ? {
            name: data.name as string,
            phone: (data.phone as string | null) ?? null,
            actif: rappelsActifs(data.rappel_rdv_actif),
            heures: normaliserHeures(data.rappel_rdv_heures),
            // Compte désactivé, ou accès coupé après la grâce de 30 jours : plus rien n'est envoyé
            // en son nom (même règle que les demandes d'avis).
            coupe: (data.account_status != null && data.account_status !== 'active')
              || (data.subscription_status !== 'active' && graceEnded(data.subscription_ends_at as string | null, data.trial_ends_at as string | null)),
          }
        : null)
    }
    const laveur = laveurs.get(b.washer_id)
    if (!laveur || !laveur.actif || laveur.coupe) continue

    const deja = heuresEnvoyees(b.rappels_rdv_envoyes)
    // Mode test : le rappel part tout de suite, avec le premier délai réglé par le laveur.
    const dus = test.enabled
      ? laveur.heures.slice(0, 1)
      : rappelsDus({ rdvLe: b.scheduled_at, creeLe: b.created_at, heures: laveur.heures, deja, maintenant: instant })
    if (dus.length === 0) continue

    // Plusieurs rappels échus d'un coup (cron arrêté un moment) : un seul email, au plus proche du
    // rendez-vous, et tous sont notés comme partis — pas de rafale de messages en retard.
    const heures = Math.min(...dus)
    const svc = (Array.isArray(b.services) ? b.services[0] : b.services) as { name?: string } | null

    try {
      const { error: errEnvoi } = await sendRappelRdv({
        to: b.client_email,
        clientName: b.client_name,
        washerName: laveur.name,
        washerPhone: laveur.phone,
        scheduledAt: b.scheduled_at,
        serviceName: svc?.name ?? 'Lavage',
        address: b.address,
        lieu: b.lieu ?? null,
        bookingId: b.id,
        heures,
      })
      if (errEnvoi) throw errEnvoi
      envoyes++
    } catch (e) {
      echecs++
      logger.error('cron.rappels-rdv.email_failed', { bookingId: b.id }, e)
      // Refus définitif : on note quand même, sinon le même refus reviendrait tous les quarts d'heure.
      if (!echecDefinitif(e)) continue
    }

    if (test.enabled) continue
    const { error: errMarque } = await admin
      .from('bookings')
      .update({ rappels_rdv_envoyes: [...deja, ...dus].sort((a, c) => c - a) })
      .eq('id', b.id)
    if (errMarque) logger.error('cron.rappels-rdv.mark_failed', { bookingId: b.id }, errMarque)
  }

  logger.info('cron.rappels-rdv.done', { envoyes, echecs })
  return NextResponse.json({ ok: echecs === 0, envoyes, echecs })
}
