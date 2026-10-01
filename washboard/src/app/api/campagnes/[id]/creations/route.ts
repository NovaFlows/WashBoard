import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { migrationEnAttente, MESSAGE_EN_ATTENTE } from '@/lib/migrationEnAttente'
import { hasFeature, requiredPlanLabel } from '@/lib/plan'
import {
  cleDepuisNom, cleUnique, erreurCreation, estFormat, MESSAGES_ERREUR_CREATION,
} from '@/lib/campagne'

/** Nombre maximum de créations par campagne.
 *
 *  Pas une limite commerciale : un garde-fou. Au-delà, l'écran devient
 *  illisible et chaque bilan porte sur trois clics — donc sur rien. Un laveur
 *  qui diffuse trente vidéos n'a pas un problème que WashBoard doit afficher. */
const CREATIONS_MAX = 30

/** Ajout d'une création (une vidéo) à une campagne.
 *
 *  Le verrou d'offre est posé ICI autant que sur l'écran : un écran caché ne
 *  protège rien, la route reste appelable à la main. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: campagneId } = await params

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Le plan est relu ici et pas seulement l'identifiant : une offre peut avoir
  // été rétrogradée depuis la création de la campagne.
  const { data: washer, error: errWasher } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id).single()

  if (errWasher) logger.error('creations.washer.read_failed', {}, errWasher)
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
  const format = estFormat(body.format) ? body.format : 'video'
  // Le budget par vidéo est facultatif : vide veut dire « je ne sais pas », ce
  // qui est le cas courant quand Meta répartit le budget tout seul. Zéro et
  // inconnu ne sont pas la même chose, et l'écran ne doit pas les confondre.
  const budget = body.budget === undefined || body.budget === null || body.budget === ''
    ? null
    : (typeof body.budget === 'string' ? Number(body.budget.replace(',', '.')) : body.budget)

  const faute = erreurCreation({ nom, budget })
  if (faute) return NextResponse.json({ error: MESSAGES_ERREUR_CREATION[faute] }, { status: 400 })

  // Le filtre sur `washer_id` double la RLS : sans lui, l'isolation reposerait
  // entièrement sur une policy, et une policy se modifie sans que le code le
  // sache (voir requireWasher.ts).
  const { data: campagne, error: errCampagne } = await supabase
    .from('campagnes')
    .select('id')
    .eq('id', campagneId)
    .eq('washer_id', washer.id)
    .maybeSingle()

  if (errCampagne) return errorResponse('creations.campagne.read', errCampagne, { washerId: washer.id })
  if (!campagne) return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })

  const { data: existantes, error: errLecture } = await supabase
    .from('campagne_creations')
    .select('cle')
    .eq('campagne_id', campagneId)
    .eq('washer_id', washer.id)

  if (errLecture) {
    // Table absente : la fonctionnalité n'est pas en service, ce n'est pas une
    // panne. Même message que partout ailleurs — un laveur qui lit deux
    // formulations différentes pour la même cause croit à deux problèmes.
    if (migrationEnAttente(errLecture)) {
      logger.warn('creations.migration_en_attente', { washerId: washer.id })
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('creations.cles.read', errLecture, { washerId: washer.id })
  }

  if ((existantes ?? []).length >= CREATIONS_MAX) {
    return NextResponse.json(
      { error: `Une campagne ne peut pas suivre plus de ${CREATIONS_MAX} vidéos.` },
      { status: 400 },
    )
  }

  const cle = cleUnique(cleDepuisNom(nom), (existantes ?? []).map(c => c.cle as string))
  if (!cle) return NextResponse.json({ error: MESSAGES_ERREUR_CREATION.cle }, { status: 400 })

  const { data, error } = await supabase
    .from('campagne_creations')
    .insert({ campagne_id: campagneId, washer_id: washer.id, nom, format, cle, budget })
    .select('id, campagne_id, nom, format, cle, budget')
    .single()

  if (error) {
    if (migrationEnAttente(error)) {
      return NextResponse.json({ error: MESSAGE_EN_ATTENTE }, { status: 503 })
    }
    return errorResponse('creations.insert', error, { washerId: washer.id })
  }

  logger.info('creations.created', { washerId: washer.id, format })
  return NextResponse.json({ data }, { status: 201 })
}
