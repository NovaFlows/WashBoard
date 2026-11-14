// Météo de l'accueil du tableau de bord (2026-11-14).
//
// Source : api.met.no (service météo norvégien), sans clé, utilisable commercialement à condition
// d'identifier l'application dans l'en-tête User-Agent et de citer la source. Open-Meteo, plus
// simple, est réservé à un usage non commercial dans sa formule gratuite : il ne convient pas à un
// logiciel payant.
//
// Ce fichier ne fait aucun appel réseau : il transforme la réponse de MET Norway (prévision
// « compact », heure par heure) en ce que l'écran affiche. Le tout est testé sans réseau.

export type Symbole = 'soleil' | 'nuit' | 'peu-nuageux' | 'peu-nuageux-nuit' | 'nuageux' | 'brouillard' | 'bruine' | 'pluie' | 'orage' | 'neige'

/** `symbol_code` de MET Norway (ex. `partlycloudy_night`, `lightrainshowers_day`) → famille affichée. */
export function symboleDe(code: string | null | undefined): Symbole {
  const c = (code ?? '').toLowerCase()
  const nuit = c.endsWith('_night')
  if (c.includes('thunder')) return 'orage'
  if (c.includes('snow') || c.includes('sleet')) return 'neige'
  if (c.includes('heavyrain') || c.startsWith('rain') || c.includes('rainshowers')) return c.startsWith('light') ? 'bruine' : 'pluie'
  if (c.startsWith('lightrain')) return 'bruine'
  if (c.includes('fog')) return 'brouillard'
  if (c.startsWith('clearsky') || c.startsWith('fair')) return nuit ? 'nuit' : 'soleil'
  if (c.startsWith('partlycloudy')) return nuit ? 'peu-nuageux-nuit' : 'peu-nuageux'
  if (c.startsWith('cloudy')) return 'nuageux'
  return 'nuageux'
}

/** Libellé français de chaque famille (clé de traduction : `t(LIBELLES[symbole])`). */
export const LIBELLES: Record<Symbole, string> = {
  soleil: 'Ensoleillé',
  nuit: 'Ciel dégagé',
  'peu-nuageux': 'Éclaircies',
  'peu-nuageux-nuit': 'Peu nuageux',
  nuageux: 'Nuageux',
  brouillard: 'Brouillard',
  bruine: 'Bruine',
  pluie: 'Pluie',
  orage: 'Orage',
  neige: 'Neige',
}

type Serie = {
  time: string
  data: {
    instant?: { details?: { air_temperature?: number } }
    next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } }
    next_6_hours?: { summary?: { symbol_code?: string } }
  }
}
export type ReponseMet = { properties?: { timeseries?: Serie[] } }

export type Meteo = {
  /** Température arrondie (°C) à l'heure en cours. */
  temperature: number
  symbole: Symbole
  /** Plus bas / plus haut des 24 prochaines heures (°C, arrondis). */
  min: number
  max: number
  /** Heure (0-23, heure locale du laveur) de la première pluie notable dans les 12 prochaines heures, entre 6 h et 22 h, sinon `null`. */
  pluieVers: number | null
}

const SEUIL_PLUIE_MM = 0.3

/**
 * @param heureLocale  fonction qui donne l'heure (0-23) d'un instant ISO dans le fuseau du laveur.
 *                     Injectée : ce fichier ne dépend ni du fuseau de la machine ni d'Intl.
 */
export function resumerPrevisions(reponse: ReponseMet | null | undefined, maintenant: number, heureLocale: (iso: string) => number): Meteo | null {
  const serie = reponse?.properties?.timeseries
  if (!Array.isArray(serie) || serie.length === 0) return null

  // Première prévision dont l'heure n'est pas passée de plus d'une heure.
  const debut = Math.max(0, serie.findIndex(s => Date.parse(s.time) + 3_600_000 > maintenant))
  const courante = serie[debut]
  const t0 = courante?.data?.instant?.details?.air_temperature
  if (typeof t0 !== 'number') return null

  const symbole = symboleDe(courante.data.next_1_hours?.summary?.symbol_code ?? courante.data.next_6_hours?.summary?.symbol_code)

  const fenetre = serie.slice(debut, debut + 24)
  const temperatures = fenetre
    .map(s => s.data?.instant?.details?.air_temperature)
    .filter((x): x is number => typeof x === 'number')

  let pluieVers: number | null = null
  for (const s of serie.slice(debut, debut + 12)) {
    const mm = s.data?.next_1_hours?.details?.precipitation_amount ?? 0
    if (mm < SEUIL_PLUIE_MM) continue
    // Une pluie de nuit n'intéresse pas un laveur : seules les heures de travail (6 h – 22 h) comptent.
    const h = heureLocale(s.time)
    if (h >= 6 && h < 22) { pluieVers = h; break }
  }

  return {
    temperature: Math.round(t0),
    symbole,
    min: Math.round(Math.min(...temperatures)),
    max: Math.round(Math.max(...temperatures)),
    pluieVers,
  }
}
