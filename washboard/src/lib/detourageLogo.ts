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
/** En dessous : pixel de fond (bruit JPEG compris), retiré. */
export const ECART_FOND = 28
/** Épaisseur, en pixels, du contour recalculé autour du fond retiré (bords lissés). */
const BANDE = 2
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
 *  épaisseur. Gardée si elle est allongée (`ALLONGEMENT_MAX`), plus loin que `RAPPORT_PROFONDEUR` fois son épaisseur, ou
 *  si elle couvre plus de `PART_SURFACE` du cadre du dessin (grand panneau blanc). Aucune
 *  règle ne distingue tout (un O très gras ressemble à un disque blanc dans un anneau) :
 *  le laveur peut toujours remettre les creux (`creux: false`). */
export const RAPPORT_PROFONDEUR = 6
export const PART_SURFACE = 0.5
/** Au-delà (surface / demi-épaisseur²), la zone est allongée : un trait ou un texte blanc
 *  (anneau, lettres d'un écusson), gardé. Un creux de lettre est ramassé (5 à 15). */
export const ALLONGEMENT_MAX = 25

/** Retire un fond uni, en place, par propagation depuis les bords.
 *
 *  Le fond relié au bord de l'image part. Avec `creux`, les zones enfermées de la même
 *  couleur partent aussi quand ce sont des creux de lettres (voir `RAPPORT_PROFONDEUR`).
 *  Puis le contour : un pixel lissé est un mélange du dessin et du fond. Sa transparence
 *  est calculée d'après la couleur du dessin juste à côté, côté intérieur, et la part du
 *  fond est retirée de sa couleur — sans quoi un liseré clair (ou sombre sur fond noir)
 *  entourerait chaque lettre. Rend le nombre de creux retirés. */
export function retirerFondUni(p: Pixels, fond: readonly [number, number, number], { creux = true }: { creux?: boolean } = {}): number {
  const { data, width, height } = p
  const total = width * height
  const e = new Float32Array(total)
  for (let n = 0; n < total; n++) e[n] = data[n * 4 + 3] < 16 ? 0 : ecart(data, n * 4, fond)
  const estFond = (n: number) => e[n] <= ECART_FOND
  const voisins = (n: number) => {
    const x = n % width, y = (n - x) / width
    return [x > 0 ? n - 1 : -1, x < width - 1 ? n + 1 : -1, y > 0 ? n - width : -1, y < height - 1 ? n + width : -1]
  }
  // 1 : fond extérieur ; 2 : creux retiré.
  const retire = new Uint8Array(total)

  const file: number[] = []
  for (const i of indicesBord(p)) { const n = i / 4; if (!retire[n] && estFond(n)) { retire[n] = 1; file.push(n) } }
  for (let k = 0; k < file.length; k++) {
    for (const v of voisins(file[k])) if (v >= 0 && !retire[v] && estFond(v)) { retire[v] = 1; file.push(v) }
  }

  let retires = 0
  if (creux) retires = retirerCreux(p, e, retire, voisins)

  // Contour : distance (en pixels, 8 voisins) au fond retiré, jusqu'à BANDE + 2.
  const dist = new Uint8Array(total).fill(255)
  let front: number[] = []
  for (let n = 0; n < total; n++) if (retire[n]) { dist[n] = 0; front.push(n) }
  for (let d = 1; d <= BANDE + 2 && front.length; d++) {
    const suivant: number[] = []
    for (const n of front) {
      const x = n % width, y = (n - x) / width
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
        const v = yy * width + xx
        if (dist[v] === 255) { dist[v] = d; suivant.push(v) }
      }
    }
    front = suivant
  }
  const plancher = ECART_FOND / 2
  const alphas = new Float32Array(total).fill(1)
  for (let n = 0; n < total; n++) {
    const d = dist[n]
    if (d === 0 || d > BANDE) continue
    // Couleur du dessin à côté : l'écart le plus fort parmi les voisins plus à l'intérieur ;
    // à défaut (trait très fin), parmi tous les voisins du dessin.
    const x = n % width, y = (n - x) / width
    let interieur = 0, autour = 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
      const v = yy * width + xx
      if (retire[v]) continue
      if (e[v] > autour) autour = e[v]
      if (dist[v] > d && e[v] > interieur) interieur = e[v]
    }
    const encre = interieur || autour
    if (encre <= e[n] || encre <= plancher) continue
    alphas[n] = Math.min(1, Math.max(0, (e[n] - plancher) / (encre - plancher)))
  }
  for (let n = 0; n < total; n++) {
    const i = n * 4
    if (retire[n]) { data[i + 3] = 0; continue }
    const a = alphas[n]
    if (a >= 0.98) continue
    if (a <= 0.02) { data[i + 3] = 0; continue }
    for (let c = 0; c < 3; c++) data[i + c] = fond[c] + (data[i + c] - fond[c]) / a
    data[i + 3] = Math.round(data[i + 3] * a)
  }
  return retires
}

/** Marque les creux de lettres (`retire` = 2) et rend leur nombre. */
function retirerCreux(p: Pixels, e: Float32Array, retire: Uint8Array, voisins: (n: number) => number[]): number {
  const { width, height } = p
  const total = width * height
  const estFond = (n: number) => e[n] <= ECART_FOND

  // Cadre de ce qui reste : la taille d'une zone se juge par rapport au dessin, pas à
  // l'image (un logo posé au milieu de grandes marges aurait sinon des zones « petites »).
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let n = 0; n < total; n++) {
    if (retire[n]) continue
    const x = n % width, y = (n - x) / width
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < 0) return 0
  const plafond = PART_SURFACE * (x1 - x0 + 1) * (y1 - y0 + 1)

  // Distance de chaque pixel au fond extérieur.
  const distance = new Int32Array(total).fill(-1)
  const vague: number[] = []
  for (let n = 0; n < total; n++) if (retire[n]) { distance[n] = 0; vague.push(n) }
  for (let k = 0; k < vague.length; k++) {
    for (const v of voisins(vague[k])) if (v >= 0 && distance[v] < 0) { distance[v] = distance[vague[k]] + 1; vague.push(v) }
  }
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

  const zone = new Uint8Array(total)
  let retires = 0
  for (let n = 0; n < total; n++) {
    if (retire[n] || zone[n] || !estFond(n)) continue
    const composante = [n]
    zone[n] = 1
    for (let k = 0; k < composante.length; k++) {
      for (const v of voisins(composante[k])) {
        if (v < 0 || retire[v] || zone[v] || !estFond(v)) continue
        zone[v] = 1
        composante.push(v)
      }
    }
    if (composante.length > plafond) continue
    const ep = epaisseur(composante)
    if (composante.length > ALLONGEMENT_MAX * ep * ep) continue
    if (eloignement(composante) > RAPPORT_PROFONDEUR * ep + 2) continue
    for (const c of composante) retire[c] = 2
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
