// Silhouettes de véhicules de la page de réservation (demande d'Alexandre, 2026-10-18 :
// « une forme segmentée du modèle apparaît » au choix du véhicule, avec une rotation 3D à
// 360° comme la carte de fidélité ; puis « plus détaillées », pas enfantines).
//
// Dessinées à la main, de profil (avant à droite), dans un repère de 1000 × 400 où le sol est
// à y = 380, aux proportions de vrais modèles (Clio, 208, 508, 3008, Scénic, 5008, Trafic…).
// Les profils sont des listes de points lissés (Catmull-Rom → Bézier) ; un point marqué
// `true` en 3e position est un angle vif. Rendu : SilhouetteVehicule3D.tsx.
//
// Une clé par type de `VEHICLE_LABELS` (lib/vehicle-labels.ts). Un type personnalisé par le
// laveur (catégorie « Canapé », etc.) n'a pas de silhouette : `silhouettePour` rend `null`.

export type Jante = 'alu' | 'moto' | 'scooter' | 'velo'
export type Roue = { cx: number; cy: number; r: number; jante: Jante }
export type Feu = { d: string; ton: 'clair' | 'sombre' }
export type Silhouette = {
  /** Surfaces pleines de carrosserie (contour blanc compris). */
  corps: string[]
  /** Creux sombres des passages de roue. */
  passages: string[]
  /** Parties plus sombres : protections de caisse, moteur, châssis. */
  sombres?: string[]
  vitres?: string[]
  /** Montants entre les vitres. */
  montants?: string[]
  /** Lignes de portes et de panneaux. */
  lignes?: string[]
  poignees?: string[]
  feux?: Feu[]
  /** Reflets : ligne de caisse, arête de réservoir. */
  details?: string[]
  /** Tubes tracés au trait : fourche, guidon, cadre de vélo. */
  traits?: { d: string; w: number }[]
  roues: Roue[]
}
type Pt = [number, number] | [number, number, boolean]

const f = (n: number) => Math.round(n * 10) / 10

/** Courbe lisse passant par les points (Catmull-Rom), ouverte. */
export function lisse(points: Pt[], depart = true): string {
  const p = points.map(q => ({ x: q[0], y: q[1], vif: q[2] === true }))
  let d = depart ? `M ${f(p[0].x)} ${f(p[0].y)}` : `L ${f(p[0].x)} ${f(p[0].y)}`
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2
    const t1 = p1.vif ? 0 : 1, t2 = p2.vif ? 0 : 1
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * t1, y: p1.y + ((p2.y - p0.y) / 6) * t1 }
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * t2, y: p2.y - ((p3.y - p1.y) / 6) * t2 }
    d += ` C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`
  }
  return d
}
/** Forme fermée lisse. */
const ferme = (pts: Pt[]) => lisse(pts) + ' Z'

/** Arche de roue : de l'avant vers l'arrière, au-dessus de la roue, jusqu'à la ligne y. */
function arche(cx: number, cy: number, R: number, y: number) {
  const dy = y - cy
  const dx = Math.sqrt(Math.max(0, R * R - dy * dy))
  return { droite: [cx + dx, y], gauche: [cx - dx, y], d: `L ${f(cx + dx)} ${f(y)} A ${R} ${R} 0 1 0 ${f(cx - dx)} ${f(y)}` }
}
/** Le passage de roue (creux sombre), même arche fermée sur la ligne du bas. */
function passage(cx: number, cy: number, R: number, y: number) {
  const a = arche(cx, cy, R, y)
  return `M ${f(a.droite[0])} ${f(a.droite[1])} A ${R} ${R} 0 1 0 ${f(a.gauche[0])} ${f(a.gauche[1])} Z`
}

