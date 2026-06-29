import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendReviewRequest } from '@/lib/email'

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

  // RDV dont l'avis est dû et pas encore envoyé
  const { data: due, error } = await admin
    .from('bookings')
    .select('id, client_name, client_email, washer_id, status')
    .lte('review_request_at', nowIso)
    .is('review_request_sent_at', null)
    .not('review_request_at', 'is', null)
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const b of due ?? []) {
    // Ne pas envoyer si le RDV a été annulé entre-temps
    if (b.status === 'cancelled' || !b.client_email) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    const { data: washer } = await admin
      .from('washers')
      .select('name, review_enabled, google_review_url')
      .eq('id', b.washer_id)
      .single()

    // Réglages désactivés ou lien manquant : on marque comme traité sans envoyer
    if (!washer?.review_enabled || !washer.google_review_url) {
      await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
      continue
    }

    try {
      await sendReviewRequest({
        to: b.client_email,
        clientName: b.client_name,
        washerName: washer.name,
        reviewUrl: washer.google_review_url,
      })
      sent++
    } catch (e) {
      console.error('[cron/send-reviews]', b.id, e)
    }
    // Marqué envoyé même en cas d'erreur d'email pour éviter les boucles d'envoi
    await admin.from('bookings').update({ review_request_sent_at: nowIso }).eq('id', b.id)
  }

  return NextResponse.json({ ok: true, sent, processed: (due ?? []).length })
}
