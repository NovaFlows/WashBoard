import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { mapConversationRow, type SupportWasherInfo } from '@/lib/supportMapping'

// Boîte de réception de l'équipe : une conversation par laveur, toutes fiches
// confondues. L'équipe n'existe pas en base — son accès passe uniquement par
// le service_role, après un contrôle applicatif. Ordre identique à
// `support/access/route.ts` : la vérification `isSupportMember` a lieu AVANT
// toute ouverture du client admin.

export async function GET() {
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
      'id, subject, status, is_read_by_washer, is_read_by_team, washers(name, slug), support_messages(id, author_type, body, created_at)',
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

  const conversations = (data ?? []).map(row => {
    const washer = (Array.isArray(row.washers) ? row.washers[0] : row.washers) as SupportWasherInfo | null
    return mapConversationRow(row, washer ?? { name: 'Laveur', slug: '' })
  })

  return NextResponse.json({ conversations })
}