/** Une voiture : profil du dessus (arrière bas → avant bas), puis bas de caisse avec arches. */
type Voiture = {
  profil: Pt[]; bas: number; roues: { cx: number; cy: number; r: number }[]; R: number; vitres: string[]
  montants?: string[]; retro?: string; lignes?: string[]; poignees?: string[]; feux?: Feu[]; details?: string[]; sombres?: string[]; extra?: string[]
}
function voiture({ profil, bas, roues: roues0, R: R0, vitres, montants = [], retro, lignes = [], poignees = [], feux = [], details = [], sombres = [], extra = [] }: Voiture): Silhouette {
  // Roues modernes : un peu plus grandes que les cotes d'origine, toujours posées au sol.
  const roues = roues0.map(r => ({ cx: r.cx, r: r.r + 6, cy: 380 - (r.r + 6) }))
  const R = R0 + 6
  const [ar, av] = roues
  const aAv = arche(av.cx, av.cy, R, bas), aAr = arche(ar.cx, ar.cy, R, bas)
  const corps = lisse(profil) + ` ${aAv.d} ${aAr.d} Z`
  return {
    corps: [corps, ...(retro ? [retro] : []), ...extra],
    passages: [passage(av.cx, av.cy, R, bas), passage(ar.cx, ar.cy, R, bas)],
    sombres, vitres, montants, lignes, poignees, feux, details,
    roues: roues.map(r => ({ ...r, jante: 'alu' as const })),
  }
}
const rect = (x1: number, y1: number, x2: number, y2: number, r = 3) => `M ${x1 + r} ${y1} L ${x2 - r} ${y1} Q ${x2} ${y1} ${x2} ${y1 + r} L ${x2} ${y2 - r} Q ${x2} ${y2} ${x2 - r} ${y2} L ${x1 + r} ${y2} Q ${x1} ${y2} ${x1} ${y2 - r} L ${x1} ${y1 + r} Q ${x1} ${y1} ${x1 + r} ${y1} Z`
const poignee = (x: number, y: number) => rect(x, y, x + 36, y + 8, 4)

