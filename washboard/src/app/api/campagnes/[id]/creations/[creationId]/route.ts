import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'
import { erreurCreation, estFormat, MESSAGES_ERREUR_CREATION } from '@/lib/campagne'

/** Modification d'une création : son nom, son format, son budget.
 *
 *  La CLÉ n'est jamais modifiable, pour la même raison que celle d'une
 *  campagne : elle est déjà collée sous une vidéo en ligne. La changer
 *  couperait l'attribution des clics en cours sans que personne ne comprenne
 *  pourquoi les chiffres se sont arrêtés.
 *
 *  Le budget, lui, se corrige : c'est même le cas courant, puisqu'on le
 *  découvre souvent après coup dans le gestionnaire de publicités. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; creationId: string }> },
) {
  const { id: campagneId, creationId } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Requête illisible' }, { status: 400 })

  // On relit l'existant : une modification partielle doit être validée contre
  // l'état complet, pas contre les seuls champs envoyés.
  const { data: actuelle, error: errLecture } = await supabase
    .from('campagne_creations')
    .select('nom, format, budget')
    .eq('id', creationId)
    .eq('campagne_id', campagneId)
    .eq('washer_id', washerId)
    .maybeSingle()

  if (errLecture) return errorResponse('creations.read', errLecture, { washerId })
  if (!actuelle) return NextResponse.json({ error: 'Vidéo introuvable' }, { status: 404 })

  const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, 120) : actuelle.nom
  const format = estFormat(body.format) ? body.format : actuelle.format
  // Une chaîne vide EFFACE le budget, elle ne le met pas à zéro : c'est ainsi
  // que le laveur revient à « je ne sais pas », et un « 0 € par client » ferait
  // passer la vidéo pour gratuite.
  const budget = body.budget === undefined
    ? actuelle.budget
    : (body.budget === null || body.budget === ''
        ? null
        : (typeof body.budget === 'string' ? Number(body.budget.replace(',', '.')) : body.budget))

  const faute = erreurCreation({ nom, budget })
  if (faute) return NextResponse.json({ error: MESSAGES_ERREUR_CREATION[faute] }, { status: 400 })

  const { data, error } = await supabase
    .from('campagne_creations')
    .update({ nom, format, budget })
    .eq('id', creationId)
    .eq('campagne_id', campagneId)
    .eq('washer_id', washerId)
    .select('id, campagne_id, nom, format, cle, budget')
    .single()

  if (error) return errorResponse('creations.update', error, { washerId })
  return NextResponse.json({ data })
}

/** Suppression d'une création.
 *
 *  Les visites et les réservations gardent leur `utm_content` : c'est du texte
 *  libre, pas une clé étrangère. Supprimer une vidéo efface sa ligne de
 *  comparaison, jamais l'origine des clients qu'elle a amenés — ils restent
 *  comptés dans le bilan de la campagne, sous « autres visites ». */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; creationId: string }> },
) {
  const { id: campagneId, creationId } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { error } = await supabase
    .from('campagne_creations')
    .delete()
    .eq('id', creationId)
    .eq('campagne_id', campagneId)
    .eq('washer_id', washerId)

  if (error) return errorResponse('creations.delete', error, { washerId })
  logger.info('creations.deleted', { washerId })
  return NextResponse.json({ ok: true })
}
