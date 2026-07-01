import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

// Health check pour monitoring uptime (UptimeRobot, Better Stack, cron-job.org…).
// - 200 : l'app répond ET la base est joignable.
// - 503 : la base ne répond pas → alerte.
// Ne révèle aucune donnée : juste l'état des dépendances critiques.

export const dynamic = 'force-dynamic' // jamais mis en cache

export async function GET() {
  const started = Date.now()
  let dbOk = false

  try {
    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    // Requête ultra-légère (head + count) sur une table connue.
    const { error } = await admin.from('washers').select('id', { count: 'exact', head: true })
    dbOk = !error
    if (error) logger.error('health.db_error', {}, error)
  } catch (err) {
    logger.error('health.exception', {}, err)
  }

  const body = {
    status: dbOk ? 'ok' : 'degraded',
    checks: { database: dbOk ? 'ok' : 'down' },
    latencyMs: Date.now() - started,
    ts: new Date().toISOString(),
  }

  return NextResponse.json(body, { status: dbOk ? 200 : 503 })
}
