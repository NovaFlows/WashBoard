// « Mon profil » (PWA) : ce qu'affichent les lignes de l'écran, et ce qu'on vérifie avant
// d'enregistrer. Fonctions pures, sans DOM ni réseau — l'écran et ses feuilles ne font que
// de la présentation (voir `ProfilV2.tsx`).
//
// Les règles sont celles de l'ancien écran (`ParametresFormV1`, `FacturationCard`) : même
// format de téléphone, même minimum de mot de passe, mêmes informations de facturation
// obligatoires. Le serveur revalide tout (`PATCH /api/washer`, Supabase Auth) : ces contrôles
// ne servent qu'à répondre tout de suite, sans aller-retour.

import { isValidPhone, formatPhone } from '@/lib/phone'
import { infosFacturationManquantes, siretValide, numeroTvaValide, type InfosFacturation } from '@/lib/facture'

/** Ce qu'une ligne de l'écran affiche sous son intitulé. `ton` : ambre quand c'est à faire. */
export type Resume = { texte: string; ton?: 'ambre' }

const A_RENSEIGNER: Resume = { texte: 'À renseigner', ton: 'ambre' }

export function resumeNomEntreprise(nom: string | null | undefined): Resume {
  const n = nom?.trim()
  return n ? { texte: n } : A_RENSEIGNER
}

export function resumeTelephone(telephone: string | null | undefined): Resume {
  const t = telephone?.trim()
  if (!t) return A_RENSEIGNER
  // Un numéro déjà en base peut être dans un format que `formatPhone` ne sait pas espacer :
  // on l'affiche alors tel quel plutôt que de le masquer.
  return { texte: formatPhone(t) || t }
}

export function resumeAdresseDepart(adresse: string | null | undefined): Resume {
  const a = adresse?.trim()
  return a ? { texte: a } : { texte: 'À renseigner : sert au calcul des frais de déplacement', ton: 'ambre' }
}

export function resumeEmail(email: string | null | undefined): Resume {
  const e = email?.trim()
  return e ? { texte: e } : A_RENSEIGNER
}

/** Facturation : complète, ou le nombre d'informations qui manquent (le détail est dans la
 *  feuille, ligne par ligne — l'écran n'a pas la place de les énumérer). */
export function resumeFacturation(infos: InfosFacturation): Resume {
  const manques = infosFacturationManquantes(infos)
  if (manques.length === 0) return { texte: 'Complètes' }
  return {
    texte: manques.length === 1 ? '1 information manquante' : `${manques.length} informations manquantes`,
    ton: 'ambre',
  }
}

export function resumeEquipe(teamSize: number | null | undefined, peutEquipe: boolean): Resume {
  if (!peutEquipe) return { texte: 'Pro' }
  const n = Math.max(1, Math.floor(Number(teamSize) || 1))
  return { texte: n > 1 ? `${n} laveurs` : '1 laveur' }
}

// ── Vérifications de saisie ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MOT_DE_PASSE_MIN = 6

/** `null` si la saisie passe, sinon la phrase à afficher. */
export function validerNomEntreprise(saisie: string): string | null {
  return saisie.trim() ? null : 'Le nom de votre entreprise ne peut pas être vide.'
}

/** Vide est accepté : un laveur a le droit de retirer son numéro. */
export function validerTelephone(saisie: string): string | null {
  const t = saisie.trim()
  if (!t) return null
  return isValidPhone(t) ? null : 'Numéro invalide : 10 chiffres (06…) ou format international (+33…).'
}

export function validerEmail(saisie: string): string | null {
  return EMAIL_RE.test(saisie.trim()) ? null : 'Adresse e-mail invalide.'
}

export function validerMotDePasse(nouveau: string, confirmation: string): string | null {
  if (nouveau.length < MOT_DE_PASSE_MIN) return `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`
  if (nouveau !== confirmation) return 'Les deux mots de passe ne sont pas identiques.'
  return null
}

/** Facturation : ce qu'on refuse AVANT d'envoyer (le reste — champs vides — est autorisé,
 *  la facture reste simplement impossible à émettre tant qu'il manque quelque chose). */
export function validerFacturation(champs: { siret: string; regime: 'franchise' | 'assujetti'; numeroTva: string; prochainNumero: string; numeroActuel: number }): string | null {
  if (champs.siret.trim() && !siretValide(champs.siret)) return 'SIRET invalide : vérifiez les 14 chiffres.'
  if (champs.regime === 'assujetti' && champs.numeroTva.trim() && !numeroTvaValide(champs.numeroTva)) {
    return 'Numéro de TVA invalide : FR suivi de 11 caractères.'
  }
  const suivant = Number(champs.prochainNumero)
  if (!Number.isInteger(suivant) || suivant < 1) return 'Le prochain numéro de facture doit être un nombre entier.'
  if (suivant < champs.numeroActuel) {
    return `Le prochain numéro ne peut pas revenir en arrière : il est déjà à ${champs.numeroActuel}.`
  }
  return null
}
