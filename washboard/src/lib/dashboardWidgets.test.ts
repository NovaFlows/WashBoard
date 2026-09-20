import { describe, it, expect } from 'vitest'
import { widgetsVisibles, widgetsValides, WIDGETS } from './dashboardWidgets'

describe('widgetsVisibles', () => {
  it('affiche tout par défaut : un compte jamais personnalisé ne doit pas paraître amputé', () => {
    const tout = new Set(WIDGETS.map(w => w.key))
    expect(widgetsVisibles(null)).toEqual(tout)
    expect(widgetsVisibles(undefined)).toEqual(tout)
  })

  it('ne garde que ce qui est explicitement listé', () => {
    expect(widgetsVisibles(['stats'])).toEqual(new Set(['stats']))
    expect(widgetsVisibles([])).toEqual(new Set())
  })

  it('écarte une clé inconnue sans faire échouer les autres', () => {
    // Une ancienne version du client, ou une base modifiée à la main.
    expect(widgetsVisibles(['stats', 'gadget-disparu'])).toEqual(new Set(['stats']))
  })
})

describe('widgetsValides', () => {
  it('dédoublonne et écarte ce qui n’est pas une clé connue', () => {
    expect(widgetsValides(['stats', 'stats', 'clients', 'inconnu', 42, null])).toEqual(['stats', 'clients'])
  })

  it('rend une liste vide pour tout ce qui n’est pas un tableau', () => {
    expect(widgetsValides(null)).toEqual([])
    expect(widgetsValides('stats')).toEqual([])
    expect(widgetsValides(undefined)).toEqual([])
  })
})
