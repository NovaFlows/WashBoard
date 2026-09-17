import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'

// Pastille « questions non lues » du menu dashboard : appelée sur CHAQUE page,
// donc volontairement minimale — un `count` en `head: true`, aucune ligne
// chargée. Même client authentifié que `questions/route.ts` (jamais l'admin,
// la RLS filtre déjà sur le laveur connecté).

export async function GET() {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { count, error } = await supabase
    .from('support_questions')
    .select('id', { count: 'exact', head: true })
    .eq('washer_id', washerId)
    .eq('is_read_by_washer', false)

  if (error) {
    // Un `count: 0` de repli ferait disparaître la pastille pile quand la
    // lecture échoue — c'est à l'interface de décider de ne rien afficher,
    // pas à cette route de mentir sur l'état réel.
    logger.error('support.non-lues.read_failed', { washerId }, error)
    return NextResponse.json({ error: 'Impossible de charger vos notifications.' }, { status: 503 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
