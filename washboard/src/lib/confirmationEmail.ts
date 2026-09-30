import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmailConfirmation } from '@/lib/email'
import { logger } from '@/lib/logger'

/** Génère un lien de confirmation pour un compte existant non confirmé et
 *  l'envoie par Resend. Renvoie `false` (après avoir tracé la cause) si l'une
 *  des deux étapes échoue ; ne lève jamais.
 *
 *  Le lien pointe vers NOTRE route `/auth/confirm`, qui valide le jeton côté
 *  serveur (`verifyOtp`) — pas vers le lien `action_link` de Supabase, qui
 *  déposerait la session dans le hash d'une URL que le serveur ne voit pas. */
export async function envoyerLienConfirmation(
  admin: SupabaseClient,
  { userId, email, washerName, origin }: { userId: string; email: string; washerName: string | null; origin: string },
): Promise<boolean> {
  // Le typage exige un mot de passe, que Supabase ignore pour un compte qui
  // existe déjà (internal/api/mail.go). Valeur jetable, jamais conservée.
  // Piège : si le compte n'existait plus, Supabase en CRÉERAIT un avec ce
  // mot de passe — d'où l'appel réservé à un compte qu'on vient de lire.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password: randomBytes(32).toString('base64url'),
  })
  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) {
    logger.error('auth.confirmation.generate_link_failed', { userId }, error)
    return false
  }

  const confirmUrl = `${origin}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=signup`
  try {
    // Resend signale un refus (domaine, quota, adresse rejetée) dans `error`
    // sans lever d'exception : ne regarder que le `catch` laisserait croire
    // que l'email est parti.
    const { error: envoiErreur } = await sendEmailConfirmation({ to: email, washerName, confirmUrl })
    if (envoiErreur) {
      logger.error('auth.confirmation.send_failed', { userId }, envoiErreur)
      return false
    }
  } catch (e) {
    logger.error('auth.confirmation.send_failed', { userId }, e)
    return false
  }
  logger.info('auth.confirmation.sent', { userId })
  return true
}
