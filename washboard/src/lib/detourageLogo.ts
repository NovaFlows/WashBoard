// Détourage d'un logo, sans navigateur ni modèle : calculs sur les pixels bruts,
// vérifiables en test. Le branchement (canvas, modèle d'IA) est dans `preparerLogo.ts`.
//
// Pourquoi pas le modèle d'IA pour tout : il est fait pour détourer des photos. Sur
// un logo, il efface des lettres, des traits fins, des reflets (constaté sur les
// logos envoyés fin octobre 2026). La plupart des logos sont posés sur un fond d'une
// seule couleur : on retire alors exactement ce fond, depuis les bords, sans jamais
// toucher au dessin. Le modèle ne sert plus qu'aux fonds dégradés ou photographiques.

export type Pixels = { data: Uint8ClampedArray; width: number; height: number }

export type Analyse =
  | { methode: 'deja-detoure' }
  | { methode: 'fond-uni'; fond: [number, number, number] }
  | { methode: 'ia' }

/** Épaisseur, en pixels, de la bordure lue pour reconnaître le fond. */
const BORD = 2
/** Part de bordure transparente au-delà de laquelle l'image est déjà détourée. */
const SEUIL_DEJA_DETOURE = 0.3
/** Part de bordure de la même couleur au-delà de laquelle le fond est uni. */
const SEUIL_FOND_UNI = 0.85
/** Écart de couleur (distance RVB) toléré pour la bordure d'un fond uni. */
const ECART_BORD = 40
/** En dessous : pixel de fond, retiré. Entre les deux : bord adouci, en partie transparent.
 *  Seule la première rangée de pixels du dessin est concernée (la propagation s'y arrête) :
 *  un écart large adoucit bien les bords lissés sans entamer l'intérieur du dessin. */
export const ECART_FOND = 28
export const ECART_DESSIN = 160
/** Alpha en dessous duquel un pixel ne compte pas dans le cadrage. */
const ALPHA_VISIBLE = 10

function ecart(d: Uint8ClampedArray, i: number, c: readonly number[]): number {
  const r = d[i] - c[0], g = d[i + 1] - c[1], b = d[i + 2] - c[2]
  return Math.sqrt(r * r + g * g + b * b)
}

function indicesBord({ width, height }: Pixels): number[] {
  const out: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < BORD || y < BORD || x >= width - BORD || y >= height - BORD) out.push((y * width + x) * 4)
    }
  }
  return out
}

function mediane(v: number[]): number {
  const s = [...v].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)] ?? 0
}

/** Reconnaît ce qu'il y a autour du logo, d'après sa bordure. */
export function analyserBord(p: Pixels): Analyse {
  const bord = indicesBord(p)
  if (bord.length === 0) return { methode: 'ia' }
  const transparents = bord.filter(i => p.data[i + 3] < 16).length
  if (transparents / bord.length >= SEUIL_DEJA_DETOURE) return { methode: 'deja-detoure' }

  const opaques = bord.filter(i => p.data[i + 3] >= 16)
  const fond: [number, number, number] = [
    mediane(opaques.map(i => p.data[i])),
    mediane(opaques.map(i => p.data[i + 1])),
    mediane(opaques.map(i => p.data[i + 2])),
  ]
  const proches = opaques.filter(i => ecart(p.data, i, fond) <= ECART_BORD).length
  return proches / bord.length >= SEUIL_FOND_UNI ? { methode: 'fond-uni', fond } : { methode: 'ia' }
}

/** Retire un fond uni, en place, par propagation depuis les bords.
 *
 *  Seul le fond relié au bord de l'image part : une couleur identique à l'intérieur
 *  du dessin (lettres blanches d'un écusson sur fond blanc) reste intacte. Les pixels
 *  de transition (bords lissés du dessin) deviennent en partie transparents, et la
 *  couleur du fond en est retirée pour ne pas laisser de liseré clair. */
export function retirerFondUni(p: Pixels, fond: readonly [number, number, number]): void {
  const { data, width, height } = p
  const vu = new Uint8Array(width * height)
  const file: number[] = []
  for (const i of indicesBord(p)) {
    const n = i / 4
    if (!vu[n] && ecart(data, i, fond) < ECART_DESSIN) { vu[n] = 1; file.push(n) }
  }
  while (file.length) {
    const n = file.pop()!
    const i = n * 4
    const e = ecart(data, i, fond)
    if (e > ECART_FOND) {
      // Bord lissé : on ne se propage pas plus loin, c'est déjà le dessin.
      const a = (e - ECART_FOND) / (ECART_DESSIN - ECART_FOND)
      for (let c = 0; c < 3; c++) data[i + c] = fond[c] + (data[i + c] - fond[c]) / a
      data[i + 3] = Math.round(data[i + 3] * a)
      continue
    }
    data[i + 3] = 0
    const x = n % width, y = (n - x) / width
    const voisins = [x > 0 ? n - 1 : -1, x < width - 1 ? n + 1 : -1, y > 0 ? n - width : -1, y < height - 1 ? n + width : -1]
    for (const v of voisins) {
      if (v < 0 || vu[v]) continue
      if (ecart(data, v * 4, fond) < ECART_DESSIN) { vu[v] = 1; file.push(v) }
    }
  }
}

/** Part de pixels visibles : sert à refuser un détourage qui aurait tout effacé. */
export function partVisible({ data }: Pixels): number {
  let v = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > ALPHA_VISIBLE) v++
  return v / (data.length / 4)
}

/** Cadre serré autour du dessin, avec une petite marge.
 *
 *  Sans lui, un logo posé au milieu d'une grande image vide s'affiche minuscule :
 *  la page réserve la place de l'image entière. `null` si rien n'est visible. */
export function cadrer(p: Pixels): { x: number; y: number; width: number; height: number } | null {
  const { data, width, height } = p
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > ALPHA_VISIBLE) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  const marge = Math.max(2, Math.round(0.02 * Math.max(x1 - x0, y1 - y0)))
  const x = Math.max(0, x0 - marge), y = Math.max(0, y0 - marge)
  return { x, y, width: Math.min(width, x1 + marge + 1) - x, height: Math.min(height, y1 + marge + 1) - y }
}
