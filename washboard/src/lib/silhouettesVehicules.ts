// Silhouettes de véhicules de la page de réservation (demande d'Alexandre, 2026-10-18 :
// « une forme segmentée du modèle apparaît » quand le client choisit son véhicule, avec une
// rotation 3D à 360° comme la carte de fidélité). Dessinées à la main, de profil (avant à
// droite), dans un repère de 400 × 160 où le sol est à y = 152.
//
// Une clé par type de `VEHICLE_LABELS` (lib/vehicle-labels.ts). Un type personnalisé par le
// laveur (catégorie « Canapé », etc.) n'a pas de silhouette : `silhouettePour` rend `null`.

export type Roue = { cx: number; cy: number; r: number; /** Roue de vélo : jante fine, pas de pneu plein. */ fin?: boolean }
export type Silhouette = {
  /** Surfaces pleines (carrosserie, cadre, selle…). */
  corps: string[]
  /** Tubes, tracés au trait (fourche, cadre de vélo). */
  traits?: { d: string; w: number }[]
  /** Vitres, plus claires que la carrosserie. */
  vitres?: string[]
  /** Liserés : portes, panneaux. */
  lignes?: string[]
  roues: Roue[]
}

// Proportions tirées de vraies dimensions (1 m ≈ 80 px) : longueur, hauteur, empattement,
// porte-à-faux, diamètre de roue. corps : surfaces pleines ; traits : tubes ; vitres ;
// roues ; lignes : liserés (portes, panneaux).
const arche = (cx: number, R: number, y: number) => `L ${cx + R} ${y} A ${R} ${R} 0 0 0 ${cx - R} ${y}`

