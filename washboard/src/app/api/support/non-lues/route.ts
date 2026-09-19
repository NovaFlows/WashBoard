import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'
import { countUnreadMessages } from '@/lib/supportMapping'

// Pastille « questions non lues » du menu dashboard : appelée sur CHAQUE page.
//
// Contrat : `count` est un nombre de MESSAGES non lus, tous fils confondus —
// pas un nombre de fils. Un fil peut recevoir plusieurs réponses de l'équipe
// avant que le laveur ne le rouvre ; les compter toutes évite qu'un fil très
// actif pèse autant qu'un fil avec une seule réponse. Même client authentifié
// que `questions/route.ts` (jamais l'admin, la RLS filtre déjà sur le laveur
// connecté).

export async function GET() {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { data, error } = await supabase
    .from('support_questions')
    .select('last_read_by_washer_at, support_messages(author_type, created_at)')
    .eq('washer_id', washerId)

  if (error) {
    // Un `count: 0` de repli ferait disparaître la pastille pile quand la
    // lecture échoue — c'est à l'interface de décider de ne rien afficher,
    // pas à cette route de mentir sur l'état réel.
    logger.error('support.non-lues.read_failed', { washerId }, error)
    return NextResponse.json({ error: 'Impossible de charger vos notifications.' }, { status: 503 })
  }

  const count = (data ?? []).reduce(
    (total, row) => total + countUnreadMessages(row.support_messages, 'team', row.last_read_by_washer_at),
    0,
  )

  return NextResponse.json({ count })
}
