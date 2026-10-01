// Période de l'écran « Chiffres » (refonte 2026) : quelle plage de jours, quels
// créneaux (heures, jours, mois) pour un graphique, et quelles bornes en
// instants pour filtrer des réservations ou des visites.
//
// Tout se calcule en JOURS DE PARIS, sur des chaînes `AAAA-MM-JJ`, avec de
// l'arithmétique UTC : le résultat ne dépend ni du fuseau de la machine ni du
// changement d'heure. Une réservation à 00 h 30 le 1er tombe le 1er, pas la
// veille, que le laveur ouvre l'app depuis Paris ou depuis un téléphone resté
// sur un autre fuseau (`dateUtils.FUSEAU`).
//
// Pourquoi ne pas réutiliser `comptaPeriod.ts` / `crmPeriod.ts` : ils lisent
// la date LOCALE de la machine (`getDate`, `setHours`), et `navigatePeriod`
// déborde sur les mois courts (`setMonth` depuis un 31 : le 31 octobre
// « précédent » retombe le 1er octobre, pas en septembre). Ils servent
// toujours la Comptabilité et l'ancien CRM, qu'on ne touche pas ; leur
// définition d'une plage (lundi → dimanche, mois civil, année civile) est
// reprise à l'identique ici, et un test le vérifie.

import { FUSEAU, minuitParisUTC } from './dateUtils'
import type { PeriodType } from './comptaPeriod'

export type { PeriodType }

/** `ref` : un jour quelconque de la période, `AAAA-MM-JJ`, à l'heure de Paris. */
export type PeriodeChiffres = { type: PeriodType; ref: string }

export type PlageJours = {
  /** Premier jour, inclus. */
  debut: string
  /** Dernier jour, inclus. */
  fin: string
  /** Libellé complet : « Septembre 2026 », « 21 – 27 sept. 2026 »… */
  label: string
}

// ── Découpage d'un instant en jour/heure de Paris ───────────────────────────

const formatParis = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  hourCycle: 'h23',
})

/** Jour (`AAAA-MM-JJ`) et heure (0–23) d'un instant, à l'heure de Paris.
 *  `null` pour une date illisible : l'appelant ignore la ligne plutôt que de
 *  la ranger au hasard. */
export function partiesParis(instant: string | number | Date): { jour: string; heure: number } | null {
  const t = new Date(instant)
  if (!Number.isFinite(t.getTime())) return null
  let a = '', m = '', j = '', h = ''
  for (const p of formatParis.formatToParts(t)) {
    if (p.type === 'year') a = p.value
    else if (p.type === 'month') m = p.value
    else if (p.type === 'day') j = p.value
    else if (p.type === 'hour') h = p.value
  }
  return { jour: `${a}-${m}-${j}`, heure: Number(h) % 24 }
}

export const jourParisDe = (instant: string | number | Date): string | null => partiesParis(instant)?.jour ?? null

// ── Arithmétique de jours (UTC, sans fuseau) ────────────────────────────────

const decouper = (s: string): [number, number, number] => {
  const [a, m, j] = s.split('-').map(Number)
  return [a, m, j]
}
const versMs = (s: string): number => { const [a, m, j] = decouper(s); return Date.UTC(a, m - 1, j) }
const enChaine = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

export const ajouterJours = (s: string, n: number): string => enChaine(versMs(s) + n * 86_400_000)

/** 0 = lundi … 6 = dimanche. */
const rangSemaine = (s: string): number => (new Date(versMs(s)).getUTCDay() + 6) % 7

const dernierJourDuMois = (annee: number, mois: number): number => new Date(Date.UTC(annee, mois, 0)).getUTCDate()

const pad = (n: number) => String(n).padStart(2, '0')

const MOIS_LONGS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]
const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/** Formate un jour `AAAA-MM-JJ` sans passer par le fuseau de la machine : la
 *  date est construite à minuit UTC et lue en UTC. */
function formatJour(s: string, opts: Intl.DateTimeFormatOptions): string {
  const texte = new Date(versMs(s)).toLocaleDateString('fr-FR', { ...opts, timeZone: 'UTC' })
  // « le 1er septembre », pas « le 1 septembre » : Intl n'écrit l'ordinal qu'à
  // moitié selon les moteurs.
  return texte.replace(/(^|\s)1(?=\s\p{L})/u, (_, avant: string) => `${avant}1er`)
}

