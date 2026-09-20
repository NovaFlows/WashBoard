import { describe, it, expect } from 'vitest'
import {
  estUnGlissementDArchivage,
  SEUIL_GLISSEMENT_ARCHIVAGE_PX,
  SEUIL_VITESSE_ARCHIVAGE_PX_S,
} from './supportArchive'

describe('estUnGlissementDArchivage', () => {
  it('un glissement court, relâché doucement, ne vaut pas archivage', () => {
    expect(estUnGlissementDArchivage(-20, 0)).toBe(false)
  })

  it('un glissement qui atteint le seuil de distance vaut archivage, même relâché sans vitesse', () => {
    expect(estUnGlissementDArchivage(SEUIL_GLISSEMENT_ARCHIVAGE_PX, 0)).toBe(true)
    expect(estUnGlissementDArchivage(SEUIL_GLISSEMENT_ARCHIVAGE_PX - 10, 0)).toBe(true)
  })

  it('juste en dessous du seuil de distance, sans vitesse : pas d’archivage', () => {
    expect(estUnGlissementDArchivage(SEUIL_GLISSEMENT_ARCHIVAGE_PX + 1, 0)).toBe(false)
  })

  it('un flick rapide déclenche l’archivage même sans avoir atteint le seuil de distance', () => {
    expect(estUnGlissementDArchivage(-15, SEUIL_VITESSE_ARCHIVAGE_PX_S)).toBe(true)
    expect(estUnGlissementDArchivage(-15, SEUIL_VITESSE_ARCHIVAGE_PX_S - 100)).toBe(true)
  })

  it('une vitesse rapide sans mouvement perceptible ne suffit pas (tremblement/tap nerveux)', () => {
    expect(estUnGlissementDArchivage(-2, SEUIL_VITESSE_ARCHIVAGE_PX_S)).toBe(false)
  })

  it('un glissement vers la droite ne déclenche jamais l’archivage, même vite', () => {
    expect(estUnGlissementDArchivage(40, -900)).toBe(false)
  })

  it('à distance et vitesse nulles : pas d’archivage', () => {
    expect(estUnGlissementDArchivage(0, 0)).toBe(false)
  })
})
