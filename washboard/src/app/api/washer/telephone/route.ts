import { NextRequest, NextResponse } from 'next/server'
import { createClient as createClientSupabase } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit, cleanupRateLimit, clientIp } from '@/lib/rateLimit'
import { envoyerCodeSms, phraseEnvoi, telephoneMasque, verifierCodeSms } from '@/lib/codeSms'
import { isPhoneExemptFromUniqueness } from '@/lib/phone'
import { codeValide, verifierNouveauNumero } from '@/lib/changerTelephone'

// Changement de numéro d'un laveur connecté (2026-11-10), en deux appels :
//   { etape: 'code', telephone, motDePasse }  → un code part par SMS sur le NOUVEAU numéro ;
//   { etape: 'confirmer', code }              → le code est juste : le numéro change.
//
// Le mot de passe est demandé, comme pour l'adresse e-mail (voir FeuillesConnexionV2) : une
// session ouverte laissée sans surveillance, ou un accès support, ne doit pas suffire à changer
// un identifiant du compte. Le numéro reçu par la route à l'étape 2 n'est JAMAIS celui du
// navigateur : on relit celui auquel le code a été envoyé (table `codes_sms`, une ligne par
// compte), sinon un code obtenu pour un numéro servirait à en valider un autre.
//
// Le SMS suit les garde-fous de `lib/codeSms` (mobiles français seulement, 60 s entre deux envois,
// 5 par demande, plafond global), plus des plafonds par compte et par adresse IP ici.

const HEURE_MS = 60 * 60 * 1000
const INDISPONIBLE = 'Service momentanément indisponible. Réessayez dans un instant.'
/** Une demande restée sans suite depuis plus longtemps n'est plus reprise : sans cela, 5 envois
 *  abandonnés bloqueraient le compte pour toujours. */
const DEMANDE_PERIMEE_MS = HEURE_MS

type Corps = { etape?: unknown; telephone?: unknown; motDePasse?: unknown; code?: unknown }

