import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'
import { deriveSupportSubject } from '@/lib/supportSubject'
import { isThreadHiddenForWasher, mapThreadRow } from '@/lib/supportMapping'
import { notifierEquipe } from '@/lib/push'
import { peutOuvrirNouvelleQuestion, MESSAGE_LIMITE_QUESTIONS_ATTEINTE } from '@/lib/supportQuestionLimit'

// Canal de question directe laveur → équipe, côté laveur : lister ses fils et
// en ouvrir un nouveau. Répondre dans un fil existant vit dans
// `[id]/route.ts`, avec la vérification d'appartenance qui va avec.
//
// Un fil n'a jamais de titre saisi par le laveur : il est déduit ici, côté
// serveur, de la première ligne de son message (`deriveSupportSubject`).

// `*` et non une liste : `hidden_for_washer_at` et `last_message_at` doivent être lus
// sans casser la liste tant que la colonne du masquage n'existe pas encore en base (une
// colonne nommée absente fait échouer toute la requête, `*` la tolère). Rien de
// sensible ici : `mapThreadRow` ne renvoie au navigateur que ce qu'il choisit.
const THREAD_QUERY =
  '*, support_messages(id, author_type, body, created_at)'

const MAX_MESSAGE_LENGTH = 8000

function isUuid(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function GET() {
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { data, error } = await supabase
    .from('support_questions')
    .select(THREAD_QUERY)
    .eq('washer_id', washerId)
    .order('created_at', { foreignTable: 'support_messages', ascending: true })

  if (error) {
    // Une liste vide ferait croire au laveur qu'il n'a jamais rien demandé,
    // alors que la lecture a simplement échoué.
    logger.error('support.questions.get.read_failed', { washerId }, error)
    return NextResponse.json({ error: 'Impossible de charger vos questions. Réessayez.' }, { status: 503 })
  }

  // Les fils que le laveur a supprimés de sa liste n'y reviennent qu'avec un nouveau message.
  const visibles = (data ?? []).filter(row => !isThreadHiddenForWasher(row.hidden_for_washer_at, row.last_message_at ?? ''))
  return NextResponse.json({ threads: visibles.map(mapThreadRow) })
}

export async function POST(request: NextRequest) {
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

  // Plafond de fils NON RÉSOLUS ouverts par ce laveur (voir
  // lib/supportQuestionLimit.ts) : sans lui, chaque création déclenche
  // `notifierEquipe` plus bas, et rien ne borne combien un compte compromis
  // (ou un laveur agacé) peut en ouvrir. Une lecture en échec ne doit jamais
  // être traitée comme « aucun fil ouvert » : ce serait désactiver le
  // garde-fou pile quand un incident de base le rend le plus nécessaire.
  const { count: nombreOuvertes, error: countError } = await supabase
    .from('support_questions')
    .select('id', { count: 'exact', head: true })
    .eq('washer_id', washerId)
    .eq('status', 'open')

  if (countError) {
    logger.error('support.questions.post.count_failed', { washerId }, countError)
    return NextResponse.json({ error: 'Impossible de vérifier vos questions en cours. Réessayez.' }, { status: 503 })
  }

  if (!peutOuvrirNouvelleQuestion(nombreOuvertes ?? 0)) {
    logger.warn('support.questions.post.limit_reached', { washerId, nombreOuvertes })
    return NextResponse.json({ error: MESSAGE_LIMITE_QUESTIONS_ATTEINTE }, { status: 429 })
  }

  // Le panneau (SupportPanel) transitionne vers le fil dès l'envoi, avec l'id
  // renvoyé ici : on accepte donc un id fourni par le client, pour que
  // l'affichage optimiste et la ligne réellement créée partagent le même id
  // dès le départ — sans quoi la navigation optimiste pointerait vers un id
  // qui n'existe plus une fois la réponse du serveur arrivée.
  const questionId = isUuid(body?.questionId) ? body.questionId : randomUUID()
  const subject = deriveSupportSubject(text)

  const { error: questionError } = await supabase
    .from('support_questions')
    .insert({ id: questionId, washer_id: washerId, subject })

  if (questionError) {
    logger.error('support.questions.post.question_failed', { washerId }, questionError)
    return NextResponse.json({ error: 'Impossible d’envoyer votre question. Réessayez.' }, { status: 503 })
  }

  const { error: messageError } = await supabase
    .from('support_messages')
    .insert({ question_id: questionId, author_type: 'washer', created_by: user.id, body: text })

  if (messageError) {
    logger.error('support.questions.post.message_failed', { washerId, questionId }, messageError)
    // Rattrapage best-effort : un fil sans aucun message serait invisible
    // (aucun dernier message à afficher côté laveur comme côté équipe).
    const { error: cleanupError } = await supabase.from('support_questions').delete().eq('id', questionId)
    if (cleanupError) {
      logger.error('support.questions.post.cleanup_failed', { washerId, questionId }, cleanupError)
    }
    return NextResponse.json({ error: 'Impossible d’envoyer votre question. Réessayez.' }, { status: 503 })
  }

  const { data: thread, error: reloadError } = await supabase
    .from('support_questions')
    .select(THREAD_QUERY)
    .eq('id', questionId)
    .order('created_at', { foreignTable: 'support_messages', ascending: true })
    .single()

  if (reloadError || !thread) {
    logger.error('support.questions.post.reload_failed', { washerId, questionId }, reloadError)
    return NextResponse.json({ error: 'Question envoyée, mais impossible de la relire.' }, { status: 503 })
  }

  const { data: washer, error: washerError } = await supabase
    .from('washers').select('name').eq('id', washerId).single()
  if (washerError) logger.error('support.questions.post.washer_name_failed', { washerId }, washerError)

  // Ne lève jamais (voir lib/push.ts) : une notification perdue ne doit pas
  // faire échouer l'envoi de la question, déjà persistée à ce stade.
  await notifierEquipe({
    title: 'Nouvelle question support',
    body: `${washer?.name ?? 'Un laveur'} : ${subject}`,
    url: '/dashboard/support',
    tag: `support-question-${questionId}`,
  })

  logger.info('support.questions.created', { washerId, questionId })

  return NextResponse.json({ thread: mapThreadRow(thread) }, { status: 201 })
}
