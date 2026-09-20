import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { mapConversationRow, isThreadHiddenForTeam, type SupportWasherInfo } from '@/lib/supportMapping'

// Boîte de réception de l'équipe : une conversation par laveur, toutes fiches
// confondues. L'équipe n'existe pas en base — son accès passe uniquement par
// le service_role, après un contrôle applicatif. Ordre identique à
// `support/access/route.ts` : la vérification `isSupportMember` a lieu AVANT
// toute ouverture du client admin.
//
// `?masques=1` bascule sur la vue inverse : uniquement les fils masqués, pour
// que l'équipe puisse retrouver un masquage accidentel même après avoir
// quitté la page (un simple « Annuler » de quelques secondes ne suffit pas —
// ce serait une suppression déguisée). Toujours `isThreadHiddenForTeam`, la
// même fonction que la vue par défaut et que le compteur de non-lues : seul
// le sens de la comparaison change, jamais sa définition.

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)) {
    // Refus identique à celui d'un défaut d'authentification : inutile de
    // révéler à un curieux que cette route existe.
    logger.warn('support.team-questions.get.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('support_questions')
    .select(
      'id, subject, status, is_read_by_washer, is_read_by_team, last_read_by_team_at, hidden_for_team_at, last_message_at, washers(name, slug), support_messages(id, author_type, body, created_at)',
    )
    .order('last_message_at', { ascending: false })
    .order('created_at', { foreignTable: 'support_messages', ascending: true })

  if (error) {
    // Une liste vide ferait croire à « aucune question en attente » alors que
    // la lecture a simplement échoué — l'équipe travaillerait à l'aveugle.
    // C'est exactement le motif des quatre bugs récents (repli permissif sur
    // une lecture en échec) : ici on trace et on répond 503.
    logger.error('support.team-questions.get.read_failed', {}, error)
    return NextResponse.json({ error: 'Impossible de charger les questions. Réessayez.' }, { status: 503 })
  }

  // Par défaut, la boîte de réception exclut les fils masqués. Avec
  // `?masques=1`, c'est l'inverse : uniquement les fils masqués (vue de
  // récupération). Filtre AVANT le mapping, sur les colonnes brutes — même
  // fonction que le compteur de non-lues, pour que les trois ne divergent
  // jamais sur ce qu'est un fil « masqué ».
  const masquesSeuls = new URL(request.url).searchParams.get('masques') === '1'
  const conversations = (data ?? [])
    .filter(row => isThreadHiddenForTeam(row.hidden_for_team_at, row.last_message_at) === masquesSeuls)
    .map(row => {
      const washer = (Array.isArray(row.washers) ? row.washers[0] : row.washers) as SupportWasherInfo | null
      return mapConversationRow(row, washer ?? { name: 'Laveur', slug: '' })
    })

  return NextResponse.json({ conversations })
}
