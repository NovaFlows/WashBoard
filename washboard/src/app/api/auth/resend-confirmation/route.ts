import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { envoyerCodeSms, phraseEnvoi, telephoneMasque } from '@/lib/codeSms'
import { trouverCompteParEmail } from '@/lib/compteParEmail'

// « Renvoyer le code » depuis /verifier-email, pour l'inscription dont l'adresse est affichée
// sur la page. Pas de session à ce stade : le compte n'est pas encore confirmé.
//
// Depuis le 2026-10-21 le code part par SMS, au numéro donné à l'inscription (`lib/codeSms`,
// qui porte aussi les plafonds par compte et le plafond global). Plafonné en plus ici par IP
// et par adresse. Compteurs en mémoire, donc par instance — compromis assumé.

const HEURE_MS = 60 * 60 * 1000
const IP_MAX_PAR_HEURE = 5
const EMAIL_MAX_PAR_HEURE = 3
const INDISPONIBLE = 'Service momentanément indisponible. Réessaie dans un instant.'

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }

  const corps = await req.json().catch(() => null) as { email?: unknown } | null
  const email = typeof corps?.email === 'string' ? corps.email.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 })
  }

  cleanupRateLimit()
  const ip = clientIp(req)
  if (!rateLimit(`confirm-resend-ip:${ip}`, IP_MAX_PAR_HEURE, HEURE_MS).ok) {
    logger.warn('auth.resend_confirmation.rate_limited_ip', { ip })
    return NextResponse.json({ error: 'Trop de demandes. Réessaie dans une heure.' }, { status: 429 })
  }
  const parAdresse = rateLimit(`confirm-resend-mail:${email.toLowerCase()}`, EMAIL_MAX_PAR_HEURE, HEURE_MS)
  if (!parAdresse.ok) {
    const minutes = Math.ceil(parAdresse.retryAfter / 60)
    // Préfixe « Un SMS vient de partir » : /verifier-email l'affiche comme
    // une simple attente, pas comme une erreur.
    return NextResponse.json({
      error: `Un SMS vient de partir. Attends ${minutes} min avant d'en redemander un.`,
      retryAfter: parAdresse.retryAfter,
    }, { status: 429 })
  }

  const admin = createAdminClient()

  // Indispensable avant `generateLink` : sur une adresse sans compte, Supabase
  // n'échoue pas, il CRÉE un compte (internal/api/mail.go). Sans cette lecture,
  // n'importe qui pouvait ouvrir des comptes au nom de tiers et leur faire
  // envoyer nos emails.
  //
  // Dire qu'aucun compte n'existe ne révèle rien de plus que l'inscription,
  // qui répond déjà « Cet email est déjà utilisé ».
  let compte
  try {
    compte = await trouverCompteParEmail(admin, email)
  } catch (e) {
    logger.error('auth.resend_confirmation.user_lookup_failed', {}, e)
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  if (!compte) {
    return NextResponse.json({ error: 'Aucune inscription en attente pour cette adresse. Vérifie-la, ou inscris-toi.' }, { status: 404 })
  }
  if (compte.email_confirmed_at) {
    return NextResponse.json({ error: 'Ton inscription est déjà confirmée. Tu peux te connecter.', confirme: true }, { status: 409 })
  }

  const { data: fiches, error: erreurFiche } = await admin
    .from('washers').select('phone').eq('user_id', compte.id).limit(1)
  if (erreurFiche) {
    logger.error('auth.resend_confirmation.washer_read_failed', { userId: compte.id }, erreurFiche)
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  const telephone = (fiches?.[0] as { phone?: string | null } | undefined)?.phone ?? ''

  const envoi = await envoyerCodeSms(admin, { userId: compte.id, telephone })
  if (!envoi.ok) {
    const statut = envoi.raison === 'attente' ? 429 : envoi.raison === 'panne' ? 502 : 400
    return NextResponse.json({ error: phraseEnvoi(envoi), ...(envoi.raison === 'attente' ? { retryAfter: envoi.secondes } : {}) }, { status: statut })
  }
  return NextResponse.json({ success: true, telephone: telephoneMasque(telephone) })
}
