import { NextRequest, NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'
import { mapThreadRow } from '@/lib/supportMapping'
import { notifierEquipe } from '@/lib/push'

// Répondre dans un fil existant, ou le marquer lu — toujours côté laveur, et
// toujours sur SON fil : la RLS filtre déjà, mais on double le filtre
// applicatif (même motif que `requireWasher`), pour un 404 clair plutôt
// qu'une erreur Postgres brute en cas d'id qui n'appartient pas au laveur.

const THREAD_QUERY =
  'id, subject, status, is_read_by_washer, is_read_by_team, support_messages(id, author_type, body, created_at)'

const MAX_MESSAGE_LENGTH = 8000

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return NextResponse.json({ error: 'Le message ne peut pas être vide.' }, { status: 400 })
  if (text.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: 'Message trop long.' }, { status: 400 })
  }

  const { data: fil, error: filError } = await supabase
    .from('support_questions').select('id').eq('id', id).eq('washer_id', washerId).maybeSingle()

  if (filError) {
    logger.error('support.questions.id.lookup_failed', { washerId, questionId: id }, filError)
    return NextResponse.json({ error: 'Question introuvable. Réessayez.' }, { status: 503 })
  }
  if (!fil) return NextResponse.json({ error: 'Question introuvable.' }, { status: 404 })

  // `created_by` explicite : la policy RLS d'insertion l'exige, un oubli
  // produit un rejet bruyant plutôt qu'un message envoyé sans auteur.
  const { error: insertError } = await supabase
    .from('support_messages')
    .insert({ question_id: id, author_type: 'washer', created_by: user.id, body: text })

  if (insertError) {
    logger.error('support.questions.id.message_failed', { washerId, questionId: id }, insertError)
    return NextResponse.json({ error: 'Impossible d’envoyer votre message. Réessayez.' }, { status: 503 })
  }

  // Relu depuis la base plutôt que reconstruit à la main : le déclencheur a
  // pu rouvrir le fil et changer ses indicateurs de lecture, et ce n'est pas
  // à cette route de deviner ce qu'il a fait.
  const { data: thread, error: reloadError } = await supabase
    .from('support_questions')
    .select(THREAD_QUERY)
    .eq('id', id)
    .order('created_at', { foreignTable: 'support_messages', ascending: true })
    .single()

  if (reloadError || !thread) {
    logger.error('support.questions.id.reload_failed', { washerId, questionId: id }, reloadError)
    return NextResponse.json({ error: 'Message envoyé, mais impossible de recharger le fil.' }, { status: 503 })
  }

  // Un fil qui ne bouge qu'à la création laisse mourir la conversation
  // pile quand le laveur relance après une première réponse de l'équipe
  // (« non, ça ne marche toujours pas ») — le déclencheur rouvre bien le
  // fil et repasse `is_read_by_team` à faux, mais rien ne le signalait.
  // Titre distinct de celui de `questions/route.ts` (création) : Alexandre
  // doit voir d'un coup d'œil s'il s'agit d'un nouveau sujet ou d'une
  // relance sur un fil qu'il croyait traité. `subject` est déjà borné à 200
  // caractères (déduit à la création) : pas le texte brut du message, qui
  // peut aller jusqu'à 8000 caractères et déborderait largement des deux
  // lignes qu'iOS affiche au repos (voir lib/rappelTerminer.ts).
  const { data: washer, error: washerError } = await supabase
    .from('washers').select('name').eq('id', washerId).single()
  if (washerError) logger.error('support.questions.id.washer_name_failed', { washerId }, washerError)

  // Ne lève jamais (voir lib/push.ts) : une notification perdue ne doit pas
  // faire échouer l'envoi du message, déjà persisté à ce stade.
  await notifierEquipe({
    title: 'Relance sur une question support',
    body: `${washer?.name ?? 'Un laveur'} : ${thread.subject}`,
    url: '/dashboard/support',
    tag: `support-question-${id}`,
  })

  return NextResponse.json({ thread: mapThreadRow(thread) })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const body = await request.json().catch(() => null)
  if (body?.is_read !== true) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('support_questions')
    .update({ is_read_by_washer: true })
    .eq('id', id)
    .eq('washer_id', washerId)

  if (error) {
    logger.error('support.questions.id.mark_read_failed', { washerId, questionId: id }, error)
    return NextResponse.json({ error: 'Impossible de marquer la question comme lue.' }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}
