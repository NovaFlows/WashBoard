import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendTrialReminder, sendTrialExpired, sendSubReminder, sendSubExpired, sendGraceEndingWarning } from '@/lib/email'
import { logger } from '@/lib/logger'

// Tourne chaque matin à 8h (cron-job.org : 0 8 * * *)
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const nowIso = now.toISOString()

  // Fenêtre J-3 : expiration dans [now+2j23h, now+3j23h]
  const reminderMin = new Date(now); reminderMin.setDate(reminderMin.getDate() + 2); reminderMin.setHours(23, 0, 0, 0)
  const reminderMax = new Date(now); reminderMax.setDate(reminderMax.getDate() + 3); reminderMax.setHours(23, 59, 59, 999)

  // Fenêtre J0 : expiré depuis [hier 23h, maintenant]
  const expiredMin = new Date(now); expiredMin.setDate(expiredMin.getDate() - 1); expiredMin.setHours(23, 0, 0, 0)

  // Fenêtre J-5 avant fin de la grâce de 30 jours (coupure totale)
  const graceWarnMin = new Date(now); graceWarnMin.setDate(graceWarnMin.getDate() + 4); graceWarnMin.setHours(23, 0, 0, 0)
  const graceWarnMax = new Date(now); graceWarnMax.setDate(graceWarnMax.getDate() + 5); graceWarnMax.setHours(23, 59, 59, 999)

  const [
    { data: trialsToRemind },
    { data: trialsExpired },
    { data: subsToRemind },
    { data: subsExpired },
    { data: graceCandidates },
  ] = await Promise.all([
    // Trial J-3
    admin.from('washers')
      .select('id, user_id, name, trial_ends_at')
      .eq('subscription_status', 'trial')
      .eq('grandfathered', false)
      .is('trial_reminder_sent_at', null)
      .gte('trial_ends_at', reminderMin.toISOString())
      .lte('trial_ends_at', reminderMax.toISOString()),

    // Trial J0
    admin.from('washers')
      .select('id, user_id, name, trial_ends_at')
      .eq('subscription_status', 'trial')
      .eq('grandfathered', false)
      .is('trial_expired_sent_at', null)
      .gte('trial_ends_at', expiredMin.toISOString())
      .lte('trial_ends_at', nowIso),

    // Abonné payant J-3 (grandfathered inclus : ils paient 49€/mois quand même)
    admin.from('washers')
      .select('id, user_id, name, subscription_ends_at')
      .eq('subscription_status', 'active')
      .is('sub_reminder_sent_at', null)
      .gte('subscription_ends_at', reminderMin.toISOString())
      .lte('subscription_ends_at', reminderMax.toISOString()),

    // Abonné payant J0 (grandfathered inclus)
    admin.from('washers')
      .select('id, user_id, name, subscription_ends_at')
      .eq('subscription_status', 'active')
      .is('sub_expired_sent_at', null)
      .gte('subscription_ends_at', expiredMin.toISOString())
      .lte('subscription_ends_at', nowIso),

    // Candidats à l'avertissement de fin de grâce (filtrés en JS ci-dessous,
    // car l'échéance de référence est soit trial_ends_at, soit subscription_ends_at)
    admin.from('washers')
      .select('id, user_id, name, trial_ends_at, subscription_ends_at')
      .neq('subscription_status', 'active')
      .is('grace_reminder_sent_at', null),
  ])

  const graceToWarn = (graceCandidates ?? []).filter(w => {
    const anchor = w.subscription_ends_at ?? w.trial_ends_at
    if (!anchor) return false
    const cutoff = new Date(anchor)
    cutoff.setDate(cutoff.getDate() + 30)
    return cutoff >= graceWarnMin && cutoff <= graceWarnMax
  })

  const counts = { trialReminder: 0, trialExpired: 0, subReminder: 0, subExpired: 0, graceWarning: 0 }

  for (const washer of trialsToRemind ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendTrialReminder({ to: user.email, washerName: washer.name, trialEndsAt: washer.trial_ends_at })
      await admin.from('washers').update({ trial_reminder_sent_at: nowIso }).eq('id', washer.id)
      counts.trialReminder++
    } catch (e) { logger.error('cron.trial_reminder.send_failed', { washerId: washer.id }, e) }
  }

  for (const washer of trialsExpired ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendTrialExpired({ to: user.email, washerName: washer.name })
      await admin.from('washers').update({ trial_expired_sent_at: nowIso }).eq('id', washer.id)
      counts.trialExpired++
    } catch (e) { logger.error('cron.trial_expired.send_failed', { washerId: washer.id }, e) }
  }

  for (const washer of subsToRemind ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendSubReminder({ to: user.email, washerName: washer.name, endsAt: washer.subscription_ends_at })
      await admin.from('washers').update({ sub_reminder_sent_at: nowIso }).eq('id', washer.id)
      counts.subReminder++
    } catch (e) { logger.error('cron.sub_reminder.send_failed', { washerId: washer.id }, e) }
  }

  for (const washer of subsExpired ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendSubExpired({ to: user.email, washerName: washer.name })
      await admin.from('washers').update({
        sub_expired_sent_at: nowIso,
        subscription_status: 'expired',
      }).eq('id', washer.id)
      counts.subExpired++
    } catch (e) { logger.error('cron.sub_expired.send_failed', { washerId: washer.id }, e) }
  }

  for (const washer of graceToWarn) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    const anchor = washer.subscription_ends_at ?? washer.trial_ends_at
    const cutoff = new Date(anchor!); cutoff.setDate(cutoff.getDate() + 30)
    try {
      await sendGraceEndingWarning({ to: user.email, washerName: washer.name, cutoffDate: cutoff.toISOString() })
      await admin.from('washers').update({ grace_reminder_sent_at: nowIso }).eq('id', washer.id)
      counts.graceWarning++
    } catch (e) { logger.error('cron.grace_warning.send_failed', { washerId: washer.id }, e) }
  }

  return NextResponse.json({ ok: true, ...counts })
}
