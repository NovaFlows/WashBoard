import { randomBytes } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmailConfirmation } from '@/lib/email'
import { logger } from '@/lib/logger'

/** Génère un code de confirmation à 6 chiffres pour un compte existant non
 *  confirmé et l'envoie par Resend. Renvoie `false` (après avoir tracé la
 *  cause) si l'une des deux étapes échoue ; ne lève jamais.
 *
 *  Le code se vérifie avec `supabase.auth.verifyOtp({ email, token, type:
 *  'signup' })` (`app/api/auth/confirm-code/route.ts`), sans jamais quitter
 *  l'app qui l'a demandé — contrairement à un lien, qui sur iPhone ouvre
 *  Safari plutôt que la PWA installée (un lien ouvert depuis l'app Mail
 *  n'atterrit jamais dans une PWA, et Safari a son propre tiroir de cookies,
 *  séparé de celui de l'app : la confirmation s'y ferait, mais dans un
 *  contexte que la PWA ne voit jamais). Décidé par Ryan le 2026-10-11 après
 *  avoir buté sur exactement ce problème en testant l'inscription depuis
 *  l'app installée sur son iPhone. */
export async function envoyerCodeConfirmation(
  admin: SupabaseClient,
  { userId, email, washerName }: { userId: string; email: string; washerName: string | null },
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
  const code = data?.properties?.email_otp
  if (error || !code) {
    logger.error('auth.confirmation.generate_link_failed', { userId }, error)
    return false
  }

  try {
    // Resend signale un refus (domaine, quota, adresse rejetée) dans `error`
    // sans lever d'exception : ne regarder que le `catch` laisserait croire
    // que l'email est parti.
    const { error: envoiErreur } = await sendEmailConfirmation({ to: email, washerName, code })
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
