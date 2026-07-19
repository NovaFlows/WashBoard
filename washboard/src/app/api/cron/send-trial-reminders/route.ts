import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendTrialReminder, sendTrialExpired, sendSubReminder, sendSubExpired } from '@/lib/email'

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

  const [
    { data: trialsToRemind },
    { data: trialsExpired },
    { data: subsToRemind },
    { data: subsExpired },
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

    // Abonné payant J-3
    admin.from('washers')
      .select('id, user_id, name, subscription_ends_at')
      .eq('subscription_status', 'active')
      .eq('grandfathered', false)
      .is('sub_reminder_sent_at', null)
      .gte('subscription_ends_at', reminderMin.toISOString())
      .lte('subscription_ends_at', reminderMax.toISOString()),

    // Abonné payant J0 (expiration non renouvelée)
    admin.from('washers')
      .select('id, user_id, name, subscription_ends_at')
      .eq('subscription_status', 'active')
      .eq('grandfathered', false)
      .is('sub_expired_sent_at', null)
      .gte('subscription_ends_at', expiredMin.toISOString())
      .lte('subscription_ends_at', nowIso),
  ])

  const counts = { trialReminder: 0, trialExpired: 0, subReminder: 0, subExpired: 0 }

  for (const washer of trialsToRemind ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendTrialReminder({ to: user.email, washerName: washer.name, trialEndsAt: washer.trial_ends_at })
      await admin.from('washers').update({ trial_reminder_sent_at: nowIso }).eq('id', washer.id)
      counts.trialReminder++
    } catch (e) { console.error('[cron] trial_reminder', washer.id, e) }
  }

  for (const washer of trialsExpired ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendTrialExpired({ to: user.email, washerName: washer.name })
      await admin.from('washers').update({ trial_expired_sent_at: nowIso }).eq('id', washer.id)
      counts.trialExpired++
    } catch (e) { console.error('[cron] trial_expired', washer.id, e) }
  }

  for (const washer of subsToRemind ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendSubReminder({ to: user.email, washerName: washer.name, endsAt: washer.subscription_ends_at })
      await admin.from('washers').update({ sub_reminder_sent_at: nowIso }).eq('id', washer.id)
      counts.subReminder++
    } catch (e) { console.error('[cron] sub_reminder', washer.id, e) }
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
    } catch (e) { console.error('[cron] sub_expired', washer.id, e) }
  }

  return NextResponse.json({ ok: true, ...counts })
}
