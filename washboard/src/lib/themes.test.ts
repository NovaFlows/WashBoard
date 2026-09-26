import { describe, it, expect } from 'vitest'
import { getBgStyle, isCustomTheme, BG_THEME_PRESETS, PALETTE } from './themes'

describe('getBgStyle', () => {
  it('null/undefined/vide → null', () => {
    expect(getBgStyle(null)).toBeNull()
    expect(getBgStyle(undefined)).toBeNull()
    expect(getBgStyle('')).toBeNull()
  })

  it('preset dégradé → background gradient', () => {
    const style = getBgStyle('theme1')
    expect(style).not.toBeNull()
    expect(style!.background).toContain('linear-gradient')
    expect(style!.backgroundImage).toBeUndefined()
  })

  it('preset photo → backgroundImage avec overlay + url + cover', () => {
    const style = getBgStyle('photo1')
    expect(style!.backgroundImage).toContain('url(')
    expect(style!.backgroundImage).toContain('linear-gradient') // overlay de lisibilité
    expect(style!.backgroundSize).toBe('cover')
    expect(style!.backgroundPosition).toBe('center')
  })

  it('URL personnalisée (http) → backgroundImage avec cette url', () => {
    const url = 'https://cdn.exemple.fr/mon-fond.jpg'
    const style = getBgStyle(url)
    expect(style!.backgroundImage).toContain(url)
    expect(style!.backgroundSize).toBe('cover')
  })

  it('valeur inconnue non-http → null', () => {
    expect(getBgStyle('theme-inexistant')).toBeNull()
  })
})

describe('isCustomTheme', () => {
  it('false pour null et pour un preset', () => {
    expect(isCustomTheme(null)).toBe(false)
    expect(isCustomTheme('theme1')).toBe(false)
    expect(isCustomTheme('photo3')).toBe(false)
  })
  it('true pour une URL ou un id hors presets', () => {
    expect(isCustomTheme('https://cdn.exemple.fr/x.jpg')).toBe(true)
    expect(isCustomTheme('autre')).toBe(true)
  })
})

describe('BG_THEME_PRESETS (données)', () => {
  it('chaque preset a un id, un nom et un dégradé de fallback', () => {
    for (const p of BG_THEME_PRESETS) {
      expect(p.id).toBeTruthy()
      expect(p.name).toBeTruthy()
      expect(p.gradient).toContain('linear-gradient')
    }
  })
  it('ids uniques', () => {
    const ids = BG_THEME_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('PALETTE (couleurs de marque)', () => {
  // Liste recopiée de l'ancien IdentiteForm (commit 59ac1d7) : l'ordre est celui
  // que voit le laveur, et ces 24 valeurs sont celles déjà enregistrées en base.
  it('les 24 couleurs, dans l’ordre exact de l’ancien écran', () => {
    expect(PALETTE).toEqual([
      '#1e3a8a', '#1d4ed8', '#2563eb', '#0ea5e9',
      '#0891b2', '#0284c7', '#0369a1',
      '#15803d', '#16a34a', '#059669', '#0d9488',
      '#6d28d9', '#7c3aed', '#9333ea',
      '#dc2626', '#e11d48', '#db2777', '#c026d3',
      '#c2410c', '#ea580c', '#d97706',
      '#0f172a', '#1e293b', '#374151',
    ])
    expect(PALETTE).toHaveLength(24)
  })
  it('des hex #rrggbb en minuscules, sans doublon', () => {
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    expect(new Set(PALETTE).size).toBe(PALETTE.length)
  })
})
