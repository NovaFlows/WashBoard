import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendReviewRequest } from '@/lib/email'
import { sendSms } from '@/lib/sms'
import { hasFeature, SMS_QUOTA } from '@/lib/plan'
import type { Plan } from '@/lib/plan'

// Envoie les demandes d'avis Google dont l'heure programmée est passée.
// Appelée régulièrement (toutes les heures) par un planificateur externe
// (cron-job.org) ou Vercel Cron, avec l'en-tête « Authorization: Bearer <CRON_SECRET> ».
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const nowIso = new Date().toISOString()

  const { data: due, error } = await admin
    .from('bookings')
    .select('id, client_name, client_email, client_phone, washer_id, status')
    .lte('review_request_at', nowIso)
    .is('review_request_sent_at', null)
    .not('review_request_at', 'is', null)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let emailSent = 0
  let smsSent = 0

  for (const b of due ?? []) {
    if (b.status === 'cancelled' || !b.client_email) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    const { data: washer } = await admin
      .from('washers')
      .select('name, review_enabled, google_review_url, review_channel, plan, grandfathered, sms_sender')
      .eq('id', b.washer_id)
      .single()

    if (!washer?.review_enabled || !washer.google_review_url) {
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
        console.error('[cron/send-reviews] email', b.id, e)
      }
    } else if (channel === 'sms' && b.client_phone && hasFeature(washer, 'avis_sms')) {
      const quota = SMS_QUOTA[washer.plan as Plan] ?? 0
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
            console.error('[cron/send-reviews] sms', b.id, e)
          }
        }
      }
    }

    await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
  }

  return NextResponse.json({ ok: true, emailSent, smsSent, processed: (due ?? []).length })
}
