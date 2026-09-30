import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'
import { erreurCampagne, estPlateforme, MESSAGES_ERREUR } from '@/lib/campagne'

/** Modification d'une campagne : budget, dates, nom, plateforme.
 *
 *  La CLÉ n'est jamais modifiable. Elle est déjà collée dans une publicité en
 *  ligne ; la changer couperait l'attribution des visites en cours sans que
 *  personne ne comprenne pourquoi les chiffres se sont arrêtés. Renommer la
 *  campagne ne touche donc que son étiquette.
 *
 *  Le budget, lui, se corrige — c'est même le cas courant : on ajuste une
 *  dépense en cours de route. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Requête illisible' }, { status: 400 })

  // On relit l'existant : une modification partielle doit être validée contre
  // l'état complet, sinon on accepte une date de fin antérieure à un début
  // qu'on n'a pas regardé.
  const { data: actuelle, error: errLecture } = await supabase
    .from('campagnes')
    .select('nom, plateforme, budget, debut, fin')
    .eq('id', id)
    .eq('washer_id', washerId)
    .maybeSingle()

  if (errLecture) return errorResponse('campagnes.read', errLecture, { washerId })
  if (!actuelle) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })

  const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, 120) : actuelle.nom
  const budget = body.budget === undefined
    ? actuelle.budget
    : (typeof body.budget === 'string' ? Number(body.budget.replace(',', '.')) : body.budget)
  const plateforme = estPlateforme(body.plateforme) ? body.plateforme : actuelle.plateforme
  const debut = typeof body.debut === 'string' ? body.debut : actuelle.debut
  const fin = body.fin === undefined ? actuelle.fin : (body.fin || null)

  const faute = erreurCampagne({ nom, budget, debut, fin })
  if (faute) return NextResponse.json({ error: MESSAGES_ERREUR[faute] }, { status: 400 })

  const { data, error } = await supabase
    .from('campagnes')
    .update({ nom, plateforme, budget, debut, fin })
    .eq('id', id)
    .eq('washer_id', washerId)
    .select('id, nom, plateforme, budget, cle, debut, fin')
    .single()

  if (error) return errorResponse('campagnes.update', error, { washerId })
  return NextResponse.json({ data })
}

/** Suppression d'une campagne.
 *
 *  Les réservations gardent leur `utm_campaign` : c'est du texte libre, pas
 *  une clé étrangère. Supprimer une campagne efface son bilan, jamais
 *  l'origine des clients qu'elle a amenés — les recréer plus tard sous la même
 *  clé ferait même réapparaître ses chiffres. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { error } = await supabase
    .from('campagnes')
    .delete()
    .eq('id', id)
    .eq('washer_id', washerId)

  if (error) return errorResponse('campagnes.delete', error, { washerId })
  logger.info('campagnes.deleted', { washerId })
  return NextResponse.json({ ok: true })
}
