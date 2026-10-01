import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { notifierEquipe } from '@/lib/push'
import { reprendreApercu, annonceReprise, type ResultatReprise } from '@/lib/repriseApercu'
import { FUSEAU } from '@/lib/dateUtils'
import { etatOnboarding } from '@/lib/onboarding'

// Arrivée du lien de confirmation envoyé à l'inscription (voir
// `lib/confirmationEmail`).
//
// Le jeton est validé ici, côté serveur, plutôt que par une redirection de
// Supabase : la validation ouvre une session dans des cookies, ce qui marche
// aussi quand le lien est ouvert sur un autre appareil que celui de
// l'inscription — typiquement l'application mail du téléphone.
//
// Un jeton ne se valide qu'une fois : ce qui suit la confirmation (reprise de
// l'aperçu, notification de l'équipe) ne peut donc se déclencher qu'une fois
// par compte, comme lorsqu'il vivait dans la route d'inscription.

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  if (!tokenHash || type !== 'signup') redirect('/verifier-email?lien=invalide')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'signup' })
  if (error || !data.user) {
    // Cas courant et sans gravité (lien déjà utilisé, expiré, ou déjà ouvert
    // par l'antivirus de la messagerie) : pas une panne.
    logger.warn('auth.confirm.invalid_link', { code: error?.code ?? null })
    redirect('/verifier-email?lien=invalide')
  }

  const user = data.user
  logger.info('auth.confirm.email_confirmed', { userId: user.id })

  await suiteConfirmation(user.id, user.email ?? '')

  // C'est la toute première connexion de presque tous les inscrits : le lien de
  // confirmation ouvre la session. Lu après la reprise de l'aperçu, qui peut
  // changer le lien que l'onboarding va proposer.
  const { destination } = await etatOnboarding(createAdminClient(), user.id)
  redirect(destination)
}

/** Reprise de l'aperçu prospect puis notification de l'équipe.
 *
 *  Jamais bloquant : un raté se rattrape à la main, une confirmation refusée
 *  devant le prospect ne se rattrape pas. */
async function suiteConfirmation(userId: string, email: string) {
  const admin = createAdminClient()
  const { data: fiches, error } = await admin
    .from('washers')
    .select('id, name, phone, trial_ends_at')
    .eq('user_id', userId)
    .limit(1)
  const fiche = fiches?.[0] as { id: string; name: string; phone: string | null; trial_ends_at: string | null } | undefined
  if (error || !fiche) {
    // Sans fiche, ni l'aperçu ni l'annonce ne peuvent partir : il faut que ça
    // se voie, sinon l'inscription passerait inaperçue de l'équipe.
    logger.error('auth.confirm.washer_read_failed', { userId }, error ?? 'fiche introuvable')
    return
  }

  // Le prospect s'inscrit avec le numéro de la page qu'on lui a préparée : elle
  // passe dans son compte (voir `reprendreApercu`).
  let reprise: ResultatReprise
  try {
    reprise = fiche.phone
      ? await reprendreApercu(admin, { id: fiche.id, phone: fiche.phone })
      : { statut: 'aucun' }
  } catch (e) {
    logger.error('signup.apercu_reprise_exception', { userId }, e)
    reprise = { statut: 'echec', etape: 'inattendue', fait: [] }
  }
  if (reprise.statut === 'reprise') {
    logger.info('signup.apercu_repris', { userId, washerId: fiche.id, apercu: reprise.apercu.slug })
  } else if (reprise.statut === 'echec') {
    logger.error('signup.apercu_reprise_echouee', { userId, washerId: fiche.id, etape: reprise.etape, fait: reprise.fait })
  } else if (reprise.statut !== 'aucun') {
    logger.warn('signup.apercu_non_repris', { userId, washerId: fiche.id, statut: reprise.statut })
  }

  // Attendue, pas lancée dans le vide : Vercel coupe la fonction dès la réponse
  // renvoyée, et un envoi non attendu n'aurait pas le temps de partir. La
  // fonction n'échoue jamais.
  const finEssai = fiche.trial_ends_at
    ? new Date(fiche.trial_ends_at).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long' })
    : '?'
  const annonce = annonceReprise(reprise)
  await notifierEquipe({
    title: annonce.titre,
    body: [
      `🏢 ${fiche.name}`,
      `📧 ${email}`,
      `⏳ Essai jusqu'au ${finEssai}`,
      ...annonce.lignes,
    ].join('\n'),
    url: '/dashboard',
    tag: `signup-${userId}`,
  })
}
