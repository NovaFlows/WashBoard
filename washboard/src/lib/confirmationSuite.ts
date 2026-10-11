import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { notifierEquipe } from '@/lib/push'
import { reprendreApercu, annonceReprise, type ResultatReprise } from '@/lib/repriseApercu'
import { FUSEAU } from '@/lib/dateUtils'

/** Reprise de l'aperçu prospect puis notification de l'équipe, une fois
 *  l'email confirmé — par lien (`app/auth/confirm/route.ts`, gardé pour les
 *  emails déjà partis avant le passage au code) ou par code
 *  (`app/api/auth/confirm-code/route.ts`), peu importe lequel des deux a
 *  validé le compte.
 *
 *  Jamais bloquant : un raté se rattrape à la main, une confirmation refusée
 *  devant le prospect ne se rattrape pas. */
export async function suiteConfirmation(userId: string, email: string) {
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
