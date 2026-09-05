import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { sendReviewRequest } from '@/lib/email'
import { sendSms } from '@/lib/sms'
import { hasFeature, SMS_QUOTA, GRANDFATHERED_SMS_QUOTA, graceEnded } from '@/lib/plan'
import type { Plan } from '@/lib/plan'
import { isAuthorizedCron, createAdminClient, parseTestMode } from '@/lib/cronRequest'
import { logger } from '@/lib/logger'

// Envoie les demandes d'avis Google dont l'heure programmée est passée.
// Appelée régulièrement (toutes les heures) par un planificateur externe
// (cron-job.org) ou Vercel Cron, avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».
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
    .select('id, client_name, client_email, client_phone, washer_id, status')
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

  for (const b of due ?? []) {
    if (b.status === 'cancelled' || !b.client_email) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    const { data: washer } = await admin
      .from('washers')
      .select('name, review_enabled, google_review_url, review_channel, plan, grandfathered, sms_sender, subscription_status, trial_ends_at, subscription_ends_at')
      .eq('id', b.washer_id)
      .single()

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

        const { count } = await admin
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('washer_id', b.washer_id)
          .not('review_sms_sent_at', 'is', null)
          .gte('review_sms_sent_at', monthStart.toISOString())

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
            logger.error('cron.reviews.sms_failed', { bookingId: b.id }, e)
          }
        }
      }
    }

    await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
  }

  return NextResponse.json({ ok: failed === 0, emailSent, smsSent, failed, processed: (due ?? []).length, test: test.enabled })
}
