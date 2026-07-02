import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const admin = createAdminClient()

export async function GET() {
  const started = Date.now()
  let dbOk = false

  try {
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