export const SILHOUETTES: Record<string, Silhouette> = {
  // ── Clio : 4,05 × 1,44 m, empattement 2,58 m ──
  citadine: voiture({
    profil: [[142, 346], [118, 338], [104, 318], [100, 290], [102, 262], [108, 236], [114, 206], [124, 166], [138, 136], [156, 116], [186, 100], [250, 91], [360, 88], [440, 92], [500, 106], [560, 152], [604, 196, true], [652, 208], [722, 220], [784, 232], [834, 244], [868, 258], [892, 276], [903, 298], [902, 322], [893, 337], [868, 346]],
    bas: 346, R: 72, roues: [{ cx: 215, cy: 318, r: 62 }, { cx: 731, cy: 318, r: 62 }],
    vitres: [ferme([[178, 202, true], [184, 156], [204, 126], [244, 110], [360, 105], [436, 109], [478, 122], [532, 164], [566, 198, true], [178, 204, true]])],
    montants: [rect(232, 104, 250, 204, 2), rect(384, 100, 400, 204, 2)],
    retro: ferme([[560, 214, true], [562, 196], [580, 186], [606, 186], [614, 194], [608, 210], [590, 218], [560, 216, true]]),
    lignes: [lisse([[392, 206], [394, 300], [392, 344]]), lisse([[596, 210], [608, 260], [606, 318]]), lisse([[252, 208], [250, 250], [262, 280]])],
    poignees: [poignee(300, 232), poignee(500, 228)],
    feux: [{ d: ferme([[818, 240, true], [860, 250], [888, 266], [884, 276], [846, 266], [816, 254, true]]), ton: 'clair' }, { d: ferme([[104, 214, true], [146, 212], [150, 226], [142, 246], [106, 250, true]]), ton: 'sombre' }],
    details: [lisse([[112, 254], [400, 250], [700, 246], [880, 244]])],
    sombres: [ferme([[300, 346, true], [300, 334, true], [646, 332, true], [646, 346, true]])],
  }),

  // ── 208 trois portes : plus courte, toit plus rond, une seule grande porte ──
  citadine_2p: voiture({
    profil: [[152, 346], [128, 338], [114, 318], [110, 290], [112, 262], [118, 236], [124, 210], [134, 170], [148, 140], [170, 118], [204, 102], [270, 95], [360, 94], [430, 100], [488, 114], [546, 158], [590, 198, true], [640, 210], [712, 222], [772, 233], [822, 245], [858, 259], [882, 277], [893, 299], [892, 322], [883, 338], [858, 346]],
    bas: 346, R: 72, roues: [{ cx: 221, cy: 318, r: 62 }, { cx: 721, cy: 318, r: 62 }],
    vitres: [ferme([[192, 200, true], [200, 160], [224, 128], [266, 113], [360, 109], [426, 114], [466, 128], [520, 168], [554, 200, true], [192, 204, true]])],
    montants: [rect(292, 106, 312, 204, 2)],
    retro: ferme([[546, 214, true], [548, 196], [566, 186], [592, 186], [600, 194], [594, 210], [576, 218], [546, 216, true]]),
    lignes: [lisse([[314, 208], [312, 280], [316, 344]]), lisse([[584, 212], [596, 262], [594, 318]])],
    poignees: [poignee(340, 232)],
    feux: [{ d: ferme([[810, 242, true], [852, 252], [878, 268], [874, 278], [836, 268], [806, 256, true]]), ton: 'clair' }, { d: ferme([[114, 214, true], [154, 212], [158, 226], [150, 246], [116, 250, true]]), ton: 'sombre' }],
    details: [lisse([[120, 254], [420, 250], [700, 246], [872, 244]])],
    sombres: [ferme([[306, 346, true], [306, 334, true], [636, 332, true], [636, 346, true]])],
  }),

  // ── Berline (508, A6) : 4,8 × 1,43 m, empattement 2,85 m, coffre ──
  berline: voiture({
    profil: [[62, 348], [36, 338], [25, 312], [22, 282], [25, 254], [30, 240], [40, 228, true], [110, 220], [172, 213], [232, 176], [300, 128], [362, 104], [430, 96], [520, 94], [600, 98], [652, 112], [720, 160], [760, 196, true], [806, 206], [872, 216], [922, 226], [954, 239], [972, 257], [980, 282], [978, 310], [968, 331], [940, 346]],
    bas: 346, R: 74, roues: [{ cx: 222, cy: 314, r: 66 }, { cx: 792, cy: 314, r: 66 }],
    vitres: [ferme([[240, 208, true], [300, 152], [362, 120], [430, 112], [520, 110], [598, 114], [640, 126], [700, 168], [730, 198, true], [240, 210, true]])],
    montants: [rect(294, 120, 304, 210, 2), rect(500, 108, 516, 210, 2)],
    retro: ferme([[716, 214, true], [718, 194], [740, 184], [766, 186], [774, 194], [768, 208], [750, 216], [716, 216, true]]),
    lignes: [lisse([[508, 212], [510, 300], [508, 344]]), lisse([[730, 212], [742, 262], [740, 316]]), lisse([[306, 212], [300, 254], [312, 286]])],
    poignees: [poignee(398, 236), poignee(604, 232)],
    feux: [{ d: ferme([[900, 232, true], [944, 238], [966, 252], [960, 262], [930, 256], [896, 244, true]]), ton: 'clair' }, { d: ferme([[30, 236, true], [96, 228], [102, 236], [96, 246], [32, 252, true]]), ton: 'sombre' }],
    details: [lisse([[40, 254], [300, 250], [640, 244], [960, 240]])],
    sombres: [ferme([[300, 346, true], [300, 334, true], [712, 332, true], [712, 346, true]])],
  }),

  // ── SUV (3008) : 4,45 × 1,62 m, empattement 2,68 m, protections de caisse ──
  SUV: voiture({
    profil: [[100, 338], [76, 328], [64, 306], [60, 276], [62, 246], [66, 214], [72, 182], [84, 130], [96, 98], [112, 76], [126, 64, true], [160, 58], [240, 54], [380, 52], [500, 54], [560, 64], [620, 108], [668, 154, true], [720, 168], [800, 178], [860, 190], [902, 204], [930, 224], [942, 252], [945, 282], [940, 310], [928, 330], [902, 338]],
    bas: 338, R: 84, roues: [{ cx: 215, cy: 308, r: 72 }, { cx: 751, cy: 308, r: 72 }],
    vitres: [ferme([[118, 172, true], [128, 122], [146, 94], [178, 78], [380, 72], [500, 74], [548, 86], [600, 128], [640, 168, true], [118, 176, true]])],
    montants: [rect(170, 82, 196, 176, 2), rect(306, 74, 322, 176, 2), rect(472, 72, 488, 176, 2)],
    retro: ferme([[624, 186, true], [626, 166], [648, 156], [676, 158], [684, 166], [678, 180], [660, 188], [624, 188, true]]),
    lignes: [lisse([[480, 178], [482, 270], [480, 312]]), lisse([[660, 182], [672, 232], [670, 290]]), lisse([[322, 178], [320, 250], [300, 300]])],
    poignees: [poignee(372, 208), poignee(600, 204)],
    feux: [{ d: ferme([[866, 198, true], [914, 206], [936, 220], [930, 230], [896, 224], [862, 210, true]]), ton: 'clair' }, { d: ferme([[66, 184, true], [124, 180], [128, 192], [120, 204], [68, 208, true]]), ton: 'sombre' }],
    details: [lisse([[72, 230], [400, 226], [700, 220], [930, 216]])],
    // Protections noires : bas de caisse et élargisseurs d'ailes.
    sombres: [ferme([[290, 338, true], [290, 310], [420, 306], [676, 306], [676, 338, true]])],
    extra: [ferme([[150, 44, true], [160, 40], [520, 40], [530, 44], [530, 50, true], [150, 54, true]])],
  }),

  // ── Monospace (Scénic) : 4,6 × 1,65 m, pare-brise très avancé ──
  monospace: voiture({
    profil: [[86, 346], [62, 336], [50, 314], [46, 284], [48, 250], [52, 216], [56, 170], [62, 110], [72, 78], [92, 59], [130, 50], [300, 46], [460, 46], [540, 52], [582, 64], [660, 122], [740, 190, true], [792, 204], [860, 216], [902, 226], [932, 238], [950, 256], [958, 282], [957, 312], [948, 334], [922, 346]],
    bas: 346, R: 74, roues: [{ cx: 200, cy: 314, r: 66 }, { cx: 760, cy: 314, r: 66 }],
    vitres: [ferme([[66, 182, true], [72, 112], [86, 84], [118, 66], [300, 62], [460, 62], [536, 68], [572, 86], [640, 140], [702, 194, true], [66, 186, true]])],
    montants: [rect(166, 64, 184, 186, 2), rect(420, 60, 436, 186, 2), rect(598, 100, 606, 186, 1)],
    retro: ferme([[684, 208, true], [686, 188], [708, 178], [734, 180], [742, 188], [736, 202], [718, 210], [684, 210, true]]),
    lignes: [lisse([[428, 190], [430, 290], [428, 344]]), lisse([[716, 200], [728, 254], [726, 316]]), lisse([[186, 190], [184, 260], [196, 290]])],
    poignees: [poignee(330, 236), poignee(546, 232)],
    feux: [{ d: ferme([[878, 230, true], [922, 236], [946, 250], [940, 260], [908, 254], [874, 242, true]]), ton: 'clair' }, { d: ferme([[52, 182, true], [86, 182], [90, 216], [84, 248], [54, 250, true]]), ton: 'sombre' }],
    details: [lisse([[58, 252], [400, 248], [700, 242], [944, 238]])],
    sombres: [ferme([[282, 346, true], [282, 334, true], [680, 332, true], [680, 346, true]])],
  }),

  // ── 7 places (5008) : 4,7 × 1,68 m, empattement 2,84 m, hayon droit ──
  '7places': voiture({
    profil: [[76, 338], [52, 328], [40, 306], [36, 274], [38, 240], [42, 206], [46, 160], [52, 96], [60, 68], [78, 52], [110, 44], [300, 40], [500, 40], [600, 44], [650, 56], [708, 104], [752, 152, true], [800, 166], [870, 176], [920, 188], [950, 204], [966, 228], [970, 258], [968, 292], [958, 322], [930, 338]],
    bas: 338, R: 84, roues: [{ cx: 220, cy: 308, r: 72 }, { cx: 788, cy: 308, r: 72 }],
    vitres: [ferme([[56, 166, true], [60, 102], [72, 74], [98, 60], [300, 56], [560, 56], [624, 68], [680, 116], [724, 166, true], [56, 170, true]])],
    montants: [rect(124, 58, 146, 170, 2), rect(300, 56, 316, 170, 2), rect(520, 56, 536, 170, 2)],
    retro: ferme([[708, 184, true], [710, 164], [732, 154], [760, 156], [768, 164], [762, 178], [744, 186], [708, 186, true]]),
    lignes: [lisse([[528, 172], [530, 266], [528, 312]]), lisse([[742, 176], [754, 226], [752, 290]]), lisse([[316, 172], [314, 250], [300, 300]])],
    poignees: [poignee(362, 208), poignee(604, 204)],
    feux: [{ d: ferme([[900, 196, true], [946, 202], [966, 216], [960, 226], [928, 222], [896, 208, true]]), ton: 'clair' }, { d: ferme([[40, 168, true], [96, 166], [100, 178], [92, 190], [42, 194, true]]), ton: 'sombre' }],
    details: [lisse([[50, 228], [400, 222], [700, 216], [954, 212]])],
    sombres: [ferme([[296, 338, true], [296, 310], [420, 306], [712, 306], [712, 338, true]])],
    extra: [ferme([[110, 30, true], [120, 26], [610, 26], [620, 30], [620, 36, true], [110, 40, true]])],
  }),

  // ── Utilitaire (Trafic) : caisse haute, capot court ──
  utilitaire: voiture({
    profil: [[92, 346], [68, 338], [56, 318], [52, 290], [52, 120], [53, 60], [57, 40], [72, 28], [112, 25], [300, 24], [600, 24], [664, 28], [702, 42], [760, 100], [814, 170, true], [852, 190], [900, 206], [928, 220], [944, 244], [950, 276], [948, 312], [938, 334], [912, 346]],
    bas: 346, R: 72, roues: [{ cx: 221, cy: 318, r: 62 }, { cx: 779, cy: 318, r: 62 }],
    vitres: [ferme([[676, 52, true], [704, 54], [744, 94], [792, 166, true], [676, 168, true]])],
    montants: [],
    retro: ferme([[782, 196, true], [784, 160], [800, 150], [826, 152], [834, 162], [830, 188], [814, 198], [782, 198, true]]),
    lignes: [lisse([[666, 40], [668, 200], [664, 344]]), lisse([[420, 40], [420, 344]]), lisse([[806, 182], [818, 240], [816, 300]]), lisse([[56, 206], [400, 204], [660, 202]])],
    poignees: [poignee(626, 212), poignee(436, 214)],
    feux: [{ d: ferme([[886, 210, true], [928, 218], [944, 236], [936, 244], [904, 238], [882, 222, true]]), ton: 'clair' }, { d: ferme([[53, 120, true], [70, 120], [70, 262], [53, 262, true]]), ton: 'sombre' }],
    details: [],
    sombres: [ferme([[54, 300, true], [140, 300], [140, 318], [54, 318, true]]), ferme([[300, 300, true], [700, 300], [700, 318], [300, 318, true]])],
  }),
}

