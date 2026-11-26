// Fuseau horaire d'un laveur, DÉDUIT de sa fiche — jamais choisi à la main.
//
// Jusqu'au 2026-11-26, tout WashBoard était à l'heure de Paris. Un laveur de
// Cayenne (UTC−3) voyait alors « aujourd'hui » basculer à 20 h ou 21 h chez
// lui, les créneaux du matin disparaître comme « déjà passés », et ses
// rappels partir quatre ou cinq heures trop tôt.
//
// Alexandre (2026-11-26) : « ça doit se faire tout seul ». Le fuseau se lit
// donc dans ce que le laveur a déjà renseigné, sans colonne ni réglage :
//   1. l'adresse de départ (`base_address`) — là où il travaille. Un code
//      postal d'outre-mer (973xx…) tranche ; un code postal de métropole
//      aussi, dans l'autre sens (Paris), même si son numéro est d'outre-mer ;
//   2. à défaut d'adresse lisible, le numéro de téléphone : 0694 (Guyane),
//      0696 (Martinique), 0692 (La Réunion)…, +1 (Québec) ;
//   3. sinon Paris, le comportement historique.
// L'heure du TÉLÉPHONE n'est volontairement pas utilisée : un laveur parisien
// en vacances aux Antilles verrait son agenda se décaler.
//
// La liste reste fermée : la France et ses outre-mer, le Québec, et Paris pour
// la Belgique, la Suisse et le Luxembourg (même heure). Rien d'autre ne peut
// sortir de `fuseauDuLaveur`.

import { FUSEAU } from './dateUtils'

export type FuseauPropose = { id: string; libelle: string }

/** Les fuseaux possibles et le nom du lieu, traduit par `useT` côté interface. */
export const FUSEAUX_PROPOSES: FuseauPropose[] = [
  { id: 'Europe/Paris', libelle: 'France métropolitaine, Belgique, Suisse' },
  { id: 'America/Cayenne', libelle: 'Guyane' },
  { id: 'America/Martinique', libelle: 'Martinique' },
  { id: 'America/Guadeloupe', libelle: 'Guadeloupe, Saint-Martin, Saint-Barthélemy' },
  { id: 'Indian/Reunion', libelle: 'La Réunion' },
  { id: 'Indian/Mayotte', libelle: 'Mayotte' },
  { id: 'America/Miquelon', libelle: 'Saint-Pierre-et-Miquelon' },
  { id: 'Pacific/Noumea', libelle: 'Nouvelle-Calédonie' },
  { id: 'Pacific/Tahiti', libelle: 'Polynésie française' },
  { id: 'Pacific/Wallis', libelle: 'Wallis-et-Futuna' },
  { id: 'America/Toronto', libelle: 'Québec' },
]

const CONNUS = new Set(FUSEAUX_PROPOSES.map(f => f.id))

export function estFuseauPropose(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && CONNUS.has(valeur)
}

/** Nom du lieu d'un fuseau (à passer à `t`). */
export function libelleFuseau(id: string): string {
  return FUSEAUX_PROPOSES.find(f => f.id === id)?.libelle ?? FUSEAUX_PROPOSES[0].libelle
}

// ── Adresse ──────────────────────────────────────────────────────────────────

/** Les trois premiers chiffres d'un code postal d'outre-mer → fuseau. */
const CODES_POSTAUX: Record<string, string> = {
  '971': 'America/Guadeloupe', // Guadeloupe, Saint-Barthélemy (97133), Saint-Martin (97150)
  '972': 'America/Martinique',
  '973': 'America/Cayenne',
  '974': 'Indian/Reunion',
  '975': 'America/Miquelon',
  '976': 'Indian/Mayotte',
  '986': 'Pacific/Wallis',
  '987': 'Pacific/Tahiti',
  '988': 'Pacific/Noumea',
}

/** Noms de territoire ou de grande ville, cherchés seulement dans la FIN de
 *  l'adresse (après la dernière virgule) : « rue de la Martinique, Paris »
 *  ne doit rien déclencher. Comparés sans accents ni majuscules. */
const NOMS: [RegExp, string][] = [
  [/\b(guyane|french guiana|cayenne|kourou|saint-laurent-du-maroni)\b/, 'America/Cayenne'],
  [/\b(martinique|fort-de-france)\b/, 'America/Martinique'],
  [/\b(guadeloupe|pointe-a-pitre|saint-barthelemy|st-barthelemy)\b/, 'America/Guadeloupe'],
  [/\b(la reunion|reunion island|saint-pierre de la reunion)\b|^\s*reunion\s*$/, 'Indian/Reunion'],
  [/\b(mayotte|mamoudzou)\b/, 'Indian/Mayotte'],
  [/\b(saint-pierre-et-miquelon|saint pierre and miquelon)\b/, 'America/Miquelon'],
  [/\b(nouvelle-caledonie|new caledonia|noumea)\b/, 'Pacific/Noumea'],
  [/\b(polynesie|french polynesia|tahiti|papeete)\b/, 'Pacific/Tahiti'],
  [/\b(wallis)\b/, 'Pacific/Wallis'],
  [/\b(quebec|canada|montreal)\b/, 'America/Toronto'],
]

function sansAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Fuseau lu dans l'adresse, `'Europe/Paris'` si elle est clairement en
 *  métropole, `null` si elle ne dit rien. */
export function fuseauDeLAdresse(adresse: string | null | undefined): string | null {
  const a = sansAccents(String(adresse ?? '')).trim()
  if (!a) return null

  // Code postal : le dernier nombre de 5 chiffres isolé (le numéro de rue
  // vient avant et dépasse rarement 4 chiffres).
  const codes = a.match(/(?<!\d)\d{5}(?!\d)/g)
  const code = codes?.[codes.length - 1]
  if (code) {
    const outreMer = CODES_POSTAUX[code.slice(0, 3)]
    if (outreMer) return outreMer
    const n = Number(code)
    if (n >= 1000 && n <= 95999) return FUSEAU // métropole et Corse (2A/2B s'écrivent 20xxx)
  }
  // Code postal canadien (H2X 1Y4) : Québec.
  if (/\b[a-z]\d[a-z]\s?\d[a-z]\d\b/.test(a) && /\b(qc|quebec|canada)\b/.test(a)) return 'America/Toronto'

  // Sans virgule, l'adresse n'est lue comme un lieu que si c'est un nom seul
  // (« Cayenne ») : « 12 rue du Québec » ne dit rien du fuseau.
  const segments = a.split(',')
  const fin = segments[segments.length - 1]
  if (segments.length === 1 && (/\d/.test(a) || /\b(rue|avenue|av|boulevard|bd|chemin|allee|impasse|place|route|quai|cours)\b/.test(a))) return null
  for (const [motif, fuseau] of NOMS) if (motif.test(fin)) return fuseau
  if (/\bfrance\b/.test(fin)) return FUSEAU
  return null
}

// ── Téléphone ────────────────────────────────────────────────────────────────

/** Préfixes des numéros d'outre-mer, sous la forme stockée (10 chiffres
 *  commençant par 0, voir `lib/phone.ts`). */
const PREFIXES: [RegExp, string][] = [
  [/^0(594|694)/, 'America/Cayenne'],
  [/^0(596|696|697)/, 'America/Martinique'],
  [/^0(590|690|691)/, 'America/Guadeloupe'],
  [/^0(262|263|692|693)/, 'Indian/Reunion'],
  [/^0(269|639)/, 'Indian/Mayotte'],
]

/** Fuseau lu dans le numéro, `null` pour un numéro de métropole, belge,
 *  suisse… (rien à en déduire : l'heure de Paris s'appliquera). */
export function fuseauDuTelephone(telephone: string | null | undefined): string | null {
  let n = String(telephone ?? '').replace(/[\s.\-()]/g, '')
  if (!n) return null
  // Numéro d'outre-mer écrit à l'international : +594 694… → 0694…
  const intl = /^(?:\+|00)(594|596|590|262|269)(\d{9})$/.exec(n)
  if (intl) n = '0' + intl[2]
  else if (n.startsWith('+33')) n = '0' + n.slice(3)
  if (/^(?:\+|00)508/.test(n)) return 'America/Miquelon'
  if (/^(?:\+|00)687/.test(n)) return 'Pacific/Noumea'
  if (/^(?:\+|00)689/.test(n)) return 'Pacific/Tahiti'
  if (/^(?:\+|00)681/.test(n)) return 'Pacific/Wallis'
  if (/^(?:\+|00)1\d{10}$/.test(n)) return 'America/Toronto' // seuls les numéros québécois sont acceptés à l'inscription
  for (const [motif, fuseau] of PREFIXES) if (motif.test(n)) return fuseau
  return null
}

// ── Les deux ensemble ───────────────────────────────────────────────────────

export type SourceFuseau = { base_address?: string | null; phone?: string | null }

/** Le fuseau d'un laveur, tel qu'il faut le passer aux fonctions de
 *  `dateUtils` : adresse d'abord, téléphone ensuite, Paris sinon. */
export function fuseauDuLaveur(source: SourceFuseau | null | undefined): string {
  if (!source) return FUSEAU
  return fuseauDeLAdresse(source.base_address) ?? fuseauDuTelephone(source.phone) ?? FUSEAU
}
