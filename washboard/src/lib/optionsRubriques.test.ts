import { describe, it, expect } from 'vitest'
import type { ServiceAddon } from '@/types'
import {
  DESCRIPTION_OPTION_MAX, SEUIL_OPTIONS_EN_DEPLIANTS, descriptionOptionNettoyee, enDepliants,
  optionsAvecDescriptionsNettoyees, rubriquesDesOptions,
} from './optionsRubriques'

const opt = (id: string, category: string, extra: Partial<ServiceAddon> = {}): ServiceAddon => ({ id, label: 'Option ' + id, price: 10, category, ...extra })

describe('rubriquesDesOptions', () => {
  it('groupe par rubrique dans l’ordre de saisie', () => {
    const r = rubriquesDesOptions([opt('1', 'Intérieur'), opt('2', 'Protections'), opt('3', 'Intérieur')])
    expect(r.map(x => x.nom)).toEqual(['Intérieur', 'Protections'])
    expect(r[0].options.map(o => o.id)).toEqual(['1', '3'])
  })

  it('« Intérieur », « interieur » et « Intérieur  » sont la même rubrique (orthographe de la première)', () => {
    const r = rubriquesDesOptions([opt('1', 'Intérieur'), opt('2', 'interieur'), opt('3', ' Intérieur  ')])
    expect(r).toHaveLength(1)
    expect(r[0].nom).toBe('Intérieur')
    expect(r[0].options).toHaveLength(3)
  })

  it('aucune option : aucune rubrique', () => {
    expect(rubriquesDesOptions([])).toEqual([])
  })
})

describe('enDepliants', () => {
  const nombre = (n: number, rubriques: number) =>
    rubriquesDesOptions(Array.from({ length: n }, (_, i) => opt(String(i), 'R' + (i % rubriques))))

  it('beaucoup d’options réparties en plusieurs rubriques : dépliants', () => {
    expect(enDepliants(nombre(15, 3))).toBe(true)
  })
  it('pile au seuil : la liste reste telle quelle', () => {
    expect(enDepliants(nombre(SEUIL_OPTIONS_EN_DEPLIANTS, 3))).toBe(false)
    expect(enDepliants(nombre(SEUIL_OPTIONS_EN_DEPLIANTS + 1, 3))).toBe(true)
  })
  it('une seule rubrique : jamais de dépliant, même avec 15 options', () => {
    expect(enDepliants(nombre(15, 1))).toBe(false)
  })
})

describe('descriptions', () => {
  it('nettoie, coupe et ignore le vide', () => {
    expect(descriptionOptionNettoyee('  Aspiration \n  complète ')).toBe('Aspiration complète')
    expect(descriptionOptionNettoyee('   ')).toBeUndefined()
    expect(descriptionOptionNettoyee(42)).toBeUndefined()
    expect(descriptionOptionNettoyee('a'.repeat(500))).toHaveLength(DESCRIPTION_OPTION_MAX)
  })

  it('retire le champ des options sans description, garde le reste intact', () => {
    const r = optionsAvecDescriptionsNettoyees([opt('1', 'A', { description: '  ok ' }), opt('2', 'A', { description: '   ' }), opt('3', 'A')])
    expect(r[0].description).toBe('ok')
    expect('description' in r[1]).toBe(false)
    expect(r[2]).toEqual(opt('3', 'A'))
  })
})
