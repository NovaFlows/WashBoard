import { describe, it, expect } from 'vitest'
import { scaledDimensions, compressImage, LOGO_OPTIONS, BACKGROUND_OPTIONS } from './imageCompression'

// Le calcul des dimensions est la seule partie de ce fichier qui ne dépende
// pas du navigateur — et c'est celle qui décide du poids réel des images
// servies. Un logo de 4 Mo avait suffi à dépasser le quota de bande passante
// Supabase de 60 % (05/09) : le facteur de réduction n'est pas un détail
// cosmétique.

describe('scaledDimensions', () => {
  it('ramène le plus grand côté à la limite, en conservant les proportions', () => {
    expect(scaledDimensions(4000, 3000, 600)).toEqual({ width: 600, height: 450 })
    expect(scaledDimensions(3000, 4000, 600)).toEqual({ width: 450, height: 600 })
  })

  it('n’agrandit jamais une image déjà plus petite', () => {
    // On ne fabrique pas des pixels qui n'existent pas : agrandir alourdirait
    // le fichier sans ajouter le moindre détail.
    expect(scaledDimensions(120, 80, 600)).toEqual({ width: 120, height: 80 })
    expect(scaledDimensions(600, 600, 600)).toEqual({ width: 600, height: 600 })
  })

  it('arrondit à des pixels entiers', () => {
    const { width, height } = scaledDimensions(1001, 333, 600)
    expect(Number.isInteger(width)).toBe(true)
    expect(Number.isInteger(height)).toBe(true)
  })

  it('garde au moins un pixel sur une image très allongée', () => {
    // Une bannière de 4000 × 3 pixels : sans plancher, le petit côté
    // arrondirait à 0 et le canvas refuserait de dessiner.
    const { width, height } = scaledDimensions(4000, 3, 600)
    expect(width).toBe(600)
    expect(height).toBeGreaterThanOrEqual(1)
  })

  it('supporte une image vide sans diviser par zéro', () => {
    expect(scaledDimensions(0, 0, 600)).toEqual({ width: 0, height: 0 })
  })
})

describe('LOGO_OPTIONS et BACKGROUND_OPTIONS', () => {
  it('réduisent vraiment, et le fond reste plus grand que le logo', () => {
    expect(LOGO_OPTIONS.maxSide).toBeLessThan(BACKGROUND_OPTIONS.maxSide)
    for (const o of [LOGO_OPTIONS, BACKGROUND_OPTIONS]) {
      expect(o.quality).toBeGreaterThan(0)
      expect(o.quality).toBeLessThanOrEqual(1)
    }
  })
})

describe('compressImage', () => {
  it('rend le fichier intact hors navigateur, sans lever', () => {
    // Le reste de la fonction dépend du canvas, absent ici comme lors d'un
    // rendu serveur : elle doit rendre l'original plutôt que d'échouer.
    const fichier = new File(['x'], 'logo.png', { type: 'image/png' })
    return expect(compressImage(fichier, LOGO_OPTIONS)).resolves.toBe(fichier)
  })
})