// ── Deux-roues et grands véhicules ──
const trait = (pts: Pt[], w: number) => ({ d: lisse(pts), w })

const AUTRES: Record<string, Silhouette> = {
  // Profilé avec capucine au-dessus de la cabine.
  'camping-car': (() => {
    const roues = [{ cx: 350, cy: 330, r: 50 }, { cx: 822, cy: 330, r: 50 }]
    const R = 58, bas = 348
    const aAv = arche(822, 330, R, bas), aAr = arche(350, 330, R, bas)
    const profil: Pt[] = [[98, 350], [72, 344], [62, 326], [60, 300], [60, 60], [64, 32], [80, 20], [112, 18], [700, 18], [742, 21], [774, 31], [792, 50], [797, 74], [789, 93], [770, 103], [744, 105, true], [792, 160], [826, 200, true], [864, 214], [904, 226], [925, 240], [935, 262], [938, 292], [935, 322], [922, 340], [896, 348]]
    return {
      corps: [lisse(profil) + ` ${aAv.d} ${aAr.d} Z`, ferme([[800, 196, true], [802, 158], [818, 148], [844, 150], [852, 160], [848, 186], [832, 198], [800, 198, true]])],
      passages: [passage(822, 330, R, bas), passage(350, 330, R, bas)],
      sombres: [ferme([[62, 300, true], [290, 300], [290, 330], [62, 330, true]]), ferme([[412, 300, true], [760, 300], [760, 330], [412, 330, true]])],
      vitres: [ferme([[744, 120, true], [780, 120], [814, 196, true], [744, 196, true]]), rect(110, 70, 244, 152, 12), rect(440, 70, 574, 152, 12), rect(640, 38, 742, 88, 12)],
      montants: [rect(176, 70, 180, 152, 1), rect(506, 70, 510, 152, 1)],
      lignes: [rect(292, 62, 362, 330, 8), lisse([[62, 288], [400, 288], [740, 288]]), lisse([[740, 104], [742, 300]])],
      poignees: [rect(346, 186, 354, 214, 3)],
      feux: [{ d: ferme([[882, 226, true], [922, 232], [934, 248], [926, 256], [896, 250], [880, 236, true]]), ton: 'clair' }, { d: rect(60, 250, 74, 300, 3), ton: 'sombre' }],
      details: [lisse([[62, 232], [400, 232], [800, 228]]), lisse([[62, 244], [400, 244], [790, 240]])],
      roues: roues.map(r => ({ ...r, jante: 'alu' as const })),
    }
  })(),

  // Porteur avec caisse : cabine à l'avant, caisse haute derrière, châssis apparent.
  camion: (() => {
    const roues = [{ cx: 300, cy: 330, r: 50 }, { cx: 792, cy: 330, r: 50 }]
    const R = 58
    const aAv = arche(792, 330, R, 346)
    const cabine = lisse([[640, 346, true], [640, 112, true], [700, 108], [746, 112], [774, 130], [798, 176], [814, 218, true], [848, 234], [874, 250], [884, 276], [886, 308], [880, 330], [864, 342], [842, 346]]) + ` ${aAv.d} Z`
    const aAr = arche(300, 330, R, 330)
    const chassis = `M 650 292 L 650 330 ${aAr.d} L 118 330 L 118 292 Z`
    return {
      corps: [rect(110, 24, 654, 292, 10), cabine, ferme([[784, 192, true], [786, 144], [802, 134], [826, 136], [834, 146], [830, 180], [814, 194], [784, 194, true]])],
      passages: [passage(792, 330, R, 346), passage(300, 330, R, 330)],
      sombres: [chassis],
      vitres: [ferme([[668, 124, true], [744, 122], [770, 140], [792, 198, true], [668, 200, true]])],
      montants: [],
      lignes: [...[200, 290, 380, 470, 560].map(x => `M ${x} 34 L ${x} 284`), lisse([[660, 206], [664, 300], [660, 340]]), 'M 110 260 L 654 260'],
      poignees: [poignee(690, 214)],
      feux: [{ d: ferme([[848, 238, true], [878, 244], [884, 260], [872, 264], [850, 254, true]]), ton: 'clair' }, { d: rect(112, 240, 124, 284, 3), ton: 'sombre' }],
      details: [],
      roues: roues.map(r => ({ ...r, jante: 'alu' as const })),
    }
  })(),

  // Roadster : réservoir sculpté, selle étagée, moteur, bras oscillant, fourche.
  moto: {
    corps: [
      ferme([[150, 126, true], [240, 146], [262, 168], [234, 184], [176, 172], [150, 148, true]]),
      ferme([[236, 148, true], [300, 144], [384, 150], [430, 164], [422, 182], [340, 180], [262, 172, true]]),
      ferme([[420, 170], [440, 122], [482, 96], [542, 92], [602, 104], [642, 128], [652, 162], [600, 178], [482, 182]]),
      ferme([[270, 272, true], [440, 250], [452, 278], [282, 298, true]]),
      ferme([[300, 252, true], [462, 264], [472, 288], [330, 292], [290, 278, true]]),
      ferme([[690, 110], [742, 96], [782, 112], [792, 150], [772, 180], [732, 186], [702, 160]]),
      ferme([[648, 198], [710, 172], [792, 182], [822, 202], [802, 208], [722, 192], [660, 212]]),
    ],
    traits: [trait([[700, 120], [736, 280]], 16), trait([[640, 98], [700, 70], [722, 80]], 10), trait([[362, 172], [320, 270]], 12)],
    passages: [],
    sombres: [ferme([[420, 194], [600, 186], [640, 212], [632, 280], [582, 312], [470, 318], [420, 292], [402, 240]])],
    vitres: [ferme([[744, 106], [778, 118], [786, 148], [762, 150], [748, 128]])],
    lignes: [lisse([[450, 200], [540, 196], [610, 204]]), lisse([[440, 240], [600, 236]]), lisse([[440, 270], [590, 268]])],
    feux: [{ d: ferme([[770, 122], [790, 132], [792, 150], [774, 150]]), ton: 'clair' }, { d: ferme([[150, 128, true], [168, 132], [164, 142], [150, 140, true]]), ton: 'sombre' }],
    details: [lisse([[480, 108], [560, 102], [620, 116]])],
    roues: [{ cx: 270, cy: 280, r: 100, jante: 'moto' }, { cx: 736, cy: 280, r: 100, jante: 'moto' }],
  },

  // Vespa : coque arrière bombée, selle, plancher, tablier avant, garde-boue.
  scooter: {
    corps: [
      ferme([[180, 300], [178, 250], [202, 202], [262, 172], [362, 162], [432, 170], [472, 192], [482, 232], [472, 278], [432, 302], [300, 308]]),
      ferme([[230, 168, true], [262, 140], [332, 130], [422, 134], [462, 150], [452, 172], [342, 166], [252, 174, true]]),
      ferme([[592, 302], [598, 244], [614, 184], [636, 134], [662, 96], [690, 74], [712, 80], [708, 112], [694, 150], [684, 200], [680, 252], [684, 302]]),
      ferme([[636, 64], [698, 42], [764, 46], [776, 64], [724, 74], [650, 82]]),
      ferme([[640, 252], [690, 228], [760, 234], [802, 264], [786, 272], [722, 252], [662, 270]]),
    ],
    traits: [trait([[700, 80], [720, 300]], 12)],
    passages: [],
    sombres: [ferme([[460, 290, true], [640, 286], [652, 308], [460, 314, true]])],
    vitres: [],
    lignes: [lisse([[220, 236], [330, 214], [450, 220]]), lisse([[612, 220], [650, 140]])],
    feux: [{ d: ferme([[712, 48], [748, 50], [754, 58], [716, 60]]), ton: 'clair' }, { d: ferme([[182, 252, true], [200, 246], [204, 262], [184, 268, true]]), ton: 'sombre' }],
    details: [lisse([[214, 214], [320, 186], [440, 190]])],
    roues: [{ cx: 300, cy: 310, r: 70, jante: 'scooter' }, { cx: 720, cy: 310, r: 70, jante: 'scooter' }],
  },

  // Vélo de ville : cadre en tubes, selle, guidon, pédalier.
  velo: {
    corps: [ferme([[370, 104], [402, 96], [462, 98], [472, 108], [422, 116], [382, 116]]), 'M 482 270 A 32 32 0 1 0 418 270 A 32 32 0 1 0 482 270 Z'],
    traits: [
      trait([[260, 270], [450, 270]], 10), trait([[260, 270], [432, 142]], 10), trait([[426, 118], [450, 270]], 13),
      trait([[432, 152], [682, 150]], 13), trait([[684, 160], [450, 270]], 15), trait([[682, 138], [692, 182]], 17),
      trait([[692, 182], [740, 270]], 11), trait([[682, 138], [672, 100], [724, 96]], 9), trait([[450, 270], [474, 332]], 8),
    ],
    passages: [],
    sombres: [],
    vitres: [],
    lignes: [],
    feux: [],
    details: [],
    roues: [{ cx: 260, cy: 270, r: 110, jante: 'velo' }, { cx: 740, cy: 270, r: 110, jante: 'velo' }],
  },
}
Object.assign(SILHOUETTES, AUTRES)

/** La silhouette d'un type de véhicule, ou `null` pour un type qui n'en a pas. */
export function silhouettePour(type: string | null | undefined): Silhouette | null {
  return type && Object.prototype.hasOwnProperty.call(SILHOUETTES, type) ? SILHOUETTES[type] : null
}
