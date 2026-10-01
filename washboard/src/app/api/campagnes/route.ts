import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { hasFeature, requiredPlanLabel } from '@/lib/plan'
import {
  cleDepuisNom, cleUnique, erreurCampagne, estPlateforme, MESSAGES_ERREUR,
} from '@/lib/campagne'

/** Création d'une campagne publicitaire.
 *
 *  Le verrou d'offre est posé ICI autant que sur l'écran : un écran caché ne
 *  protège rien, la route reste appelable à la main. C'est le même motif que
 *  toutes les autres fonctionnalités payantes du produit. */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id).single()

  if (errWasher) logger.error('campagnes.washer.read_failed', {}, errWasher)
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  if (!hasFeature(washer, 'campagnes')) {
    return NextResponse.json(
      { error: `Le suivi des campagnes fait partie de l’offre ${requiredPlanLabel('campagnes')}.` },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Requête illisible' }, { status: 400 })

  const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, 120) : ''
  // Le budget arrive parfois en chaîne depuis un `<input type="number">` vidé
  // puis re-rempli : on normalise avant de valider, sinon « 80 » est refusé.
  const budget = typeof body.budget === 'string' ? Number(body.budget.replace(',', '.')) : body.budget
  const plateforme = estPlateforme(body.plateforme) ? body.plateforme : 'meta'
  const debut = typeof body.debut === 'string' ? body.debut : null
  const fin = typeof body.fin === 'string' && body.fin ? body.fin : null

  const faute = erreurCampagne({ nom, budget, debut, fin })
  if (faute) return NextResponse.json({ error: MESSAGES_ERREUR[faute] }, { status: 400 })

  // La clé doit être unique chez CE laveur : deux campagnes qui la partagent
  // additionneraient leurs visites et leurs réservations, et il comparerait un
  // budget à des chiffres qui ne lui correspondent pas.
  const { data: existantes, error: errLecture } = await supabase
    .from('campagnes')
    .select('cle')
    .eq('washer_id', washer.id)

  if (errLecture) {
    // Table absente : la fonctionnalité n'est pas en service, ce n'est pas une
    // panne. Le dire, plutôt que renvoyer « une erreur interne est survenue »
    // et un errorId — le laveur écrirait au support pour un défaut qui n'existe
    // pas, et l'équipe chercherait un bug là où il n'y en a pas.
    if (migrationEnAttente(errLecture)) {
      logger.warn('campagnes.migration_en_attente', { washerId: washer.id })
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('campagnes.cles.read', errLecture, { washerId: washer.id })
  }

  const cle = cleUnique(cleDepuisNom(nom), (existantes ?? []).map(c => c.cle as string))
  if (!cle) return NextResponse.json({ error: MESSAGES_ERREUR.cle }, { status: 400 })

  const { data, error } = await supabase
    .from('campagnes')
    .insert({ washer_id: washer.id, nom, plateforme, budget, cle, debut, fin })
    .select('id, nom, plateforme, budget, cle, debut, fin')
    .single()

  if (error) {
    if (migrationEnAttente(error)) {
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('campagnes.insert', error, { washerId: washer.id })
  }

  logger.info('campagnes.created', { washerId: washer.id, plateforme })
  return NextResponse.json({ data }, { status: 201 })
}
