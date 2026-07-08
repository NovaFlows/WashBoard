import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendFollowupEmail } from '@/lib/email'

// Envoie les relances clients dont le délai est dépassé.
// Appelée toutes les heures par un cron externe (cron-job.org ou Vercel Cron).
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

  // Récupérer tous les laveurs avec les relances activées
  const { data: washers, error: washerErr } = await admin
    .from('washers')
    .select('id, name, followup_delay_days, followup_message')
    .eq('followup_enabled', true)
    .not('followup_message', 'is', null)

  if (washerErr) return NextResponse.json({ error: washerErr.message }, { status: 500 })

  let sent = 0

  for (const washer of washers ?? []) {
    const delayCutoff = new Date()
    delayCutoff.setDate(delayCutoff.getDate() - (washer.followup_delay_days ?? 90))
    const cutoffIso = delayCutoff.toISOString()

    // Chercher les bookings candidats : terminés ou confirmés, sans relance envoyée,
    // dont la date est au-delà du délai, ET dont le client n'a pas de booking
    // plus récent chez ce laveur (= il est vraiment parti)
    const { data: candidates } = await admin
      .from('bookings')
      .select('id, client_name, client_email, scheduled_at')
      .eq('washer_id', washer.id)
      .in('status', ['confirmed', 'done'])
      .is('followup_sent_at', null)
      .lte('scheduled_at', cutoffIso)
      .order('scheduled_at', { ascending: false })
      .limit(500)

    if (!candidates?.length) continue

    // Dédupliquer par client_email : ne garder que le booking le plus récent par client
    const byClient = new Map<string, typeof candidates[0]>()
    for (const b of candidates) {
      if (!byClient.has(b.client_email)) byClient.set(b.client_email, b)
    }

    for (const [clientEmail, booking] of byClient) {
      // Vérifier qu'il n'existe pas un booking plus récent non annulé
      const { count } = await admin
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('washer_id', washer.id)
        .eq('client_email', clientEmail)
        .not('status', 'eq', 'cancelled')
        .gt('scheduled_at', booking.scheduled_at)

      if ((count ?? 0) > 0) continue // le client a rebooké récemment

      const firstName = booking.client_name.split(' ')[0] ?? booking.client_name
      const message = washer.followup_message!.replace(/\{\{nom\}\}/gi, firstName)

      try {
        await sendFollowupEmail({
          to: clientEmail,
          clientName: booking.client_name,
          washerName: washer.name,
          message,
        })
        await admin
          .from('bookings')
          .update({ followup_sent_at: nowIso })
          .eq('id', booking.id)
        sent++
      } catch (e) {
        console.error('[cron/send-followups]', booking.id, e)
      }
    }
  }

  return NextResponse.json({ ok: true, sent })
}
