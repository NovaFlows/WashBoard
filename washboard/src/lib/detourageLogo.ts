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

/** Zone enfermée de la couleur du fond : creux de lettre (retiré) ou partie du dessin (gardée) ?
 *
 *  Un creux de lettre (A, O, D…) est entouré d'un simple trait : l'extérieur est tout près.
 *  Un texte blanc au milieu d'un écusson est loin de l'extérieur par rapport à sa propre
 *  épaisseur. Gardée si elle est plus loin que `RAPPORT_PROFONDEUR` fois son épaisseur, ou
 *  si elle couvre plus de `PART_SURFACE` du cadre du dessin (grand panneau blanc). Aucune
 *  règle ne distingue tout (un O très gras ressemble à un disque blanc dans un anneau) :
 *  le laveur peut toujours remettre les creux (`creux: false`). */
export const RAPPORT_PROFONDEUR = 6
export const PART_SURFACE = 0.5

/** Retire un fond uni, en place, par propagation depuis les bords.
 *
 *  Le fond relié au bord de l'image part. Avec `creux`, les petites zones enfermées de
 *  la même couleur partent aussi : l'intérieur d'un A ou d'un O, qui sinon restait
 *  blanc sur la couleur de la page. Les grandes zones enfermées restent (voir
 *  `SEUIL_CREUX`). Les pixels de transition (bords lissés du dessin) deviennent en
 *  partie transparents, et la couleur du fond en est retirée pour ne pas laisser de
 *  liseré clair. Rend le nombre de creux retirés. */
export function retirerFondUni(p: Pixels, fond: readonly [number, number, number], { creux = true }: { creux?: boolean } = {}): number {
  const { data, width, height } = p
  const vu = new Uint8Array(width * height)
  const voisins = (n: number) => {
    const x = n % width, y = (n - x) / width
    return [x > 0 ? n - 1 : -1, x < width - 1 ? n + 1 : -1, y > 0 ? n - width : -1, y < height - 1 ? n + width : -1]
  }
  const propager = (file: number[]) => {
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
      for (const v of voisins(n)) {
        if (v < 0 || vu[v]) continue
        if (ecart(data, v * 4, fond) < ECART_DESSIN) { vu[v] = 1; file.push(v) }
      }
    }
  }

  const bord: number[] = []
  for (const i of indicesBord(p)) {
    const n = i / 4
    if (!vu[n] && ecart(data, i, fond) < ECART_DESSIN) { vu[n] = 1; bord.push(n) }
  }
  propager(bord)
  if (!creux) return 0

  // Cadre de ce qui reste : la taille d'une zone se juge par rapport au dessin, pas à
  // l'image (un logo posé au milieu de grandes marges aurait sinon des zones « petites »).
  const cadre = cadrer({ data, width, height })
  if (!cadre) return 0
  const plafond = PART_SURFACE * cadre.width * cadre.height

  // Distance de chaque pixel au fond extérieur déjà retiré.
  const distance = new Int32Array(width * height).fill(-1)
  const vague: number[] = []
  for (let n = 0; n < width * height; n++) if (vu[n] && data[n * 4 + 3] === 0) { distance[n] = 0; vague.push(n) }
  for (let k = 0; k < vague.length; k++) {
    for (const v of voisins(vague[k])) {
      if (v >= 0 && distance[v] < 0) { distance[v] = distance[vague[k]] + 1; vague.push(v) }
    }
  }

  // Zones enfermées : composantes de pixels de fond que la propagation n'a pas atteintes.
  const zone = new Uint8Array(width * height)
  const eloignement = (c: number[]) => c.reduce((m, n) => (distance[n] >= 0 && distance[n] < m ? distance[n] : m), Infinity)
  // Demi-épaisseur : profondeur maximale à l'intérieur de la zone, depuis son pourtour.
  const epaisseur = (c: number[]) => {
    const dans = new Set(c)
    const prof = new Map<number, number>()
    const f: number[] = []
    for (const n of c) if (voisins(n).some(v => v < 0 || !dans.has(v))) { prof.set(n, 1); f.push(n) }
    let max = 1
    for (let k = 0; k < f.length; k++) {
      const d = prof.get(f[k])!
      if (d > max) max = d
      for (const v of voisins(f[k])) if (v >= 0 && dans.has(v) && !prof.has(v)) { prof.set(v, d + 1); f.push(v) }
    }
    return max
  }
  let retires = 0
  for (let n = 0; n < width * height; n++) {
    if (vu[n] || zone[n] || ecart(data, n * 4, fond) > ECART_FOND) continue
    const composante = [n]
    zone[n] = 1
    for (let k = 0; k < composante.length; k++) {
      for (const v of voisins(composante[k])) {
        if (v < 0 || vu[v] || zone[v] || ecart(data, v * 4, fond) > ECART_FOND) continue
        zone[v] = 1
        composante.push(v)
      }
    }
    if (composante.length > plafond) continue
    if (eloignement(composante) > RAPPORT_PROFONDEUR * epaisseur(composante) + 2) continue
    for (const c of composante) vu[c] = 1
    propager(composante)
    retires++
  }
  return retires
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
