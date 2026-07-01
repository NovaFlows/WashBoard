import { describe, it, expect } from 'vitest'
import { getBgStyle, isCustomTheme, BG_THEME_PRESETS } from './themes'

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
