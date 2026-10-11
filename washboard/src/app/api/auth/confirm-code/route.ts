import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { suiteConfirmation } from '@/lib/confirmationSuite'
import { etatOnboarding } from '@/lib/onboarding'

// Code de confirmation saisi sur /verifier-email (voir `lib/confirmationEmail`
// pour pourquoi un code plutôt qu'un lien — en résumé, un lien ouvert depuis
// l'app Mail de l'iPhone atterrit dans Safari, jamais dans la PWA installée,
// qui ne voit alors jamais la session qui vient de s'ouvrir).
//
// La validation ouvre une session dans des cookies, posés sur CETTE réponse :
// contrairement au lien (`app/auth/confirm/route.ts`), le code est forcément
// saisi dans l'app qui l'a demandé, donc toujours dans le bon contexte.
//
// Plafonné comme `resend-confirmation` : un code à 6 chiffres se devine en
// 10^6 essais, le plafond par adresse ferme cette porte largement avant.

const HEURE_MS = 60 * 60 * 1000
const IP_MAX_PAR_HEURE = 20
const EMAIL_MAX_PAR_HEURE = 10
const CODE_INVALIDE = 'Code invalide ou expiré. Vérifie-le, ou demande-en un nouveau.'

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }

  const corps = await req.json().catch(() => null) as { email?: unknown; code?: unknown } | null
  const email = typeof corps?.email === 'string' ? corps.email.trim() : ''
  const code = typeof corps?.code === 'string' ? corps.code.trim() : ''
  // 8 chiffres aujourd'hui (mesuré via `generateLink`, pas documenté ailleurs :
  // la longueur de l'OTP email est un réglage du tableau de bord Supabase, pas
  // du code). Plage tolérante plutôt que `{8}` strict, pour ne pas casser au
  // prochain changement de ce réglage sans déploiement.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6,10}$/.test(code)) {
    return NextResponse.json({ error: CODE_INVALIDE }, { status: 400 })
  }

  cleanupRateLimit()
  const ip = clientIp(req)
  const trop = !rateLimit(`confirm-code-ip:${ip}`, IP_MAX_PAR_HEURE, HEURE_MS).ok
            || !rateLimit(`confirm-code-mail:${email.toLowerCase()}`, EMAIL_MAX_PAR_HEURE, HEURE_MS).ok
  if (trop) {
    logger.warn('auth.confirm_code.rate_limited', { ip })
    return NextResponse.json({ error: 'Trop de tentatives. Réessaie dans une heure, ou demande un nouveau code.' }, { status: 429 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
  if (error || !data.user) {
    // Cas courant et sans gravité (code déjà utilisé, expiré, ou mal recopié) :
    // pas une panne.
    logger.warn('auth.confirm_code.invalid', { code: error?.code ?? null })
    return NextResponse.json({ error: CODE_INVALIDE }, { status: 400 })
  }

  const user = data.user
  logger.info('auth.confirm_code.email_confirmed', { userId: user.id })

  await suiteConfirmation(user.id, user.email ?? '')

  // C'est la toute première connexion de presque tous les inscrits : la
  // validation du code ouvre la session. Lue après la reprise de l'aperçu,
  // qui peut changer le lien que l'onboarding va proposer.
  const { destination } = await etatOnboarding(createAdminClient(), user.id)
  return NextResponse.json({ success: true, destination })
}
