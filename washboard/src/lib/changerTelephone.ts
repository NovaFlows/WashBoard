import { estMobileFrancais, PHRASE_MOBILE_REQUIS } from '@/lib/codeSms'
import { normalizePhone, normaliserMobile } from '@/lib/phone'

// Changer de numéro depuis les réglages (2026-11-10), comme on change d'e-mail ou de mot de
// passe. Le numéro d'un compte est vérifié par SMS à l'inscription (`lib/codeSms`) : un nouveau
// numéro l'est aussi, sinon on rouvrirait la porte aux numéros inventés. Étapes : le laveur
// donne son mot de passe et le nouveau numéro → un code part sur CE numéro → il le saisit → le
// numéro est changé et daté (`washers.telephone_verifie_le`).

export type NouveauNumero = { erreur: string } | { telephone: string }

/** Ce qu'on accepte comme nouveau numéro : un mobile français (06/07), belge (04xx) ou suisse (+41 7x), différent de l'actuel. */
export function verifierNouveauNumero(saisie: unknown, actuel: string | null | undefined): NouveauNumero {
  const brut = typeof saisie === 'string' ? saisie : null
  const telephone = normaliserMobile(brut)
  if (!telephone) {
    return {
      erreur: normalizePhone(brut) || normalizePhone(brut, 'BE') || normalizePhone(brut, 'CH')
        ? PHRASE_MOBILE_REQUIS
        : 'Numéro invalide : 06 12 34 56 78, 0470 12 34 56 ou format international (+33…, +32…, +41…).',
    }
  }
  if (!estMobileFrancais(telephone)) return { erreur: PHRASE_MOBILE_REQUIS }
  if (telephone === normalizePhone(actuel)) return { erreur: 'C’est déjà votre numéro.' }
  return { telephone }
}

/** Un code de confirmation : six chiffres, rien d'autre. */
export function codeValide(saisie: unknown): saisie is string {
  return typeof saisie === 'string' && /^\d{6}$/.test(saisie.trim())
}