export const SILHOUETTES: Record<string, Silhouette> = {
  // Clio : 4,05 × 1,44 m, empattement 2,58 m.
  citadine: {
    corps: [`M 46 128 Q 39 126 38 116 L 37 100 Q 37 92 40 84 L 45 62 Q 48 50 60 46 L 88 39 Q 106 35 140 35 L 192 35 Q 208 36 220 45 L 256 72 Q 263 76 280 78 L 326 84 Q 348 87 355 98 L 359 108 Q 361 122 352 128 ${arche(296, 29, 128)} ${arche(90, 29, 128)} Z`],
    vitres: [
      'M 58 70 L 63 56 Q 67 49 80 46 L 104 42 L 148 41 L 148 71 L 60 72 Z',
      'M 154 41 L 192 41 Q 204 42 213 49 L 244 72 L 154 72 Z',
    ],
    lignes: ['M 151 78 L 151 124', 'M 247 80 Q 252 102 248 124'],
    roues: [{ cx: 90, cy: 127, r: 25 }, { cx: 296, cy: 127, r: 25 }],
  },
  // 208 3 portes / Mini : plus courte, toit rond, une grande porte.
  citadine_2p: {
    corps: [`M 60 128 Q 52 126 51 116 L 50 100 Q 50 90 54 82 L 60 62 Q 64 50 76 46 L 106 38 Q 122 34 150 34 L 188 34 Q 204 35 216 44 L 250 72 Q 257 76 274 78 L 316 84 Q 336 87 342 98 L 346 108 Q 348 122 339 128 ${arche(284, 28, 128)} ${arche(104, 28, 128)} Z`],
    vitres: [
      'M 72 70 L 77 56 Q 81 49 94 46 L 118 41 L 132 41 L 132 72 L 74 72 Z',
      'M 138 40 L 188 40 Q 200 41 209 48 L 238 72 L 138 72 Z',
    ],
    lignes: ['M 241 80 Q 246 102 242 124', 'M 136 80 L 136 124'],
    roues: [{ cx: 104, cy: 127, r: 25 }, { cx: 284, cy: 127, r: 25 }],
  },
  // 508 / berline tricorps : 4,75 × 1,42 m, empattement 2,8 m, coffre.
  berline: {
    corps: [`M 18 128 Q 11 126 10 116 L 10 100 Q 11 90 16 86 Q 22 80 40 79 L 80 75 Q 96 72 112 60 L 140 44 Q 152 38 178 37 L 222 37 Q 238 38 250 47 L 284 72 Q 292 77 310 79 L 356 85 Q 380 89 386 100 L 389 110 Q 391 123 381 128 ${arche(318, 30, 128)} ${arche(94, 30, 128)} Z`],
    vitres: [
      'M 112 70 Q 122 62 134 54 L 150 46 Q 160 42 174 42 L 200 42 L 200 72 L 116 73 Q 108 73 112 70 Z',
      'M 206 42 L 222 42 Q 235 43 244 50 L 272 72 L 206 72 Z',
    ],
    lignes: ['M 203 78 L 203 124', 'M 276 80 Q 281 102 277 124', 'M 22 86 Q 50 82 84 80'],
    roues: [{ cx: 94, cy: 126, r: 26 }, { cx: 318, cy: 126, r: 26 }],
  },
  // 3008 / Qashqai : 4,45 × 1,62 m, empattement 2,68 m, garde au sol haute.
  SUV: {
    corps: [
      `M 30 120 Q 23 118 22 108 L 22 92 Q 22 82 25 76 L 32 48 Q 35 36 48 32 L 64 28 Q 80 25 110 25 L 196 25 Q 212 26 224 34 L 262 62 Q 270 67 288 69 L 338 74 Q 362 77 370 90 L 376 102 Q 378 116 368 120 ${arche(308, 34, 120)} ${arche(94, 34, 120)} Z`,
      'M 72 22 L 190 21 Q 194 21 194 24 L 194 26 L 68 27 Q 68 23 72 22 Z',
    ],
    vitres: [
      'M 38 62 L 44 46 Q 48 38 60 35 L 92 32 L 92 63 L 40 64 Z',
      'M 98 32 L 156 31 L 156 63 L 98 63 Z',
      'M 162 31 L 194 31 Q 206 32 215 39 L 250 64 L 162 64 Z',
    ],
    lignes: ['M 159 70 L 159 114', 'M 253 72 Q 258 92 254 114'],
    roues: [{ cx: 94, cy: 122, r: 30 }, { cx: 308, cy: 122, r: 30 }],
  },
  // Scénic / Touran : monocorps, pare-brise très avancé et incliné.
  monospace: {
    corps: [`M 26 128 Q 19 126 18 116 L 18 98 Q 18 88 21 80 L 26 46 Q 29 32 44 28 L 64 24 Q 80 22 110 22 L 172 22 Q 190 23 202 32 L 264 72 Q 272 77 290 79 L 334 85 Q 356 88 362 99 L 366 110 Q 368 123 359 128 ${arche(308, 29, 128)} ${arche(88, 29, 128)} Z`],
    vitres: [
      'M 32 64 L 37 44 Q 40 34 52 31 L 82 28 L 82 66 L 34 67 Z',
      'M 88 28 L 146 27 L 146 66 L 88 66 Z',
      'M 152 27 L 174 27 Q 188 28 198 36 L 248 69 L 152 69 Z',
    ],
    lignes: ['M 149 74 L 149 124', 'M 252 78 Q 257 101 253 124'],
    roues: [{ cx: 88, cy: 127, r: 25 }, { cx: 308, cy: 127, r: 25 }],
  },
  // 5008 / Kodiaq : 4,7 × 1,68 m, empattement 2,84 m, hayon droit.
  '7places': {
    corps: [
      `M 18 120 Q 11 118 10 108 L 10 92 Q 10 82 13 76 L 18 40 Q 21 28 34 25 L 52 21 Q 66 19 96 19 L 220 19 Q 236 20 248 28 L 284 58 Q 292 64 310 66 L 352 71 Q 376 74 382 88 L 386 100 Q 388 116 378 120 ${arche(316, 34, 120)} ${arche(89, 34, 120)} Z`,
      'M 60 16 L 214 15 Q 218 15 218 18 L 218 20 L 56 21 Q 56 17 60 16 Z',
    ],
    vitres: [
      'M 24 58 L 29 40 Q 32 31 44 29 L 74 26 L 74 59 L 26 60 Z',
      'M 80 26 L 136 25 L 136 59 L 80 59 Z',
      'M 142 25 L 192 25 L 192 59 L 142 59 Z',
      'M 198 25 L 220 25 Q 232 26 241 33 L 272 59 L 198 59 Z',
    ],
    lignes: ['M 139 65 L 139 112', 'M 195 65 L 195 112', 'M 276 68 Q 281 90 277 112'],
    roues: [{ cx: 89, cy: 122, r: 30 }, { cx: 316, cy: 122, r: 30 }],
  },
  // Trafic / Transit : caisse haute, capot court.
  utilitaire: {
    corps: [`M 20 126 Q 13 124 12 114 L 12 24 Q 12 12 26 12 L 252 11 Q 270 12 280 24 L 312 64 Q 318 71 334 73 L 362 77 Q 384 81 387 96 L 389 110 Q 390 124 380 126 ${arche(318, 31, 126)} ${arche(84, 31, 126)} Z`],
    vitres: ['M 244 20 L 252 20 Q 264 21 272 30 L 300 64 L 244 64 Z'],
    lignes: ['M 238 20 L 238 120', 'M 152 18 L 152 120', 'M 18 68 L 232 68'],
    roues: [{ cx: 84, cy: 125, r: 27 }, { cx: 318, cy: 125, r: 27 }],
  },
  // Profilé avec capucine au-dessus de la cabine.
  'camping-car': {
    corps: [`M 16 126 Q 9 124 8 114 L 8 22 Q 8 10 20 10 L 314 10 Q 338 10 342 22 L 344 33 Q 344 42 334 44 L 316 46 L 340 72 Q 346 78 362 80 L 378 84 Q 390 88 391 100 L 392 112 Q 392 124 382 126 ${arche(320, 30, 126)} ${arche(118, 30, 126)} Z`],
    vitres: [
      'M 40 34 L 96 34 Q 100 34 100 38 L 100 62 Q 100 66 96 66 L 40 66 Q 36 66 36 62 L 36 38 Q 36 34 40 34 Z',
      'M 192 34 L 240 34 Q 244 34 244 38 L 244 62 Q 244 66 240 66 L 192 66 Q 188 66 188 62 L 188 38 Q 188 34 192 34 Z',
      'M 300 50 L 316 50 L 336 72 L 300 72 Z',
      'M 302 18 L 328 18 Q 334 18 334 24 L 334 32 L 302 32 Z',
    ],
    lignes: ['M 136 30 L 136 118 M 166 30 L 166 118 M 136 30 L 166 30', 'M 12 80 L 290 80'],
    roues: [{ cx: 118, cy: 126, r: 26 }, { cx: 320, cy: 126, r: 26 }],
  },
  // Porteur avec caisse : cabine basse à l'avant, caisse haute derrière.
  camion: {
    corps: [`M 14 126 Q 8 126 8 118 L 8 18 Q 8 12 14 12 L 268 12 Q 274 12 274 18 L 274 40 L 328 40 Q 344 40 350 52 L 370 86 Q 390 90 391 104 L 392 116 Q 392 126 384 126 ${arche(330, 31, 126)} ${arche(96, 31, 126)} Z`],
    vitres: ['M 282 48 L 328 48 Q 338 48 342 56 L 356 82 L 282 82 Z'],
    lignes: ['M 274 44 L 274 122', 'M 14 100 L 268 100'],
    roues: [{ cx: 96, cy: 125, r: 27 }, { cx: 330, cy: 125, r: 27 }],
  },
  // Roadster : réservoir bombé, selle, bras oscillant, fourche.
  moto: {
    corps: [
      'M 80 70 Q 86 64 110 63 Q 140 61 166 61 Q 178 47 208 45 Q 240 44 256 54 L 270 50 L 285 40 L 292 44 L 281 56 Q 300 58 305 72 L 297 78 L 268 67 L 258 76 Q 263 92 252 104 L 236 117 Q 230 121 220 121 L 176 121 Q 164 119 160 107 L 156 85 L 116 82 Q 96 82 84 78 Z',
      'M 96 119 L 168 103 L 172 112 L 100 128 Z',
      'M 102 98 L 162 102 L 163 109 L 100 108 Q 95 103 102 98 Z',
      'M 280 98 Q 300 86 320 99 L 316 104 Q 300 94 284 103 Z',
    ],
    traits: [{ d: 'M 276 60 L 300 122', w: 8 }],
    vitres: ['M 290 62 Q 300 64 301 72 L 294 72 Q 290 68 290 62 Z'],
    roues: [{ cx: 96, cy: 122, r: 30 }, { cx: 300, cy: 122, r: 30 }],
  },
  // Vespa : coque arrière bombée, plancher, tablier avant.
  scooter: {
    corps: [
      'M 66 116 Q 60 90 86 82 L 146 77 Q 156 66 180 66 L 210 67 Q 220 69 218 79 L 214 88 Q 200 92 196 104 L 196 114 L 236 114 L 250 74 L 255 48 L 244 44 L 247 34 L 274 34 L 273 43 L 265 46 L 272 76 Q 284 88 298 102 Q 310 110 309 119 L 280 118 Q 272 108 262 108 L 250 122 L 198 124 Q 182 130 160 128 L 132 126 Q 120 114 110 114 Q 88 114 82 120 Z',
    ],
    vitres: ['M 258 52 L 266 52 L 270 72 L 262 72 Z'],
    lignes: ['M 92 98 Q 130 88 186 94'],
    roues: [{ cx: 110, cy: 132, r: 20 }, { cx: 288, cy: 132, r: 20 }],
  },
  // Vélo de ville : cadre en tubes, selle, guidon.
  velo: {
    corps: ['M 166 54 L 214 52 Q 221 52 219 58 L 214 61 L 168 62 Q 160 61 166 54 Z'],
    traits: [
      { d: 'M 112 120 L 170 64 L 262 66 L 200 120 Z', w: 7 },
      { d: 'M 190 58 L 200 120', w: 7 },
      { d: 'M 262 66 L 288 120', w: 7 },
      { d: 'M 255 48 L 262 66 M 246 45 L 268 43', w: 7 },
    ],
    roues: [{ cx: 112, cy: 120, r: 32, fin: true }, { cx: 288, cy: 120, r: 32, fin: true }],
  },
}

/** La silhouette d'un type de véhicule, ou `null` pour un type qui n'en a pas. */
export function silhouettePour(type: string | null | undefined): Silhouette | null {
  return type && Object.prototype.hasOwnProperty.call(SILHOUETTES, type) ? SILHOUETTES[type] : null
}
