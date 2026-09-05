import { describe, it, expect } from 'vitest'
import { scaledDimensions, LOGO_OPTIONS, BACKGROUND_OPTIONS } from './imageCompression'

// Le calcul des dimensions est la partie qui décide du poids final : c'est lui
// qui a fait dépasser le quota de bande passante quand il n'existait pas.

describe('scaledDimensions', () => {
  it('réduit une image trop grande en gardant ses proportions', () => {
    const r = scaledDimensions(4000, 3000, 600)
    expect(r.width).toBe(600)
    expect(r.height).toBe(450)
    expect(r.width / r.height).toBeCloseTo(4000 / 3000, 2)
  })

  it('réduit d’après le côté le plus long, pas la largeur', () => {
    // Une image en hauteur doit être bornée par sa hauteur, sinon elle reste
    // énorme malgré la « réduction ».
    const r = scaledDimensions(1000, 4000, 600)
    expect(r.height).toBe(600)
    expect(r.width).toBe(150)
  })

  it('n’agrandit jamais une image déjà petite', () => {
    // On ne fabrique pas des pixels qui n'existent pas : ça alourdirait le
    // fichier sans rien améliorer.
    const r = scaledDimensions(120, 80, 600)
    expect(r).toEqual({ width: 120, height: 80 })
  })

  it('laisse intacte une image pile à la limite', () => {
    expect(scaledDimensions(600, 400, 600)).toEqual({ width: 600, height: 400 })
  })

  it('ne descend jamais en dessous d’un pixel', () => {
    // Une bannière très allongée pourrait sinon donner une hauteur de 0, et le
    // canvas refuserait de dessiner.
    const r = scaledDimensions(10000, 5, 600)
    expect(r.height).toBeGreaterThanOrEqual(1)
    expect(r.width).toBe(600)
  })

  it('survit à des dimensions nulles', () => {
    expect(scaledDimensions(0, 0, 600)).toEqual({ width: 0, height: 0 })
  })

  it('renvoie des entiers, seuls acceptés par le canvas', () => {
    const r = scaledDimensions(1333, 777, 600)
    expect(Number.isInteger(r.width)).toBe(true)
    expect(Number.isInteger(r.height)).toBe(true)
  })
})

describe('réglages', () => {
  it('borne le logo bien en dessous du fond d’écran', () => {
    // Un logo s'affiche sur ~200 points ; un fond occupe tout l'écran.
    expect(LOGO_OPTIONS.maxSide).toBeLessThan(BACKGROUND_OPTIONS.maxSide)
  })

  it('garde une qualité élevée sur le logo', () => {
    // C'est l'identité visuelle du laveur : on compresse la taille, pas le
    // rendu.
    expect(LOGO_OPTIONS.quality).toBeGreaterThanOrEqual(0.85)
  })

  it('produit un format moderne et léger', () => {
    expect(LOGO_OPTIONS.type).toBe('image/webp')
    expect(BACKGROUND_OPTIONS.type).toBe('image/webp')
  })
})
