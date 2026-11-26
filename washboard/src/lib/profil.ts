// « Mon profil » (PWA) : ce qu'affichent les lignes de l'écran, et ce qu'on vérifie avant
// d'enregistrer. Fonctions pures, sans DOM ni réseau — l'écran et ses feuilles ne font que
// de la présentation (voir `ProfilV2.tsx`).
//
// Les règles sont celles de l'ancien écran (`ParametresFormV1`, `FacturationCard`) : même
// format de téléphone, même minimum de mot de passe, mêmes informations de facturation
// obligatoires. Le serveur revalide tout (`PATCH /api/washer`, Supabase Auth) : ces contrôles
// ne servent qu'à répondre tout de suite, sans aller-retour.

import { isValidPhone, formatPhone } from '@/lib/phone'
import { sansTraduction, type Traducteur } from '@/lib/i18n/traduire'
import { infosFacturationManquantes, siretValide, numeroTvaValide, identifiantValidePour, reglesPays, type InfosFacturation, type PaysFacturation } from '@/lib/facture'

/** Ce qu'une ligne de l'écran affiche sous son intitulé. `ton` : ambre quand c'est à faire. */
export type Resume = { texte: string; ton?: 'ambre' }

const A_RENSEIGNER = (t: Traducteur): Resume => ({ texte: t('À renseigner'), ton: 'ambre' })

export function resumeNomEntreprise(nom: string | null | undefined, t: Traducteur = sansTraduction): Resume {
  const n = nom?.trim()
  return n ? { texte: n } : A_RENSEIGNER(t)
}

export function resumeTelephone(telephone: string | null | undefined, tr: Traducteur = sansTraduction): Resume {
  const t = telephone?.trim()
  if (!t) return A_RENSEIGNER(tr)
  // Un numéro déjà en base peut être dans un format que `formatPhone` ne sait pas espacer :
  // on l'affiche alors tel quel plutôt que de le masquer.
  return { texte: formatPhone(t) || t }
}

export function resumeAdresseDepart(adresse: string | null | undefined, t: Traducteur = sansTraduction): Resume {
  const a = adresse?.trim()
  return a ? { texte: a } : { texte: t('À renseigner : sert au calcul des frais de déplacement'), ton: 'ambre' }
}

export function resumeEmail(email: string | null | undefined, t: Traducteur = sansTraduction): Resume {
  const e = email?.trim()
  return e ? { texte: e } : A_RENSEIGNER(t)
}

/** Facturation : complète, ou le nombre d'informations qui manquent (le détail est dans la
 *  feuille, ligne par ligne — l'écran n'a pas la place de les énumérer). */
export function resumeFacturation(infos: InfosFacturation, t: Traducteur = sansTraduction): Resume {
  const manques = infosFacturationManquantes(infos)
  if (manques.length === 0) return { texte: t('Complètes') }
  return {
    texte: manques.length === 1 ? t('1 information manquante') : t('{n} informations manquantes', { n: manques.length }),
    ton: 'ambre',
  }
}

export function resumeEquipe(teamSize: number | null | undefined, peutEquipe: boolean, t: Traducteur = sansTraduction): Resume {
  if (!peutEquipe) return { texte: 'Pro' }
  const n = Math.max(1, Math.floor(Number(teamSize) || 1))
  return { texte: n > 1 ? t('{n} laveurs', { n }) : t('1 laveur') }
}

// ── Vérifications de saisie ────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const MOT_DE_PASSE_MIN = 6

/** `null` si la saisie passe, sinon la phrase à afficher. */
export function validerNomEntreprise(saisie: string, t: Traducteur = sansTraduction): string | null {
  return saisie.trim() ? null : t('Le nom de votre entreprise ne peut pas être vide.')
}

/** Vide est accepté : un laveur a le droit de retirer son numéro. */
export function validerTelephone(saisie: string, tr: Traducteur = sansTraduction): string | null {
  const t = saisie.trim()
  if (!t) return null
  return isValidPhone(t) ? null : tr('Numéro invalide : 10 chiffres (06…) ou format international (+33…).')
}

export function validerEmail(saisie: string, t: Traducteur = sansTraduction): string | null {
  return EMAIL_RE.test(saisie.trim()) ? null : t('Adresse e-mail invalide.')
}

export function validerMotDePasse(nouveau: string, confirmation: string, t: Traducteur = sansTraduction): string | null {
  if (nouveau.length < MOT_DE_PASSE_MIN) return t('Le mot de passe doit faire au moins {min} caractères.', { min: MOT_DE_PASSE_MIN })
  if (nouveau !== confirmation) return t('Les deux mots de passe ne sont pas identiques.')
  return null
}

/** Facturation : ce qu'on refuse AVANT d'envoyer (le reste — champs vides — est autorisé,
 *  la facture reste simplement impossible à émettre tant qu'il manque quelque chose). */
export function validerFacturation(champs: { siret: string; regime: 'franchise' | 'assujetti'; numeroTva: string; prochainNumero: string; numeroActuel: number; pays?: PaysFacturation }, t: Traducteur = sansTraduction): string | null {
  // Pays connu (téléphone confirmé) : l'identifiant doit avoir le format de CE pays, avec sa phrase.
  if (champs.pays && champs.siret.trim() && !identifiantValidePour(champs.pays, champs.siret)) return t(reglesPays(champs.pays).identifiantErreur)
  if (champs.siret.trim() && !siretValide(champs.siret)) return t('Numéro d’entreprise invalide : SIRET (14 chiffres), numéro BCE belge (10 chiffres) ou numéro IDE suisse (CHE-123.456.789).')
  if (champs.regime === 'assujetti' && champs.numeroTva.trim() && !numeroTvaValide(champs.numeroTva)) {
    return t('Numéro de TVA invalide : FR suivi de 11 caractères, BE suivi du numéro BCE, ou CHE-123.456.789 TVA en Suisse.')
  }
  const suivant = Number(champs.prochainNumero)
  if (!Number.isInteger(suivant) || suivant < 1) return t('Le prochain numéro de facture doit être un nombre entier.')
  if (suivant < champs.numeroActuel) {
    return t('Le prochain numéro ne peut pas revenir en arrière : il est déjà à {n}.', { n: champs.numeroActuel })
  }
  return null
}

