import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { suiteConfirmation } from '@/lib/confirmationSuite'
import { etatOnboarding } from '@/lib/onboarding'

// Arrivée du lien de confirmation — l'inscription envoie désormais un CODE
// (voir `lib/confirmationEmail`, `app/api/auth/confirm-code/route.ts`), cette
// route ne reçoit donc plus que les emails de confirmation partis AVANT ce
// changement (2026-10-11). Gardée pour ceux-là, pas pour être réutilisée.
//
// Le jeton est validé ici, côté serveur, plutôt que par une redirection de
// Supabase : la validation ouvre une session dans des cookies, ce qui marche
// aussi quand le lien est ouvert sur un autre appareil que celui de
// l'inscription — typiquement l'application mail du téléphone.
//
// Un jeton ne se valide qu'une fois : ce qui suit la confirmation (reprise de
// l'aperçu, notification de l'équipe, dans `suiteConfirmation`, partagée avec
// la route par code) ne peut donc se déclencher qu'une fois par compte, comme
// lorsqu'il vivait dans la route d'inscription.

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
