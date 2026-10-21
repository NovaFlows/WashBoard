import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { suiteConfirmation } from '@/lib/confirmationSuite'
import { etatOnboarding } from '@/lib/onboarding'
import { trouverCompteParEmail } from '@/lib/compteParEmail'
import { verifierCodeSms } from '@/lib/codeSms'

// Code de confirmation saisi sur /verifier-email. Depuis le 2026-10-21, il arrive par SMS
// (`lib/codeSms`) : c'est le numéro qu'on vérifie, plus l'email. Un code, et pas un lien, pour
// rester dans l'app qui l'a demandé — un lien ouvert depuis Messages ou Mail atterrit dans
// Safari, jamais dans la PWA installée (décision de Ryan du 2026-10-11, inchangée).
//
// Code juste : le compte est marqué confirmé chez Supabase (`email_confirm`, le seul drapeau
// que le reste de l'app regarde — voir `(dashboard)/layout.tsx`), le numéro est daté sur la
// fiche (`telephone_verifie_le`), puis une session s'ouvre dans les cookies de CETTE réponse,
// par un lien magique vérifié sur place (même mécanique que l'accès support).
//
// 5 essais par code (`lib/codeSms`) : un code à 6 chiffres ne se devine pas. Les plafonds
// par adresse IP et par email ci-dessous s'y ajoutent.

const HEURE_MS = 60 * 60 * 1000
const IP_MAX_PAR_HEURE = 20
const EMAIL_MAX_PAR_HEURE = 10
const CODE_INVALIDE = 'Code invalide ou expiré. Vérifie-le, ou demande-en un nouveau.'
const INDISPONIBLE = 'Service momentanément indisponible. Réessaie dans un instant.'

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }

  const corps = await req.json().catch(() => null) as { email?: unknown; code?: unknown } | null
  const email = typeof corps?.email === 'string' ? corps.email.trim() : ''
  const code = typeof corps?.code === 'string' ? corps.code.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
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

  const admin = createAdminClient()
  let compte
  try {
    compte = await trouverCompteParEmail(admin, email)
  } catch (e) {
    logger.error('auth.confirm_code.user_lookup_failed', {}, e)
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  // Pas de compte : même réponse qu'un mauvais code, rien à apprendre ici.
  if (!compte) return NextResponse.json({ error: CODE_INVALIDE }, { status: 400 })
  if (compte.email_confirmed_at) {
    return NextResponse.json({ error: 'Ton inscription est déjà confirmée : connecte-toi.', confirme: true }, { status: 409 })
  }

  const resultat = await verifierCodeSms(admin, compte.id, code)
  if (resultat === 'panne') return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  if (resultat === 'bloque') {
    return NextResponse.json({ error: 'Trop d’essais avec ce code. Demande-en un nouveau.' }, { status: 400 })
  }
  if (resultat !== 'ok') {
    logger.warn('auth.confirm_code.invalid', { userId: compte.id, resultat })
    return NextResponse.json({ error: CODE_INVALIDE }, { status: 400 })
  }

  const { error: erreurConfirmation } = await admin.auth.admin.updateUserById(compte.id, { email_confirm: true })
  if (erreurConfirmation) {
    logger.error('auth.confirm_code.confirm_failed', { userId: compte.id }, erreurConfirmation)
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  logger.info('auth.confirm_code.telephone_confirme', { userId: compte.id })

  const { error: erreurFiche } = await admin
    .from('washers').update({ telephone_verifie_le: new Date().toISOString() }).eq('user_id', compte.id)
  if (erreurFiche) logger.error('auth.confirm_code.washer_write_failed', { userId: compte.id }, erreurFiche)

  await suiteConfirmation(compte.id, compte.email ?? email)

  // C'est la toute première connexion de presque tous les inscrits : la validation du code
  // ouvre la session. Si elle échoue, le compte reste confirmé : l'inscrit se connecte avec
  // son mot de passe, rien n'est perdu.
  const { destination } = await etatOnboarding(admin, compte.id)
  const { data: lien, error: erreurLien } = await admin.auth.admin.generateLink({ type: 'magiclink', email: compte.email ?? email })
  const jeton = lien?.properties?.hashed_token
  if (erreurLien || !jeton) {
    logger.error('auth.confirm_code.session_link_failed', { userId: compte.id }, erreurLien)
    return NextResponse.json({ success: true, destination: '/login' })
  }
  const supabase = await createClient()
  const { error: erreurSession } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: jeton })
  if (erreurSession) {
    logger.error('auth.confirm_code.session_failed', { userId: compte.id }, erreurSession)
    return NextResponse.json({ success: true, destination: '/login' })
  }
  return NextResponse.json({ success: true, destination })
}
