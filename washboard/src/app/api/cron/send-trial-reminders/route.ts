import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendTrialReminder, sendTrialExpired } from '@/lib/email'

// Tourne chaque matin (cron-job.org : 0 8 * * *)
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

  // J-3 : trial_ends_at dans la fenêtre [now+2j23h, now+3j23h]
  const reminderMin = new Date(now); reminderMin.setDate(reminderMin.getDate() + 2); reminderMin.setHours(23, 0, 0, 0)
  const reminderMax = new Date(now); reminderMax.setDate(reminderMax.getDate() + 3); reminderMax.setHours(23, 59, 59, 999)

  // J0 : trial_ends_at dans la fenêtre [hier 23h, maintenant]
  const expiredMin = new Date(now); expiredMin.setDate(expiredMin.getDate() - 1); expiredMin.setHours(23, 0, 0, 0)

  const [{ data: toRemind }, { data: toNotifyExpired }] = await Promise.all([
    admin.from('washers')
      .select('id, user_id, name, trial_ends_at')
      .eq('subscription_status', 'trial')
      .eq('grandfathered', false)
      .is('trial_reminder_sent_at', null)
      .gte('trial_ends_at', reminderMin.toISOString())
      .lte('trial_ends_at', reminderMax.toISOString()),

    admin.from('washers')
      .select('id, user_id, name, trial_ends_at')
      .eq('subscription_status', 'trial')
      .eq('grandfathered', false)
      .is('trial_expired_sent_at', null)
      .gte('trial_ends_at', expiredMin.toISOString())
      .lte('trial_ends_at', now.toISOString()),
  ])

  let reminderSent = 0
  let expiredSent = 0
  const nowIso = now.toISOString()

  for (const washer of toRemind ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendTrialReminder({ to: user.email, washerName: washer.name, trialEndsAt: washer.trial_ends_at })
      await admin.from('washers').update({ trial_reminder_sent_at: nowIso }).eq('id', washer.id)
      reminderSent++
    } catch (e) {
      console.error('[cron/trial-reminders] reminder', washer.id, e)
    }
  }

  for (const washer of toNotifyExpired ?? []) {
    if (!washer.user_id) continue
    const { data: { user } } = await admin.auth.admin.getUserById(washer.user_id)
    if (!user?.email) continue
    try {
      await sendTrialExpired({ to: user.email, washerName: washer.name })
      await admin.from('washers').update({ trial_expired_sent_at: nowIso }).eq('id', washer.id)
      expiredSent++
    } catch (e) {
      console.error('[cron/trial-reminders] expired', washer.id, e)
    }
  }

  return NextResponse.json({ ok: true, reminderSent, expiredSent })
}
