import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { erreurCampagne, estPlateforme, MESSAGES_ERREUR } from '@/lib/campagne'

/** Modification d'une campagne : budget, dates, nom, plateforme.
 *
 *  La CLÉ n'est jamais modifiable. Elle est déjà collée dans une publicité en
 *  ligne ; la changer couperait l'attribution des visites en cours sans que
 *  personne ne comprenne pourquoi les chiffres se sont arrêtés. Renommer la
 *  campagne ne touche donc que son étiquette.
 *
 *  Le budget, lui, se corrige — c'est même le cas courant, et c'est pour ça
 *  que cette route existe : on rallonge une campagne, on remet de l'argent
 *  dessus, et le lien déjà en ligne dans la publicité ne doit surtout pas
 *  changer. Changer l'URL d'une annonce en cours remet à zéro l'apprentissage
 *  de la plateforme, qui cesse alors de la diffuser. */
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

  if (errLecture) {
    if (migrationEnAttente(errLecture)) {
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('campagnes.read', errLecture, { washerId })
  }
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

  // La date de saisie ne bouge QUE si le montant change. Sans cette condition,
  // renommer sa campagne suffirait à faire croire que le budget vient d'être
  // vérifié — et l'avertissement « ce montant date de 47 jours », qui est tout
  // l'intérêt de la colonne, ne se déclencherait plus jamais.
  const budgetChange = Number(budget) !== Number(actuelle.budget)
  const champs: Record<string, unknown> = { nom, plateforme, budget, debut, fin }
  if (budgetChange) champs.budget_maj_le = new Date().toISOString()

  let { data, error } = await supabase
    .from('campagnes')
    .update(champs)
    .eq('id', id)
    .eq('washer_id', washerId)
    .select('id, nom, plateforme, budget, cle, debut, fin, budget_maj_le')
    .single()

  // Colonne absente (migration 009 non exécutée) : on réécrit sans elle plutôt
  // que de refuser la modification. Perdre l'horodatage est regrettable ;
  // empêcher un laveur de corriger son budget l'est beaucoup plus.
  if (error) {
    const seconde = await supabase
      .from('campagnes')
      .update({ nom, plateforme, budget, debut, fin })
      .eq('id', id)
      .eq('washer_id', washerId)
      .select('id, nom, plateforme, budget, cle, debut, fin')
      .single()
    data = seconde.data ? { ...seconde.data, budget_maj_le: null } : null
    error = seconde.error
  }

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

  if (error) {
    if (migrationEnAttente(error)) {
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('campagnes.delete', error, { washerId })
  }
  logger.info('campagnes.deleted', { washerId })
  return NextResponse.json({ ok: true })
}
