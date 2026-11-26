import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportMember } from '@/lib/supportAccess'
import { uuidValide } from '@/lib/uuid'
import { payeJusquAu, validerPaiement } from '@/lib/paiementEquipe'
import { recompenserParrain } from '@/lib/parrainageServeur'

// « Paiement reçu » (fiche laveur, espace équipe) : active l'abonnement d'un laveur qui a payé
// par PayPal ou virement, garde une trace de qui l'a confirmé, et donne son mois au parrain
// si c'est le premier paiement d'un filleul. Remplace l'activation à la main en SQL.
const DOUBLON_MS = 24 * 60 * 60 * 1000

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('support.paiement.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await params
  if (!uuidValide(id)) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })

  const corps = await request.json().catch(() => null) as { confirmerDoublon?: unknown } | null
  const saisie = validerPaiement(corps)
  if ('erreur' in saisie) return NextResponse.json({ error: saisie.erreur }, { status: 400 })

  const admin = createAdminClient()
  const { data: laveur, error: errLecture } = await admin
    .from('washers')
    .select('id, name, user_id, grandfathered, subscription_status, trial_ends_at, subscription_ends_at, pro_offert_jusqu_au')
    .eq('id', id)
    .maybeSingle()
  if (errLecture) {
    logger.error('support.paiement.lecture', { washerId: id }, errLecture)
    return NextResponse.json({ error: 'Lecture du compte impossible. Réessayez.' }, { status: 503 })
  }
  if (!laveur) return NextResponse.json({ error: 'Laveur introuvable' }, { status: 404 })
  if (laveur.user_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas confirmer le paiement de votre propre compte.' }, { status: 403 })
  }

  // Deux confirmations du même virement (deux membres de l'équipe, ou la feuille rouverte)
  // ajouteraient deux périodes : la seconde doit être voulue.
  if (corps?.confirmerDoublon !== true) {
    const depuis = new Date(Date.now() - DOUBLON_MS).toISOString()
    const { data: recent, error: errRecent } = await admin
      .from('paiements_abonnement')
      .select('offre, duree_mois, confirme_le')
      .eq('washer_id', id)
      .gte('confirme_le', depuis)
      .order('confirme_le', { ascending: false })
      .limit(1)
    if (errRecent) {
      logger.error('support.paiement.doublon_lecture', { washerId: id }, errRecent)
      return NextResponse.json({ error: 'Lecture des paiements impossible. Réessayez.' }, { status: 503 })
    }
    const dernier = recent?.[0]
    if (dernier) {
      return NextResponse.json({
        error: 'Un paiement a déjà été confirmé pour ce laveur il y a moins de 24 heures.',
        doublon: { offre: dernier.offre, dureeMois: dernier.duree_mois, confirmeLe: dernier.confirme_le },
      }, { status: 409 })
    }
  }

  const jusquAu = payeJusquAu(laveur, saisie.dureeMois)
  // Payé pendant l'essai sur une offre sous le Pro : il garde le Pro jusqu'à la fin de l'essai.
  const finEssai = laveur.subscription_status === 'trial' && laveur.trial_ends_at && new Date(laveur.trial_ends_at) > new Date()
    ? laveur.trial_ends_at
    : null
  const { error: errMaj } = await admin.from('washers').update({
    plan: saisie.offre,
    subscription_status: 'active',
    subscription_ends_at: jusquAu,
    ...(finEssai && saisie.offre === 'starter' && !(laveur.pro_offert_jusqu_au && new Date(laveur.pro_offert_jusqu_au) >= new Date(finEssai))
      ? { pro_offert_jusqu_au: finEssai }
      : {}),
  }).eq('id', id)
  if (errMaj) {
    logger.error('support.paiement.activation', { washerId: id }, errMaj)
    return NextResponse.json({ error: 'Activation impossible. Réessayez.' }, { status: 500 })
  }

  const { error: errTrace } = await admin.from('paiements_abonnement').insert({
    washer_id: id,
    offre: saisie.offre,
    duree_mois: saisie.dureeMois,
    confirme_par: user.id,
    paye_jusqu_au: jusquAu,
  })
  if (errTrace) logger.error('support.paiement.trace', { washerId: id }, errTrace)
  logger.info('support.paiement.confirme', { washerId: id, offre: saisie.offre, dureeMois: saisie.dureeMois, par: user.id })

  const parrainage = await recompenserParrain(admin, { id: laveur.id, name: laveur.name }, 'equipe')

  return NextResponse.json({
    ok: true,
    payeJusquAu: jusquAu,
    traceEnregistree: !errTrace,
    parrainage: parrainage.statut === 'recompense'
      ? { statut: 'recompense', parrain: parrainage.parrainNom, forme: parrainage.forme }
      : { statut: parrainage.statut },
  })
}
