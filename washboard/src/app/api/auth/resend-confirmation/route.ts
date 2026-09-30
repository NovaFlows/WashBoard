import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isTrustedOrigin, trustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { envoyerLienConfirmation } from '@/lib/confirmationEmail'
import { trouverCompteParEmail } from '@/lib/compteParEmail'

// « Renvoyer l'email » depuis /verifier-email, pour l'adresse affichée sur la
// page. Pas de session à ce stade : Supabase la refuse tant que l'email n'est
// pas confirmé.
//
// Chaque appel envoie un vrai email depuis noreply@washboard.fr vers une
// adresse fournie par l'appelant : plafonné par IP et par adresse. Compteurs
// en mémoire, donc par instance — compromis assumé pour rester simple.

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
    // Préfixe « Un email vient de partir » : /verifier-email l'affiche comme
    // une simple attente, pas comme une erreur.
    return NextResponse.json({
      error: `Un email vient de partir. Attends ${minutes} min avant d'en redemander un, et regarde dans tes courriers indésirables.`,
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
    return NextResponse.json({ error: 'Ton email est déjà confirmé. Tu peux te connecter.', confirme: true }, { status: 409 })
  }

  // Le nom ne sert qu'à la formule de politesse : une lecture ratée ne doit pas
  // empêcher l'envoi, mais elle reste tracée.
  const { data: fiches, error: erreurFiche } = await admin
    .from('washers').select('name').eq('user_id', compte.id).limit(1)
  if (erreurFiche) logger.warn('auth.resend_confirmation.washer_read_failed', { userId: compte.id }, erreurFiche)
  const washerName = (fiches?.[0] as { name?: string } | undefined)?.name ?? null

  const envoye = await envoyerLienConfirmation(admin, {
    userId: compte.id,
    email: compte.email ?? email,
    washerName,
    origin: trustedOrigin(req.headers.get('origin')),
  })
  if (!envoye) {
    return NextResponse.json({ error: 'L\'envoi a échoué. Réessaie dans quelques instants.' }, { status: 502 })
  }
  return NextResponse.json({ success: true })
}
