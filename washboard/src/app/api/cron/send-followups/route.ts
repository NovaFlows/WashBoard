import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { sendFollowupEmail } from '@/lib/email'
import { sendSms, EXPEDITEUR_SMS_DEFAUT } from '@/lib/sms'
import { graceEnded } from '@/lib/plan'
import { isAuthorizedCron, createAdminClient, parseTestMode } from '@/lib/cronRequest'
import { logger } from '@/lib/logger'
import { notifierEquipe } from '@/lib/push'
import { repartirParClient, decisionPlusRecents } from '@/lib/relances'

// `followup_sent_at` = relance TRAITÉE : envoyée, ou devenue inutile (voir
// lib/relances.ts). Sans cette marque sur les rendez-vous écartés, ils restaient
// candidats pour toujours et encombraient le lot de 500.
const LOT_CLOTURE = 100

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const test = parseTestMode(request)
  if ('error' in test) return NextResponse.json({ error: test.error }, { status: 400 })

  const admin = createAdminClient()

  const nowIso = new Date().toISOString()

  let washerQuery = admin
    .from('washers')
    .select('id, name, followup_delay_days, followup_message, review_channel, sms_sender, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('followup_enabled', true)
    .not('followup_message', 'is', null)

  if (test.enabled) washerQuery = washerQuery.eq('id', test.washerId)

  const { data: washers, error: washerErr } = await washerQuery

  if (washerErr) return errorResponse('cron.send-followups.get.db', washerErr)

  let emailSent = 0
  let smsSent = 0
  // Compté et renvoyé : sans ça, une panne du fournisseur (clé manquante,
  // quota dépassé) laissait le job répondre « ok » avec 0 envoi, donc passer
  // totalement inaperçue.
  let failed = 0
  let clos = 0
  let premiereCause: string | null = null

  for (const washer of washers ?? []) {
    // Accès coupé après la grâce de 30 jours : plus de relances envoyées en son nom
    if (washer.subscription_status !== 'active' && graceEnded(washer.subscription_ends_at, washer.trial_ends_at)) continue

    // En mode test le délai est lu en MINUTES au lieu de jours : un RDV vieux
    // de quelques minutes devient éligible, sans attendre 90 jours.
    const delay = washer.followup_delay_days ?? 90
    const delayCutoff = new Date()
    if (test.enabled) delayCutoff.setMinutes(delayCutoff.getMinutes() - delay)
    else delayCutoff.setDate(delayCutoff.getDate() - delay)
    const cutoffIso = delayCutoff.toISOString()

    const { data: candidates, error: errCandidates } = await admin
      .from('bookings')
      .select('id, client_name, client_email, client_phone, scheduled_at')
      .eq('washer_id', washer.id)
      .in('status', ['confirmed', 'done'])
      .is('followup_sent_at', null)
      .lte('scheduled_at', cutoffIso)
      .order('scheduled_at', { ascending: false })
      .limit(500)

    if (errCandidates) logger.error('cron.send-followups.candidates.read_failed', { washerId: washer.id }, errCandidates)

    if (!candidates?.length) continue

    // Un seul message par client ; ses rendez-vous plus anciens sont clos.
    const { porteurs, aClore } = repartirParClient(candidates)

    const channel = washer.review_channel ?? 'email'

    for (const booking of porteurs) {
      const clientEmail = booking.client_email
      // Les plus proches d'abord : s'il existe un rendez-vous passé, il est dans
      // les premiers lus.
      const { data: plusRecents, error: errRecents } = await admin
        .from('bookings')
        .select('status, scheduled_at')
        .eq('washer_id', washer.id)
        .eq('client_email', clientEmail)
        .not('status', 'eq', 'cancelled')
        .gt('scheduled_at', booking.scheduled_at)
        .order('scheduled_at')
        .limit(20)
      if (errRecents) {
        // Dans le doute, on ne relance pas aujourd'hui : relancer un client déjà
        // revenu est pire qu'une relance décalée d'un jour.
        logger.error('cron.send-followups.recents.read_failed', { washerId: washer.id }, errRecents)
        continue
      }

      const decision = decisionPlusRecents(plusRecents ?? [], new Date())
      if (decision === 'clore') { aClore.push(booking.id); continue }
      if (decision === 'attendre') continue

      const firstName = booking.client_name.split(' ')[0] ?? booking.client_name
      const message = washer.followup_message!.replace(/\{\{nom\}\}/gi, firstName)

      try {
        if (channel === 'sms' && booking.client_phone) {
          // Le nom du laveur seulement s'il a été approuvé chez Brevo ; sinon
          // l'identifiant commun, qui l'est. Voir EXPEDITEUR_SMS_DEFAUT.
          const sender = (washer.sms_sender?.trim() || EXPEDITEUR_SMS_DEFAUT).slice(0, 11)
          await sendSms({ to: booking.client_phone, sender, content: message })
          smsSent++
        } else {
          await sendFollowupEmail({
            to: clientEmail,
            clientName: booking.client_name,
            washerName: washer.name,
            message,
          })
          emailSent++
        }

        await admin
          .from('bookings')
          .update({ followup_sent_at: nowIso })
          .eq('id', booking.id)
      } catch (e) {
        failed++
        // La cause telle quelle, pour la notification : « not enough credit »
        // dit quoi faire, « 3 échecs » envoie fouiller les journaux.
        premiereCause ??= e instanceof Error ? e.message : String(e)
        logger.error('cron.followups.send_failed', { bookingId: booking.id }, e)
      }
    }

    // Les rendez-vous devenus inutiles sortent du lot pour de bon. Par paquets :
    // le filtre part dans l'adresse de la requête, 500 identifiants la
    // rendraient trop longue.
    for (let i = 0; i < aClore.length; i += LOT_CLOTURE) {
      const paquet = aClore.slice(i, i + LOT_CLOTURE)
      const { error: errClore } = await admin
        .from('bookings')
        .update({ followup_sent_at: nowIso })
        .in('id', paquet)
        .eq('washer_id', washer.id)
      if (errClore) logger.error('cron.send-followups.close_failed', { washerId: washer.id, nombre: paquet.length }, errClore)
      else clos += paquet.length
    }
  }

  // Ici, un envoi en échec restait déjà candidat pour la prochaine exécution
  // (`followup_sent_at` n'est posé qu'après un envoi réussi) — mais sans que
  // personne ne l'apprenne. `tag` fixe : les notifications se remplacent au
  // lieu de s'empiler tant que la panne dure.
  if (failed > 0) {
    await notifierEquipe({
      title: '⚠️ Relances en échec',
      body: [
        `${failed} relance${failed > 1 ? 's' : ''} non envoyée${failed > 1 ? 's' : ''}`,
        premiereCause ? `Cause : ${premiereCause.slice(0, 160)}` : null,
        'Nouvelle tentative à la prochaine exécution.',
      ].filter(Boolean).join('\n'),
      url: '/dashboard',
      tag: 'envois-relance-echec',
    })
  }

  return NextResponse.json({ ok: failed === 0, emailSent, smsSent, failed, clos, test: test.enabled })
}
