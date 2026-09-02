import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Tables que les routes serveur doivent pouvoir lire avec le rôle service_role.
//
// Elles sont listées ici parce qu'un GRANT oublié ne se voit nulle part
// ailleurs : `service_role` contourne RLS mais PAS les droits au niveau table,
// et une policy correcte donne l'illusion que tout est en place. Le défaut ne
// se manifeste qu'à l'exécution, sur la fonctionnalité concernée — c'est
// arrivé deux fois (booking_funnel_events le 2026-08-26, push_subscriptions le
// 2026-09-02). Ce contrôle le fait apparaître tout de suite.
const TABLES_SERVEUR = [
  'washers',
  'bookings',
  'services',
  'availabilities',
  'unavailabilities',
  'booking_funnel_events',
  'push_subscriptions',
] as const

export async function GET() {
  const admin = createAdminClient()
  const started = Date.now()

  const resultats = await Promise.all(
    TABLES_SERVEUR.map(async table => {
      try {
        const { error } = await admin.from(table).select('*', { count: 'exact', head: true })
        if (error) logger.error('health.table_unreachable', { table }, error)
        return [table, !error] as const
      } catch (err) {
        logger.error('health.exception', { table }, err)
        return [table, false] as const
      }
    })
  )

  const inaccessibles = resultats.filter(([, ok]) => !ok).map(([t]) => t)
  const dbOk = inaccessibles.length === 0

  const body = {
    status: dbOk ? 'ok' : 'degraded',
    checks: {
      database: dbOk ? 'ok' : 'down',
      // Nommer les tables en défaut évite de partir à la pêche : le message
      // dit directement quel GRANT manque.
      ...(dbOk ? {} : { unreachableTables: inaccessibles }),
    },
    latencyMs: Date.now() - started,
    ts: new Date().toISOString(),
  }

  return NextResponse.json(body, { status: dbOk ? 200 : 503 })
}
