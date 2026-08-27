import type { NextRequest } from 'next/server'

// Auth partagée par les routes /api/cron/*.
// Le planificateur externe (cron-job.org) appelle avec « Authorization: Bearer <CRON_SECRET> ».
export function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Ré-exporté depuis lib/supabase/admin.ts (source unique du client service_role)
// pour ne pas casser les routes cron qui l'importaient déjà depuis ce fichier.
export { createAdminClient } from '@/lib/supabase/admin'

// Mode test : `?test=1&washer=<uuid>`.
//
// Il court-circuite les délais d'attente (relances à J+90, avis à H+3) pour
// pouvoir vérifier les envois en quelques minutes au lieu d'attendre des jours.
// Comme il provoque de VRAIS envois, il est obligatoirement limité à un laveur :
// sans `washer`, la route doit répondre 400 plutôt que d'arroser tout le monde.
export type CronTestMode = { enabled: false } | { enabled: true; washerId: string }

export function parseTestMode(request: NextRequest): CronTestMode | { error: string } {
  const params = request.nextUrl.searchParams
  if (params.get('test') !== '1') return { enabled: false }

  const washerId = params.get('washer')
  if (!washerId) {
    return { error: 'Le mode test exige ?washer=<id> pour ne cibler qu’un seul laveur' }
  }
  return { enabled: true, washerId }
}
