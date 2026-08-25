import { NextRequest, NextResponse } from 'next/server'
import { sendFollowupEmail } from '@/lib/email'
import { sendSms } from '@/lib/sms'
import { graceEnded } from '@/lib/plan'
import { isAuthorizedCron, createAdminClient, parseTestMode } from '@/lib/cronRequest'

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

  if (washerErr) return NextResponse.json({ error: washerErr.message }, { status: 500 })

  let emailSent = 0
  let smsSent = 0

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

    const { data: candidates } = await admin
      .from('bookings')
      .select('id, client_name, client_email, client_phone, scheduled_at')
      .eq('washer_id', washer.id)
      .in('status', ['confirmed', 'done'])
      .is('followup_sent_at', null)
      .lte('scheduled_at', cutoffIso)
      .order('scheduled_at', { ascending: false })
      .limit(500)

    if (!candidates?.length) continue

    const byClient = new Map<string, typeof candidates[0]>()
    for (const b of candidates) {
      if (!byClient.has(b.client_email)) byClient.set(b.client_email, b)
    }

    const channel = washer.review_channel ?? 'email'

    for (const [clientEmail, booking] of byClient) {
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('washer_id', washer.id)
        .eq('client_email', clientEmail)
        .not('status', 'eq', 'cancelled')
        .gt('scheduled_at', booking.scheduled_at)

      if ((count ?? 0) > 0) continue

      const firstName = booking.client_name.split(' ')[0] ?? booking.client_name
      const message = washer.followup_message!.replace(/\{\{nom\}\}/gi, firstName)

      try {
        if (channel === 'sms' && booking.client_phone) {
          const sender = (washer.sms_sender ?? washer.name).slice(0, 11)
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
        console.error('[cron/send-followups]', booking.id, e)
      }
    }
  }

  return NextResponse.json({ ok: true, emailSent, smsSent, test: test.enabled })
}