/** Aujourd'hui à Paris. */
export const aujourdhuiParis = (maintenant: number | Date = Date.now()): string => jourParisDe(maintenant) ?? enChaine(Date.now())

// ── Plage d'une période ─────────────────────────────────────────────────────

export function plageDe(p: PeriodeChiffres): PlageJours {
  const [a, m] = decouper(p.ref)

  if (p.type === 'jour') {
    return { debut: p.ref, fin: p.ref, label: formatJour(p.ref, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  }

  if (p.type === 'semaine') {
    const debut = ajouterJours(p.ref, -rangSemaine(p.ref))
    const fin = ajouterJours(debut, 6)
    const [ad] = decouper(debut)
    const [af] = decouper(fin)
    const court: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
    const avecAnnee: Intl.DateTimeFormatOptions = { ...court, year: 'numeric' }
    // « 28 sept. – 4 oct. 2026 », mais « 29 déc. 2025 – 4 janv. 2026 » : sans
    // l'année du début, une semaine à cheval sur deux années se lirait mal.
    const label = `${formatJour(debut, ad === af ? court : avecAnnee)} – ${formatJour(fin, avecAnnee)}`
    return { debut, fin, label }
  }

  if (p.type === 'mois') {
    return {
      debut: `${a}-${pad(m)}-01`,
      fin: `${a}-${pad(m)}-${pad(dernierJourDuMois(a, m))}`,
      label: `${MOIS_LONGS[m - 1]} ${a}`,
    }
  }

  return { debut: `${a}-01-01`, fin: `${a}-12-31`, label: String(a) }
}

/** Période précédente (`-1`) ou suivante (`+1`), de même nature.
 *
 *  `ref` garde son quantième quand c'est possible (le 24 septembre → le 24
 *  août) et se cale sur le dernier jour d'un mois plus court (le 31 octobre →
 *  le 30 septembre) : c'est ce qui évite le débordement de `Date#setMonth`.
 *  Jamais après `aujourdhui` : « suivant » depuis la semaine dernière ne doit
 *  pas laisser un `ref` dans le futur, qu'un changement de type de période
 *  transformerait en jour à venir. */
export function deplacer(p: PeriodeChiffres, dir: 1 | -1, aujourdhui: string): PeriodeChiffres {
  let ref: string
  const [a, m, j] = decouper(p.ref)

  switch (p.type) {
    case 'jour': ref = ajouterJours(p.ref, dir); break
    case 'semaine': ref = ajouterJours(p.ref, dir * 7); break
    case 'mois': {
      const d = new Date(Date.UTC(a, m - 1 + dir, 1))
      const an = d.getUTCFullYear()
      const mo = d.getUTCMonth() + 1
      ref = `${an}-${pad(mo)}-${pad(Math.min(j, dernierJourDuMois(an, mo)))}`
      break
    }
    case 'annee': {
      const an = a + dir
      ref = `${an}-${pad(m)}-${pad(Math.min(j, dernierJourDuMois(an, m)))}`
      break
    }
  }
  return { type: p.type, ref: ref > aujourdhui ? aujourdhui : ref }
}

/** La période contient-elle aujourd'hui ? Alors « suivant » est désactivé :
 *  il n'y a rien à lire dans le futur. */
export function contientAujourdhui(p: PeriodeChiffres, aujourdhui: string): boolean {
  const { debut, fin } = plageDe(p)
  return aujourdhui >= debut && aujourdhui <= fin
}

/** Bornes en instants : `debut` inclus, `fin` exclu. Minuit de Paris, donc une
 *  journée de 23 h (passage à l'heure d'été) ou de 25 h (retour à l'heure
 *  d'hiver) est bornée juste. */
export function bornesInstants(p: PeriodeChiffres): { debut: Date; fin: Date } {
  const { debut, fin } = plageDe(p)
  return { debut: minuitParisUTC(debut), fin: minuitParisUTC(ajouterJours(fin, 1)) }
}

export function estAvant(instant: string | number | Date, p: PeriodeChiffres): boolean {
  return new Date(instant).getTime() < bornesInstants(p).debut.getTime()
}

const COMPARAISON: Record<PeriodType, string> = {
  jour: 'par rapport à la veille',
  semaine: 'par rapport à la semaine précédente',
  mois: 'par rapport au mois précédent',
  annee: "par rapport à l'année précédente",
}
/** « par rapport à la semaine précédente » — même texte sur les trois onglets. */
export const libelleComparaison = (type: PeriodType): string => COMPARAISON[type]

// ── Créneaux d'un graphique ─────────────────────────────────────────────────

export type Creneau = {
  /** Clé de rangement : `HH` (jour), `AAAA-MM-JJ` (semaine, mois), `AAAA-MM` (année). */
  cle: string
  /** Libellé court sous la barre. */
  label: string
  /** Faut-il l'écrire ? Sur 31 barres fines, un libellé sur cinq suffit. */
  afficherLabel: boolean
  /** Libellé complet, lu quand on touche la barre. */
  libelleLong: string
}

/** Un créneau par heure (0–23), par jour, ou par mois selon la période.
 *
 *  Jour : les heures sont celles de la pendule de Paris. Un jour de 25 h (le
 *  25 octobre 2026) a deux fois « 2 h » — les deux se rangent dans la même
 *  barre ; un jour de 23 h (le 29 mars) n'a pas de « 2 h », sa barre reste à
 *  zéro. Aucune réservation ne se perd ni ne se compte deux fois. */
export function creneauxDe(p: PeriodeChiffres): Creneau[] {
  const { debut, fin } = plageDe(p)

  if (p.type === 'jour') {
    return Array.from({ length: 24 }, (_, h) => ({
      cle: pad(h),
      label: `${h}h`,
      afficherLabel: h % 3 === 0,
      libelleLong: `${formatJour(p.ref, { weekday: 'long', day: 'numeric', month: 'long' })}, de ${h}h à ${h + 1}h`,
    }))
  }

  if (p.type === 'annee') {
    const [a] = decouper(p.ref)
    return MOIS_COURTS.map((label, i) => ({
      cle: `${a}-${pad(i + 1)}`,
      label,
      afficherLabel: true,
      libelleLong: `${MOIS_LONGS[i]} ${a}`,
    }))
  }

  const nb = Math.round((versMs(fin) - versMs(debut)) / 86_400_000) + 1
  return Array.from({ length: nb }, (_, i) => {
    const jour = ajouterJours(debut, i)
    const [, , j] = decouper(jour)
    return {
      cle: jour,
      label: p.type === 'semaine' ? JOURS_COURTS[rangSemaine(jour)] : String(j),
      afficherLabel: p.type === 'semaine' || j === 1 || j % 5 === 0,
      libelleLong: formatJour(jour, { weekday: 'long', day: 'numeric', month: 'long' }),
    }
  })
}

/** Créneau d'un instant, à l'heure de Paris : sa clé (voir `Creneau.cle`) et
 *  son jour. `null` si l'instant est illisible. Le jour permet à l'appelant de
 *  vérifier que l'instant est bien DANS la période : une clé d'heure (« 09 »)
 *  existe tous les jours, elle ne le dit pas. */
export function creneauDe(p: PeriodeChiffres, instant: string | number | Date): { cle: string; jour: string } | null {
  const parties = partiesParis(instant)
  if (!parties) return null
  const { jour, heure } = parties
  if (p.type === 'jour') return { cle: pad(heure), jour }
  if (p.type === 'annee') return { cle: jour.slice(0, 7), jour }
  return { cle: jour, jour }
}

/** Clé du créneau d'un jour `AAAA-MM-JJ` (une dépense n'a pas d'heure). */
export function cleCreneauDuJour(p: PeriodeChiffres, jour: string): string | null {
  if (p.type === 'jour') return null
  return p.type === 'annee' ? jour.slice(0, 7) : jour
}

/** Vue « jour » : 24 barres dont la plupart, la nuit, sont vides. On montre
 *  6 h–21 h, élargi aux heures qui ont de la donnée — le graphique reste
 *  stable d'un jour à l'autre sans jamais cacher une réservation. */
export function rognerHeures<T extends { cle: string }>(
  creneaux: T[],
  aDeLaDonnee: (c: T) => boolean,
  premiere = 6,
  derniere = 21,
): T[] {
  const avecDonnee = creneaux.filter(aDeLaDonnee).map(c => Number(c.cle))
  const de = Math.min(premiere, ...avecDonnee)
  const a = Math.max(derniere, ...avecDonnee)
  return creneaux.filter(c => Number(c.cle) >= de && Number(c.cle) <= a)
}

/** « 24 septembre 2026 » — un jour `AAAA-MM-JJ`, sans dépendre du fuseau. */
export const formaterJour = (jour: string): string =>
  formatJour(jour, { day: 'numeric', month: 'long', year: 'numeric' })
