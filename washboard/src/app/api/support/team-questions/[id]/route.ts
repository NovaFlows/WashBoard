import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { mapConversationRow, uiStatusToDb, assistanceThreadUrl, type SupportWasherInfo } from '@/lib/supportMapping'
import { notifierLaveur } from '@/lib/push'
import { sendSupportReply } from '@/lib/email'

// Répondre à une conversation, ou changer son statut / la marquer lue —
// toujours côté équipe. Même garde-fou que le reste du support : la
// vérification `isSupportMember` a lieu AVANT toute ouverture du client
// admin (ordre identique à `support/access/route.ts`).

// `user_id` en plus de `name, slug` : uniquement pour retrouver l'email du
// laveur via `auth.admin.getUserById` plus bas (l'adresse vit dans
// `auth.users`, pas dans `washers` — même détour que `bookings/route.ts`).
// `mapConversationRow` ne lit que `name`/`slug` : ce champ ne fuite jamais
// dans la réponse JSON envoyée à l'équipe.
const CONVERSATION_QUERY =
  'id, subject, status, is_read_by_washer, is_read_by_team, last_read_by_team_at, washer_id, washers(name, slug, user_id), support_messages(id, author_type, body, created_at)'

const MAX_MESSAGE_LENGTH = 8000

type Equipe = { user: { id: string; email?: string | null }; admin: SupabaseClient }

async function equipeConnectee(): Promise<{ erreur: NextResponse } | Equipe> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  if (!isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)) {
    logger.warn('support.team-questions.id.denied', { userId: user.id })
    return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }

  return { user, admin: createAdminClient() }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await equipeConnectee()
  if ('erreur' in ctx) return ctx.erreur
  const { user, admin } = ctx

  const body = await request.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Le message ne peut pas être vide.' }, { status: 400 })
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message trop long.' }, { status: 400 })
  }

  const { data: question, error: questionError } = await admin
    .from('support_questions').select('id, washer_id, subject').eq('id', id).maybeSingle()

  if (questionError) {
    logger.error('support.team-questions.id.lookup_failed', { questionId: id }, questionError)
    return NextResponse.json({ error: 'Question introuvable. Réessayez.' }, { status: 503 })
  }
  if (!question) return NextResponse.json({ error: 'Question introuvable.' }, { status: 404 })

  const { error: insertError } = await admin
    .from('support_messages')
    .insert({ question_id: id, author_type: 'team', created_by: user.id, body: text })

  if (insertError) {
    logger.error('support.team-questions.id.reply_failed', { questionId: id }, insertError)
    return NextResponse.json({ error: 'Impossible d’envoyer la réponse. Réessayez.' }, { status: 503 })
  }

  const { data: conversation, error: reloadError } = await admin
    .from('support_questions')
    .select(CONVERSATION_QUERY)
    .eq('id', id)
    .order('created_at', { foreignTable: 'support_messages', ascending: true })
    .single()

  if (reloadError || !conversation) {
    logger.error('support.team-questions.id.reload_failed', { questionId: id }, reloadError)
    return NextResponse.json({ error: 'Réponse envoyée, mais impossible de la relire.' }, { status: 503 })
  }

  // Ne lève jamais (voir lib/push.ts) : une notification perdue ne doit pas
  // faire échouer la réponse, déjà persistée à ce stade.
  await notifierLaveur(question.washer_id, {
    title: 'Réponse de l’équipe',
    body: `À propos de : ${question.subject}`,
    url: assistanceThreadUrl(id),
    tag: `support-question-${id}`,
  })

  const washer = (Array.isArray(conversation.washers) ? conversation.washers[0] : conversation.washers) as
    (SupportWasherInfo & { user_id?: string | null }) | null

  // Email en plus du push, décidé par Ryan : le push suppose l'app installée
  // (voir lib/push.ts), l'email reste le canal fiable. Un échec ici ne doit
  // JAMAIS faire échouer la réponse, déjà persistée au-dessus.
  if (washer?.user_id) {
    try {
      const { data: { user: washerUser } } = await admin.auth.admin.getUserById(washer.user_id)
      if (washerUser?.email) {
        const { error: emailError } = await sendSupportReply({
          to: washerUser.email, titreQuestion: question.subject, questionId: id,
        })
        if (emailError) {
          logger.error('support.team-questions.reply_email_failed', { questionId: id, washerId: question.washer_id }, emailError)
        }
      } else {
        logger.warn('support.team-questions.reply_email_missing', { questionId: id, washerId: question.washer_id })
      }
    } catch (e) {
      logger.error('support.team-questions.reply_email_failed', { questionId: id, washerId: question.washer_id }, e)
    }
  }

  logger.info('support.team-questions.replied', {
    questionId: id, washerId: question.washer_id, supportEmail: user.email ?? null,
  })

  return NextResponse.json({ conversation: mapConversationRow(conversation, washer ?? { name: 'Laveur', slug: '' }) })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await equipeConnectee()
  if ('erreur' in ctx) return ctx.erreur
  const { admin } = ctx

  const body = await request.json().catch(() => null)
  const updates: Record<string, unknown> = {}
  if (body?.status === 'ouverte' || body?.status === 'resolue') updates.status = uiStatusToDb(body.status)
  // Curseur dans le même appel que le booléen (jamais accepté du corps de la
  // requête, calculé ici) : `last_read_by_washer_at` n'apparaît jamais dans
  // cette route, l'équipe n'a le droit d'écrire que sa propre colonne.
  if (body?.is_read === true) {
    updates.is_read_by_team = true
    updates.last_read_by_team_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const { error } = await admin.from('support_questions').update(updates).eq('id', id)

  if (error) {
    logger.error('support.team-questions.id.update_failed', { questionId: id, updates }, error)
    return NextResponse.json({ error: 'Impossible de mettre à jour la question. Réessayez.' }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}
