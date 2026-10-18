// Apparence de la carte de fidélité (maquette validée par Alexandre le 2026-10-18 : « on garde
// tout comme ça ») : la couleur et la finition choisies par le laveur, son logo ou son
// initiale. Tout le reste de la carte (reflets, tranche, encre des tampons, texte clair ou
// foncé) se DÉDUIT de la seule couleur, ici, pour que la page carte, l'écran de confirmation,
// l'aperçu des réglages et l'email ne puissent pas diverger.

export const FINITIONS_CARTE = ['holo', 'brillante', 'mate'] as const
export type FinitionCarte = (typeof FINITIONS_CARTE)[number]
export const LIBELLES_FINITION: Record<FinitionCarte, string> = { holo: 'Holographique', brillante: 'Brillante', mate: 'Mate' }

/** Ce qu'il faut pour dessiner la carte (`CarteFidelite3D`), calculé au même endroit
 *  (`apparenceCarte`, lib/fideliteServeur.ts) pour la page carte, l'écran de confirmation et
 *  l'email. */
export type ApparenceCarte = { couleur: string; finition: FinitionCarte; nom: string; logo: string | null; numero: string | null; recompense: string }

export const EMBLEMES_CARTE = ['logo', 'initiale'] as const
export type EmblemeCarte = (typeof EMBLEMES_CARTE)[number]

/** Le violet de la maquette : la carte d'un laveur qui n'a choisi aucune couleur, ni de marque. */
export const COULEUR_CARTE_DEFAUT = '#6D28D9'

export const NUANCES_CARTE: readonly { nom: string; hex: string }[] = [
  { nom: 'Bleu', hex: '#306090' },
  { nom: 'Nuit', hex: '#1F1F2A' },
  { nom: 'Violet', hex: '#6D28D9' },
  { nom: 'Framboise', hex: '#C2185B' },
  { nom: 'Émeraude', hex: '#0F7A55' },
  { nom: 'Corail', hex: '#E0533D' },
  { nom: 'Or', hex: '#B8860B' },
]

export function couleurValide(c: unknown): c is string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)
}

/** La couleur de la carte : celle choisie dans les réglages, sinon la couleur de marque du
 *  laveur (Apparence de ma page), sinon le violet par défaut. */
export function couleurCarte(choisie: unknown, marque?: string | null): string {
  if (couleurValide(choisie)) return choisie.toUpperCase()
  if (couleurValide(marque)) return marque.toUpperCase()
  return COULEUR_CARTE_DEFAUT
}

type Hsl = [h: number, s: number, l: number]

function hexVersHsl(hex: string): Hsl {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}

const borne = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function hslVersHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360
  const ss = borne(s, 0, 100) / 100
  const ll = borne(l, 0, 100) / 100
  const k = (n: number) => (n + hh / 30) % 12
  const a = ss * Math.min(ll, 1 - ll)
  const f = (n: number) => ll - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

/** Luminance relative (WCAG) : au-dessus de 0,45 la carte est claire, son texte passe en foncé. */
function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}

export type TeintesCarte = {
  base: string
  clair: string
  sombre: string
  /** Lueur en haut à droite, décalée vers la teinte voisine. */
  lueur: string
  /** Couleur de la tranche (l'épaisseur vue de profil). */
  tranche: string
  /** Halo autour de la carte, transparent. */
  halo: string
  /** Encre des tampons sur le panneau papier du verso : assez foncée pour se lire. */
  encre: string
  texte: string
  texteDoux: string
}

export function teintesCarte(hex: string): TeintesCarte {
  const couleur = couleurValide(hex) ? hex : COULEUR_CARTE_DEFAUT
  const [h, s, l] = hexVersHsl(couleur)
  const claire = luminance(couleur) > 0.45
  const halo = hslVersHex(h, s, l)
  return {
    base: hslVersHex(h, s, l),
    clair: hslVersHex(h, s, l + 15),
    sombre: hslVersHex(h, s * 0.92, l - 19),
    lueur: hslVersHex(h + 36, s + 10, l + 24),
    tranche: hslVersHex(h, s * 0.7, l - 30),
    halo: `${halo}42`,
    encre: hslVersHex(h, Math.min(95, s + 8), borne(l - 4, 22, 42)),
    texte: claire ? 'rgba(22,22,26,.92)' : 'rgba(255,255,255,.97)',
    texteDoux: claire ? 'rgba(22,22,26,.6)' : 'rgba(255,255,255,.72)',
  }
}

/** Les variables CSS de la carte (`carteFidelite3D.css`), à poser sur son conteneur. */
export function variablesCarte(hex: string): Record<string, string> {
  const t = teintesCarte(hex)
  return {
    '--wb-cf-c': t.base,
    '--wb-cf-clair': t.clair,
    '--wb-cf-sombre': t.sombre,
    '--wb-cf-lueur': t.lueur,
    '--wb-cf-tranche': t.tranche,
    '--wb-cf-halo': t.halo,
    '--wb-cf-encre': t.encre,
    '--wb-cf-txt': t.texte,
    '--wb-cf-txt-doux': t.texteDoux,
  }
}

/** Numéro affiché sur la carte (« N° 4F2A »), tiré du jeton : stable, sans rien dire du client. */
export function numeroCarte(jeton: string | null | undefined): string | null {
  return jeton && /^[0-9a-f]{4}/.test(jeton) ? jeton.slice(0, 4).toUpperCase() : null
}
