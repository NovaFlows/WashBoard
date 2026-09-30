import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { trouverCompteParEmail } from '@/lib/compteParEmail'

// « Mauvaise adresse ? Recommencer » depuis /verifier-email : supprime le compte
// en attente pour que l'inscrit refasse son inscription avec la bonne adresse.
//
// Pourquoi supprimer plutôt que changer l'adresse en place : Supabase ne
// vérifie pas qu'un lien de confirmation correspond à l'adresse ACTUELLE du
// compte. Un compte créé sous l'adresse d'un tiers, basculé vers la sienne,
// pouvait être confirmé par le lien parti vers l'adresse d'origine — et se
// retrouver « confirmé » sous une adresse jamais vérifiée (revue sécurité du
// 2026-09-29). Supprimé, le compte emporte ses jetons avec lui.
//
// La preuve d'identité est le mot de passe : Supabase ne répond
// `email_not_confirmed` QU'APRÈS l'avoir validé (internal/api/token.go). Toute
// autre issue reçoit le message de /login, qui ne distingue jamais un mauvais
// mot de passe d'un compte inexistant.
//
// Un compte déjà confirmé n'est jamais supprimé ici.

const HEURE_MS = 60 * 60 * 1000
const MAX_PAR_HEURE = 5
const REFUS = 'Email ou mot de passe incorrect'
const INDISPONIBLE = 'Service momentanément indisponible. Réessaie dans un instant.'
const DEJA_CONFIRME = 'Ton email est déjà confirmé : reconnecte-toi.'

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }

  const corps = await req.json().catch(() => null) as { email?: unknown; password?: unknown } | null
  const email = typeof corps?.email === 'string' ? corps.email.trim() : ''
  const password = typeof corps?.password === 'string' ? corps.password : ''
  if (!email.includes('@') || !password) {
    return NextResponse.json({ error: REFUS }, { status: 400 })
  }

  // Par adresse en plus de l'IP : sans cela, on offrait un essai de mot de
  // passe par requête à qui changerait d'IP.
  cleanupRateLimit()
  const ip = clientIp(req)
  const trop = !rateLimit(`restart-signup-ip:${ip}`, MAX_PAR_HEURE, HEURE_MS).ok
            || !rateLimit(`restart-signup-mail:${email.toLowerCase()}`, MAX_PAR_HEURE, HEURE_MS).ok
  if (trop) {
    logger.warn('auth.restart_signup.rate_limited', { ip })
    return NextResponse.json({ error: 'Trop de demandes. Réessaie dans une heure.' }, { status: 429 })
  }

  const anonyme = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: connexion, error: erreurConnexion } = await anonyme.auth.signInWithPassword({ email, password })
  if (connexion?.session) {
    // Portée « local » : le défaut (« global ») fermerait aussi les sessions
    // ouvertes sur les autres appareils du laveur.
    const { error: erreurSortie } = await anonyme.auth.signOut({ scope: 'local' })
    if (erreurSortie) logger.warn('auth.restart_signup.sign_out_failed', { userId: connexion.user?.id ?? null }, erreurSortie)
    return NextResponse.json({ error: DEJA_CONFIRME, confirme: true }, { status: 403 })
  }
  if (erreurConnexion?.code !== 'email_not_confirmed') {
    if (erreurConnexion && erreurConnexion.code !== 'invalid_credentials') {
      logger.warn('auth.restart_signup.sign_in_failed', { code: erreurConnexion.code ?? null })
    }
    return NextResponse.json({ error: REFUS }, { status: 400 })
  }

  // Parcours de la liste des comptes acceptable ici : l'appelant vient de
  // prouver le mot de passe, la recherche ne peut donc servir à sonder quelles
  // adresses ont un compte.
  const admin = createAdminClient()
  let compte
  try {
    compte = await trouverCompteParEmail(admin, email)
  } catch (e) {
    logger.error('auth.restart_signup.user_lookup_failed', {}, e)
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  if (!compte) {
    // Supabase vient de reconnaître ce compte : le perdre ici est anormal.
    logger.error('auth.restart_signup.user_not_found_after_sign_in', {})
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  if (compte.email_confirmed_at) {
    logger.warn('auth.restart_signup.already_confirmed', { userId: compte.id })
    return NextResponse.json({ error: DEJA_CONFIRME, confirme: true }, { status: 403 })
  }

  // La fiche d'abord, le compte ensuite. Dans l'autre ordre, un échec au
  // second pas laissait une fiche orpheline qui garde le numéro de téléphone
  // (unique par compte) : l'inscrit ne pouvait plus se réinscrire. Dans cet
  // ordre, un échec laisse le compte intact et « recommencer » peut simplement
  // être relancé.
  const { error: erreurFiche } = await admin.from('washers').delete().eq('user_id', compte.id)
  if (erreurFiche) {
    logger.error('auth.restart_signup.washer_delete_failed', { userId: compte.id }, erreurFiche)
    return NextResponse.json({ error: 'La suppression a échoué. Réessaie dans un instant.' }, { status: 500 })
  }

  const { error: erreurCompte } = await admin.auth.admin.deleteUser(compte.id)
  if (erreurCompte) {
    logger.error('auth.restart_signup.user_delete_failed', { userId: compte.id }, erreurCompte)
    return NextResponse.json({ error: 'La suppression a échoué. Réessaie dans un instant.' }, { status: 500 })
  }

  logger.info('auth.restart_signup.deleted', { userId: compte.id })
  return NextResponse.json({ success: true })
}
