import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { sendSms, EXPEDITEUR_SMS_DEFAUT } from '@/lib/sms'

// Confirmation de l'inscription par un code reçu par SMS (décision d'Alexandre, 2026-10-21) :
// remplace le code par email. Un compte n'est utilisable qu'une fois son numéro vérifié — fini
// les inscriptions avec un numéro inventé (« merci pour les travaux », numéro non attribué).
//
// Le code n'est jamais stocké en clair : table `codes_sms` (une ligne par compte en attente,
// lisible par le seul serveur), empreinte HMAC, 10 minutes de validité, 5 essais.
//
// Le vrai risque d'un envoi de SMS ouvert à tous est la fraude (« SMS pumping ») : des robots
// déclenchent des milliers d'envois vers des numéros surtaxés, et la facture grimpe en une
// nuit. Parades, toutes ici :
//   - mobiles français seulement (06, 07) — les numéros surtaxés visés sont à l'étranger ;
//   - 60 s entre deux envois, 5 envois au plus par compte ;
//   - un plafond global : au-delà de PLAFOND_24H comptes en attente sur 24 h, plus aucun SMS,
//     et l'erreur se voit dans les journaux. Les comptes confirmés quittent la table : seuls
//     les comptes jamais confirmés (ceux d'un robot) remplissent le plafond.

export const LONGUEUR_CODE_SMS = 6
const VALIDITE_MS = 10 * 60 * 1000
const ESSAIS_MAX = 5
const ENVOIS_MAX = 5
const DELAI_RENVOI_MS = 60 * 1000
const PLAFOND_24H = 30

/** Un mobile français, sous la forme canonique de `normalizePhone` (10 chiffres). */
export function estMobileFrancais(telephone: string | null | undefined): boolean {
  return /^0[67]\d{8}$/.test(telephone ?? '')
}

/** « 06 •• •• •• 78 » : assez pour reconnaître son numéro, sans l'afficher. */
export function telephoneMasque(telephone: string): string {
  return `${telephone.slice(0, 2)} •• •• •• ${telephone.slice(-2)}`
}

/** Texte du SMS. La dernière ligne (« @domaine #code ») permet au téléphone de proposer le
 *  code tout seul au-dessus du clavier, rattaché au bon site. Un seul segment (< 160 car.). */
export function texteSmsCode(code: string): string {
  return `WashBoard : votre code de confirmation est ${code}. Il expire dans 10 minutes.\n\n@www.washboard.fr #${code}`
}

function empreinte(userId: string, code: string): string {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'washboard').update(`${userId}:${code}`).digest('hex')
}

function nouveauCode(): string {
  return String(randomInt(0, 10 ** LONGUEUR_CODE_SMS)).padStart(LONGUEUR_CODE_SMS, '0')
}

export type EnvoiCode =
  | { ok: true }
  | { ok: false; raison: 'numero' | 'trop_d_envois' | 'plafond' | 'panne' }
  | { ok: false; raison: 'attente'; secondes: number }

/** Envoie (ou renvoie) un code au numéro du compte. Ne lève jamais : l'appelant affiche la
 *  raison. Un nouveau code remplace l'ancien et remet les essais à zéro. */
export async function envoyerCodeSms(
  admin: SupabaseClient,
  { userId, telephone }: { userId: string; telephone: string },
  maintenant: Date = new Date(),
): Promise<EnvoiCode> {
  if (!estMobileFrancais(telephone)) return { ok: false, raison: 'numero' }
  try {
    const { data: existant, error: erreurLecture } = await admin
      .from('codes_sms').select('envois, dernier_envoi_le').eq('user_id', userId).maybeSingle()
    if (erreurLecture) throw erreurLecture
    if (existant) {
      const ecoule = maintenant.getTime() - new Date(existant.dernier_envoi_le as string).getTime()
      if (ecoule < DELAI_RENVOI_MS) return { ok: false, raison: 'attente', secondes: Math.ceil((DELAI_RENVOI_MS - ecoule) / 1000) }
      if (Number(existant.envois) >= ENVOIS_MAX) return { ok: false, raison: 'trop_d_envois' }
    } else {
      const depuis = new Date(maintenant.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const { count, error: erreurCompte } = await admin
        .from('codes_sms').select('user_id', { count: 'exact', head: true }).gte('dernier_envoi_le', depuis)
      if (erreurCompte) throw erreurCompte
      if ((count ?? 0) >= PLAFOND_24H) {
        logger.error('auth.code_sms.plafond_atteint', { enAttente: count, plafond: PLAFOND_24H })
        return { ok: false, raison: 'plafond' }
      }
    }

    const code = nouveauCode()
    const { error: erreurEcriture } = await admin.from('codes_sms').upsert({
      user_id: userId,
      telephone,
      code_hash: empreinte(userId, code),
      expire_le: new Date(maintenant.getTime() + VALIDITE_MS).toISOString(),
      essais: 0,
      envois: Number(existant?.envois ?? 0) + 1,
      dernier_envoi_le: maintenant.toISOString(),
    }, { onConflict: 'user_id' })
    if (erreurEcriture) throw erreurEcriture

    await sendSms({ to: telephone, content: texteSmsCode(code), sender: EXPEDITEUR_SMS_DEFAUT })
    logger.info('auth.code_sms.envoye', { userId })
    return { ok: true }
  } catch (e) {
    logger.error('auth.code_sms.envoi_failed', { userId }, e)
    return { ok: false, raison: 'panne' }
  }
}

export type VerificationCode = 'ok' | 'invalide' | 'expire' | 'bloque' | 'absent' | 'panne'

/** Vérifie le code tapé. Réussi, la ligne disparaît : le code ne sert qu'une fois. */
export async function verifierCodeSms(
  admin: SupabaseClient,
  userId: string,
  code: string,
  maintenant: Date = new Date(),
): Promise<VerificationCode> {
  try {
    const { data: ligne, error } = await admin
      .from('codes_sms').select('code_hash, expire_le, essais').eq('user_id', userId).maybeSingle()
    if (error) throw error
    if (!ligne) return 'absent'
    if (Number(ligne.essais) >= ESSAIS_MAX) return 'bloque'
    if (new Date(ligne.expire_le as string).getTime() < maintenant.getTime()) return 'expire'

    const attendu = Buffer.from(String(ligne.code_hash), 'hex')
    const recu = Buffer.from(empreinte(userId, code), 'hex')
    if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) {
      await admin.from('codes_sms').update({ essais: Number(ligne.essais) + 1 }).eq('user_id', userId)
      return Number(ligne.essais) + 1 >= ESSAIS_MAX ? 'bloque' : 'invalide'
    }
    await admin.from('codes_sms').delete().eq('user_id', userId)
    return 'ok'
  } catch (e) {
    logger.error('auth.code_sms.verification_failed', { userId }, e)
    return 'panne'
  }
}

/** La phrase à afficher pour un envoi refusé. */
export function phraseEnvoi(r: Exclude<EnvoiCode, { ok: true }>): string {
  switch (r.raison) {
    case 'attente': return `Un SMS vient de partir. Attends ${r.secondes} s avant d'en redemander un.`
    case 'numero': return 'Il faut un numéro de mobile français (06 ou 07) : le code arrive par SMS.'
    case 'trop_d_envois': return 'Trop de codes demandés pour cette inscription. Recommence-la, ou écris-nous à contact@washboard.fr.'
    case 'plafond': return 'Trop d’inscriptions en ce moment. Réessaie dans quelques heures, ou écris-nous à contact@washboard.fr.'
    case 'panne': return 'Le SMS n’a pas pu partir. Réessaie dans un instant.'
  }
}