/** Le mot de passe est-il le bon ? Client jetable : aucune session ne doit en sortir. */
async function motDePasseJuste(email: string, motDePasse: string): Promise<boolean> {
  const anonyme = createClientSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await anonyme.auth.signInWithPassword({ email, password: motDePasse })
  if (data?.session) {
    // Portée « local » : le défaut fermerait aussi les sessions ouvertes sur les autres appareils.
    await anonyme.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
  return !error
}

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await req.json().catch(() => null) as Corps | null
  const etape = corps?.etape
  if (etape !== 'code' && etape !== 'confirmer') return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })

  cleanupRateLimit()
  const ip = clientIp(req)
  const limite = etape === 'code' ? { ip: 20, compte: 6 } : { ip: 30, compte: 12 }
  if (!rateLimit(`tel-${etape}-ip:${ip}`, limite.ip, HEURE_MS).ok || !rateLimit(`tel-${etape}-user:${user.id}`, limite.compte, HEURE_MS).ok) {
    logger.warn('washer.telephone.rate_limited', { userId: user.id, etape })
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans une heure.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: fiches, error: erreurFiche } = await admin.from('washers').select('id, phone').eq('user_id', user.id).limit(1)
  const fiche = fiches?.[0] as { id: string; phone: string | null } | undefined
  if (erreurFiche || !fiche) {
    if (erreurFiche) logger.error('washer.telephone.fiche_illisible', { userId: user.id }, erreurFiche)
    return NextResponse.json({ error: erreurFiche ? INDISPONIBLE : 'Compte introuvable.' }, { status: erreurFiche ? 503 : 404 })
  }

  /** Ce numéro appartient-il déjà à un autre compte ? `null` : on n'a pas pu le savoir. */
  async function dejaPris(telephone: string): Promise<boolean | null> {
    if (isPhoneExemptFromUniqueness(telephone)) return false
    const { data, error } = await admin.from('washers').select('id').eq('phone', telephone).neq('user_id', user!.id).not('is_preview', 'is', true).limit(1)
    if (error) { logger.error('washer.telephone.unicite_illisible', { userId: user!.id }, error); return null }
    return !!data?.length
  }

  // ── Étape 1 : envoyer le code ────────────────────────────────────────────
  if (etape === 'code') {
    const nouveau = verifierNouveauNumero(corps?.telephone, fiche.phone)
    if ('erreur' in nouveau) return NextResponse.json({ error: nouveau.erreur }, { status: 400 })
    const motDePasse = typeof corps?.motDePasse === 'string' ? corps.motDePasse : ''
    if (!user.email || !motDePasse || !await motDePasseJuste(user.email, motDePasse)) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 })
    }

    const pris = await dejaPris(nouveau.telephone)
    // Une lecture en échec laisserait passer le doublon : on préfère demander de réessayer.
    if (pris === null) return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
    // Même phrase qu'à l'inscription : on ne révèle pas à qui appartient le numéro.
    if (pris) return NextResponse.json({ error: 'Ce numéro de téléphone est déjà associé à un compte.' }, { status: 400 })

    await admin.from('codes_sms').delete().eq('user_id', user.id).lt('dernier_envoi_le', new Date(Date.now() - DEMANDE_PERIMEE_MS).toISOString())
    const envoi = await envoyerCodeSms(admin, { userId: user.id, telephone: nouveau.telephone })
    if (!envoi.ok) {
      const statut = envoi.raison === 'attente' ? 429 : envoi.raison === 'panne' ? 502 : 400
      return NextResponse.json({ error: phraseEnvoi(envoi), ...(envoi.raison === 'attente' ? { retryAfter: envoi.secondes } : {}) }, { status: statut })
    }
    logger.info('washer.telephone.code_envoye', { userId: user.id })
    return NextResponse.json({ success: true, telephone: telephoneMasque(nouveau.telephone) })
  }

  // ── Étape 2 : le code est saisi ──────────────────────────────────────────
  const saisi = corps?.code
  if (!codeValide(saisi)) return NextResponse.json({ error: 'Le code a 6 chiffres.' }, { status: 400 })
  const code = saisi.trim()

  const { data: demande, error: erreurDemande } = await admin.from('codes_sms').select('telephone').eq('user_id', user.id).maybeSingle()
  if (erreurDemande) {
    logger.error('washer.telephone.demande_illisible', { userId: user.id }, erreurDemande)
    return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  }
  const nouveauNumero = (demande as { telephone?: string } | null)?.telephone
  if (!nouveauNumero) return NextResponse.json({ error: 'Aucun code demandé. Recommencez depuis le début.' }, { status: 400 })

  // Avant de consommer le code : un doublon apparu entre-temps ne doit pas le brûler pour rien.
  const pris = await dejaPris(nouveauNumero)
  if (pris === null) return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  if (pris) return NextResponse.json({ error: 'Ce numéro de téléphone est déjà associé à un compte.' }, { status: 400 })

  const resultat = await verifierCodeSms(admin, user.id, code)
  if (resultat === 'panne') return NextResponse.json({ error: INDISPONIBLE }, { status: 503 })
  if (resultat === 'bloque') return NextResponse.json({ error: 'Trop d’essais avec ce code. Demandez-en un nouveau.' }, { status: 400 })
  if (resultat !== 'ok') {
    logger.warn('washer.telephone.code_invalide', { userId: user.id, resultat })
    return NextResponse.json({ error: 'Code invalide ou expiré. Vérifiez-le, ou demandez-en un nouveau.' }, { status: 400 })
  }

  const { error: erreurEcriture } = await admin.from('washers')
    .update({ phone: nouveauNumero, telephone_verifie_le: new Date().toISOString() }).eq('user_id', user.id)
  if (erreurEcriture) {
    logger.error('washer.telephone.ecriture_failed', { userId: user.id }, erreurEcriture)
    return NextResponse.json({ error: 'Le numéro n’a pas pu être enregistré. Recommencez.' }, { status: 500 })
  }
  logger.info('washer.telephone.change', { userId: user.id })
  return NextResponse.json({ success: true, telephone: nouveauNumero })
}
