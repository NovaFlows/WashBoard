import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { countUnreadMessages } from '@/lib/supportMapping'

// Pendant de `support/non-lues/route.ts`, côté équipe cette fois : appelée sur
// CHAQUE page du dashboard par un membre de l'équipe, pour la pastille du menu
// et du bouton ☰. Contrat identique — `{ count }` — pour que `designer`
// réutilise le même composant de badge.
//
// Réservée à l'équipe : contrairement à `support/est-equipe/route.ts` (qui
// répond à une question légitime pour tout laveur), l'appartenance à
// l'équipe n'est pas une donnée qu'un laveur a le droit de sonder ici. Ordre
// identique à `team-questions/route.ts` : `isSupportMember` AVANT toute
// ouverture du client admin.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)) {
    logger.warn('support.non-lues-equipe.get.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('support_questions')
    .select('last_read_by_team_at, support_messages(author_type, created_at)')

  if (error) {
    // Même motif que les quatre bugs récents : un `count: 0` de repli ferait
    // disparaître la pastille pile quand la lecture échoue, alors que
    // l'équipe a le plus besoin d'être alertée à ce moment-là.
    logger.error('support.non-lues-equipe.read_failed', { userId: user.id }, error)
    return NextResponse.json({ error: 'Impossible de charger vos notifications.' }, { status: 503 })
  }

  const count = (data ?? []).reduce(
    (total, row) => total + countUnreadMessages(row.support_messages, 'washer', row.last_read_by_team_at),
    0,
  )

  return NextResponse.json({ count })
}
