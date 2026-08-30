import { describe, it, expect } from 'vitest'
import { haversineKm } from './geo'

describe('haversineKm', () => {
  it('retourne 0 pour deux points identiques', () => {
    expect(haversineKm(48.8566, 2.3522, 48.8566, 2.3522)).toBeCloseTo(0)
  })
  it('calcule la distance Paris → Lyon (~392 km)', () => {
    const dist = haversineKm(48.8566, 2.3522, 45.7640, 4.8357)
    expect(dist).toBeGreaterThan(380)
    expect(dist).toBeLessThan(400)
  })
  it('est symétrique', () => {
    const ab = haversineKm(48.8566, 2.3522, 43.2965, 5.3698)
    const ba = haversineKm(43.2965, 5.3698, 48.8566, 2.3522)
    expect(ab).toBeCloseTo(ba, 5)
  })
})

// Cette distance décide si un client est DANS la zone d'intervention du
// laveur : une erreur refuse un vrai client ou en accepte un hors zone.
// Elle est aussi utilisée par /api/zone/check, qui en avait sa propre copie
// jusqu'au 2026-08-30 — deux implémentations d'une règle d'autorisation, avec
// le risque qu'elles divergent sans que personne ne le voie.
describe('haversineKm — cas qui comptent pour la zone d’intervention', () => {
  it('mesure correctement une courte distance intra-urbaine', () => {
    // Notre-Dame → Tour Eiffel : ~4 km. C'est l'ordre de grandeur réel d'un
    // rayon d'intervention en ville, là où la précision compte le plus.
    const d = haversineKm(48.8530, 2.3499, 48.8584, 2.2945)
    expect(d).toBeGreaterThan(3.5)
    expect(d).toBeLessThan(4.5)
  })

  it('reste correct de part et d’autre du méridien de Greenwich', () => {
    // Longitudes de signes opposés : une erreur de signe passerait inaperçue
    // partout en France sauf ici.
    const d = haversineKm(48.86, -0.5, 48.86, 0.5)
    expect(d).toBeGreaterThan(60)
    expect(d).toBeLessThan(90)
  })

  it('calcule un écart d’un degré de latitude à ~111 km', () => {
    // Valeur de référence géodésique : un degré de latitude vaut ~111 km
    // partout sur le globe.
    expect(haversineKm(48, 2, 49, 2)).toBeCloseTo(111.2, 0)
  })

  it('un degré de longitude vaut moins qu’un degré de latitude sous nos latitudes', () => {
    // À 48° N, un degré de longitude vaut ~74 km : si la formule oubliait le
    // cosinus de la latitude, les deux seraient égaux et la zone serait
    // étirée d'est en ouest.
    const lat = haversineKm(48, 2, 49, 2)
    const lng = haversineKm(48, 2, 48, 3)
    expect(lng).toBeLessThan(lat)
    expect(lng).toBeCloseTo(74.4, 0)
  })

  it('gère une très petite distance sans renvoyer NaN', () => {
    // Deux adresses voisines : l'arc-tangente peut produire NaN si la formule
    // est mal écrite, ce qui ferait échouer toute comparaison de rayon.
    const d = haversineKm(48.8566, 2.3522, 48.8567, 2.3523)
    expect(Number.isNaN(d)).toBe(false)
    expect(d).toBeGreaterThan(0)
    expect(d).toBeLessThan(0.05)
  })
})