// ── Frais de déplacement, expéditeur SMS, compte ───────────────────────────
// Les trois réglages qui n'existaient que sur l'ancien écran (`ParametresFormV1`) : mêmes
// règles, mêmes bornes que lui et que la route (`PATCH /api/washer`, `POST /api/account`).

/** Un palier porte son unité dans sa clé : `max_minutes` (durée de trajet) ou `max_km` (distance).
 *  Tous les paliers d'un laveur ont la même unité (contrôlé par `PATCH /api/washer`). Demande de
 *  My Clean, 2026-11-06 : facturer au kilomètre, pas seulement à la durée. */
export type PalierDeplacement = { max_minutes?: number; max_km?: number; fee: number }
export type UniteDeplacement = 'minutes' | 'km'
export type ModeDeplacement = 'base' | 'previous'

export const UNITES_DEPLACEMENT: { valeur: UniteDeplacement; libelle: string; abrege: string }[] = [
  { valeur: 'minutes', libelle: 'La durée du trajet', abrege: 'min' },
  { valeur: 'km', libelle: 'La distance', abrege: 'km' },
]

/** Unité des paliers ; « minutes » sans palier, comme avant l'ajout des kilomètres. */
export function unitePaliers(tiers: PalierDeplacement[] | null | undefined): UniteDeplacement {
  return tiers?.some(t => t.max_km != null) ? 'km' : 'minutes'
}

export function seuilPalier(t: PalierDeplacement): number {
  return t.max_km ?? t.max_minutes ?? 0
}

export function libellePalier(p: PalierDeplacement, t: Traducteur = sansTraduction): string {
  return t('Jusqu’à {seuil} {unite}', { seuil: seuilPalier(p), unite: p.max_km != null ? 'km' : 'min' })
}

export const MODES_DEPLACEMENT: { valeur: ModeDeplacement; libelle: string; detail: string }[] = [
  { valeur: 'base', libelle: 'Mon siège (adresse de départ)', detail: 'Toujours calculé depuis votre adresse fixe.' },
  { valeur: 'previous', libelle: 'Le RDV précédent de la journée', detail: 'Calculé depuis le dernier client : plus précis pour les tournées.' },
]

const euro = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`

export function resumeFraisDeplacement(tiers: PalierDeplacement[] | null | undefined, t: Traducteur = sansTraduction): Resume {
  const n = tiers?.length ?? 0
  if (n === 0) return { texte: t('Aucun : le déplacement est offert') }
  const plus = tiers!.reduce((m, p) => Math.max(m, p.fee), 0)
  const km = unitePaliers(tiers) === 'km'
  return { texte: km
    ? t('{n} palier{v1} au km, jusqu’à {max}', { n, v1: n > 1 ? 's' : '', max: euro(plus) })
    : t('{n} palier{v1}, jusqu’à {max}', { n, v1: n > 1 ? 's' : '', max: euro(plus) }) }
}

/** Ajoute un palier (seuil en minutes ou en km → frais), trié et sans doublon de seuil : un
 *  palier saisi deux fois avec le même seuil remplace l'ancien. `erreur` non nul = rien n'est
 *  ajouté. */
export function ajouterPalier(
  tiers: PalierDeplacement[], seuil: string, frais: string, unite: UniteDeplacement = 'minutes',
): { tiers: PalierDeplacement[]; erreur: string | null } {
  const s = Number(seuil.replace(',', '.'))
  const f = Number(frais.replace(',', '.'))
  if (!seuil.trim() || !Number.isFinite(s) || s <= 0) {
    return { tiers, erreur: unite === 'km' ? 'Indiquez une distance en km (1 ou plus).' : 'Indiquez une durée de trajet en minutes (1 ou plus).' }
  }
  if (!frais.trim() || !Number.isFinite(f) || f < 0) return { tiers, erreur: 'Indiquez des frais en euros (0 ou plus).' }
  const entier = Math.max(1, Math.round(s))
  const fee = Math.round(f * 100) / 100
  const nouveau: PalierDeplacement = unite === 'km' ? { max_km: entier, fee } : { max_minutes: entier, fee }
  const suite = [...tiers.filter(t => seuilPalier(t) !== entier), nouveau]
  return { tiers: suite.sort((a, b) => seuilPalier(a) - seuilPalier(b)), erreur: null }
}

/** Nettoie un nom d'expéditeur SMS : lettres et chiffres sans accent, 11 caractères au plus. */
export function nettoyerExpediteur(saisie: string): string {
  return saisie.replace(/[^A-Za-z0-9]/g, '').slice(0, 11)
}

/** Jours restants avant la purge d'un compte dont la suppression est programmée (30 j). */
export function joursAvantPurge(programmeeLe: string | null | undefined, maintenant: number): number {
  if (!programmeeLe) return 30
  const ecoule = Math.floor((maintenant - new Date(programmeeLe).getTime()) / 86_400_000)
  return Math.max(0, 30 - ecoule)
}

export function nomConfirme(saisie: string, nom: string | null | undefined): boolean {
  return saisie.trim().toLowerCase() === (nom ?? '').trim().toLowerCase() && !!saisie.trim()
}
