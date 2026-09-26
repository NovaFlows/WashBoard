import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { sendReviewRequest } from '@/lib/email'
import { sendSms } from '@/lib/sms'
import { hasFeature, SMS_QUOTA, GRANDFATHERED_SMS_QUOTA, graceEnded } from '@/lib/plan'
import type { Plan } from '@/lib/plan'
import { isAuthorizedCron, createAdminClient, parseTestMode } from '@/lib/cronRequest'
import { logger } from '@/lib/logger'
import { notifierEquipe } from '@/lib/push'

// Envoie les demandes d'avis Google dont l'heure programmée est passée.
// Appelée régulièrement (toutes les heures) par un planificateur externe
// (cron-job.org) ou Vercel Cron, avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».

/** Combien de temps on continue de réessayer un envoi en échec.
 *
 *  Avant, `review_request_sent_at` était posé à la fin de CHAQUE tour, même
 *  quand l'envoi avait échoué : la demande était classée « envoyée » et plus
 *  jamais rejouée. Le 2026-09-15, les crédits SMS de Brevo se sont épuisés et
 *  7 demandes ont été perdues ainsi, sans que personne ne le voie.
 *
 *  Mais réessayer indéfiniment ne vaut pas mieux : une adresse invalide
 *  rejouerait toutes les heures pour toujours. Passé ce délai, on abandonne —
 *  une demande d'avis qui arrive trois jours après la prestation n'a de toute
 *  façon plus d'intérêt. */
