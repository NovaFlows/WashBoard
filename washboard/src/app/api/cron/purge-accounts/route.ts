import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Purge définitive des comptes dont la suppression a été demandée il y a plus
// de 30 jours. Appelée quotidiennement par Vercel Cron (voir vercel.json).
// Vercel ajoute automatiquement l'en-tête « Authorization: Bearer <CRON_SECRET> »
// si la variable d'environnement CRON_SECRET est définie.
const GRACE_DAYS = 30

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

  const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: toPurge, error } = await admin
    .from('washers')
    .select('id, user_id, logo_url')
    .eq('account_status', 'pending_deletion')
    .lt('deletion_scheduled_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let purged = 0
  for (const w of toPurge ?? []) {
    // 1. Dépenses (au cas où elles ne se cascadent pas via le washer)
    await admin.from('washer_expenses').delete().eq('washer_id', w.id)
    await admin.from('washer_recurring_expenses').delete().eq('washer_id', w.id)

    // 2. Logo dans le storage (best-effort)
    if (w.logo_url) {
      try {
        const m = w.logo_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
        if (m) await admin.storage.from(m[1]).remove([decodeURIComponent(m[2])])
      } catch { /* non bloquant */ }
    }

    // 3. Utilisateur auth → cascade sur washers + services/bookings/dispos/catégories
    if (w.user_id) {
      const { error: delErr } = await admin.auth.admin.deleteUser(w.user_id)
      if (delErr) { console.error('[purge] deleteUser', w.user_id, delErr.message); continue }
    } else {
      await admin.from('washers').delete().eq('id', w.id)
    }
    purged++
  }

  return NextResponse.json({ ok: true, purged })
}