const FENETRE_RATTRAPAGE_MS = 48 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const test = parseTestMode(request)
  if ('error' in test) return NextResponse.json({ error: test.error }, { status: 400 })

  const admin = createAdminClient()

  const nowIso = new Date().toISOString()

  let dueQuery = admin
    .from('bookings')
    // `review_request_at` est lu pour connaître l'âge de la demande : au-delà
    // de la fenêtre de rattrapage, on cesse de réessayer.
    .select('id, client_name, client_email, client_phone, washer_id, status, review_request_at')
    .is('review_request_sent_at', null)
    .not('review_request_at', 'is', null)
    .limit(200)

  // En mode test on ignore l'heure programmée (H+3 par défaut) pour déclencher
  // tout de suite ; hors test on ne prend que les envois réellement échus.
  if (test.enabled) dueQuery = dueQuery.eq('washer_id', test.washerId)
  else dueQuery = dueQuery.lte('review_request_at', nowIso)

  const { data: due, error } = await dueQuery

  if (error) return errorResponse('cron.send-reviews.get.db', error)

  let emailSent = 0
  let smsSent = 0
  // Compté et renvoyé : sans ça, une panne du fournisseur (clé manquante,
  // quota dépassé) laissait le job répondre « ok » avec 0 envoi, donc passer
  // totalement inaperçue.
  let failed = 0
  // Demandes abandonnées faute d'avoir pu partir dans la fenêtre.
  let abandonnees = 0
  // La première cause d'échec, telle quelle : c'est elle qui part dans la
  // notification. « Brevo SMS error 402: not enough credit » dit tout de
  // suite quoi faire ; « 3 envois en échec » envoie fouiller les journaux.
  let premiereCause: string | null = null

  for (const b of due ?? []) {
    // Passe à `true` si l'envoi de CETTE demande a échoué : elle ne sera alors
    // pas marquée comme traitée, et repassera à l'exécution suivante.
    let echecEnvoi = false
    if (b.status === 'cancelled' || !b.client_email) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    const { data: washer, error: errWasher } = await admin
      .from('washers')
      .select('name, review_enabled, google_review_url, review_channel, plan, grandfathered, sms_sender, subscription_status, trial_ends_at, subscription_ends_at')
      .eq('id', b.washer_id)
      .single()

    if (errWasher) logger.error('cron.send-reviews.washer.read_failed', { washerId: b.washer_id }, errWasher)

    if (!washer?.review_enabled || !washer.google_review_url) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    // Accès coupé après la grâce de 30 jours : plus de demandes d'avis envoyées en son nom
    if (washer.subscription_status !== 'active' && graceEnded(washer.subscription_ends_at, washer.trial_ends_at)) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    const channel = washer.review_channel ?? 'email'

    if (channel === 'email') {
      try {
        await sendReviewRequest({
          to: b.client_email,
          clientName: b.client_name,
          washerName: washer.name,
          reviewUrl: washer.google_review_url,
        })
        emailSent++
      } catch (e) {
        failed++
        echecEnvoi = true
        premiereCause ??= e instanceof Error ? e.message : String(e)
        logger.error('cron.reviews.email_failed', { bookingId: b.id }, e)
      }
    } else if (channel === 'sms' && b.client_phone && hasFeature(washer, 'avis_sms')) {
      const quota = washer.grandfathered
        ? GRANDFATHERED_SMS_QUOTA
        : SMS_QUOTA[washer.plan as Plan] ?? 0
      if (quota > 0) {
        const monthStart = new Date()
        monthStart.setDate(1)
        monthStart.setHours(0, 0, 0, 0)

        const { count, error: errCount } = await admin
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('washer_id', b.washer_id)
          .not('review_sms_sent_at', 'is', null)
          .gte('review_sms_sent_at', monthStart.toISOString())

        if (errCount) logger.error('cron.send-reviews.count.read_failed', { washerId: b.washer_id }, errCount)

        if ((count ?? 0) < quota) {
          try {
            const sender = (washer.sms_sender ?? washer.name).slice(0, 11)
            await sendSms({
              to: b.client_phone,
              sender,
              content: `Bonjour ${b.client_name}, merci pour votre confiance ! Pouvez-vous laisser un avis sur notre travail ? ${washer.google_review_url}`,
            })
            await admin.from('bookings').update({ review_sms_sent_at: nowIso }).eq('id', b.id)
            smsSent++
          } catch (e) {
            failed++
            echecEnvoi = true
            premiereCause ??= e instanceof Error ? e.message : String(e)
            logger.error('cron.reviews.sms_failed', { bookingId: b.id }, e)
          }
        }
      }
    }

    // Le marquage n'est plus inconditionnel : une demande dont l'envoi a
    // échoué reste en attente et repassera à l'exécution suivante — sauf si
    // elle est trop vieille, auquel cas on l'abandonne pour de bon.
    const trop_vieille = !test.enabled
      && !!b.review_request_at
      && Date.now() - Date.parse(b.review_request_at) > FENETRE_RATTRAPAGE_MS

    if (echecEnvoi && !trop_vieille) {
      logger.warn('cron.reviews.reportee', { bookingId: b.id })
      continue
    }
    if (echecEnvoi) {
      abandonnees++
      logger.error('cron.reviews.abandonnee', { bookingId: b.id, programmee: b.review_request_at })
    }

    await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
  }

  // Une panne d'envoi ne doit plus se découvrir onze jours plus tard.
  // `tag` fixe : les notifications successives se remplacent sur le téléphone
  // au lieu de s'empiler heure après heure tant que la panne dure.
  if (failed > 0) {
    await notifierEquipe({
      title: "⚠️ Demandes d'avis en échec",
      body: [
        `${failed} envoi${failed > 1 ? 's' : ''} en échec`,
        premiereCause ? `Cause : ${premiereCause.slice(0, 160)}` : null,
        abandonnees > 0
          ? `${abandonnees} abandonnée${abandonnees > 1 ? 's' : ''} (trop ancienne${abandonnees > 1 ? 's' : ''})`
          : 'Nouvelle tentative à la prochaine exécution.',
      ].filter(Boolean).join('\n'),
      url: '/dashboard',
      tag: 'envois-avis-echec',
    })
  }

  return NextResponse.json({ ok: failed === 0, emailSent, smsSent, failed, abandonnees, processed: (due ?? []).length, test: test.enabled })
}
