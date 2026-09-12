import { describe, it, expect } from 'vitest'
import { toutesLesLignes } from './toutesLesLignes'

/** Une fausse table de `total` lignes, servie par tranches comme `.range()`. */
function table(total: number, echecALaPage?: number) {
  const appels: [number, number][] = []
  const lirePage = async (debut: number, fin: number) => {
    appels.push([debut, fin])
    if (echecALaPage !== undefined && appels.length === echecALaPage) {
      return { data: null, error: { message: 'panne' } }
    }
    const lignes = Array.from({ length: Math.max(0, Math.min(total, fin + 1) - debut) }, (_, i) => debut + i)
    return { data: lignes, error: null }
  }
  return { lirePage, appels }
}

describe('toutesLesLignes', () => {
  it('lit TOUTES les lignes au-delà d’une page — le cas du CRM tronqué à 1 000', async () => {
    const { lirePage, appels } = table(25)
    const r = await toutesLesLignes(lirePage, 10)
    expect(r.data).toHaveLength(25)
    expect(r.data.at(-1)).toBe(24)
    expect(appels).toEqual([[0, 9], [10, 19], [20, 29]])
    expect(r.tronque).toBe(false)
  })

  it('lit une page de plus quand le total tombe pile sur un multiple', async () => {
    const { lirePage, appels } = table(20)
    const r = await toutesLesLignes(lirePage, 10)
    expect(r.data).toHaveLength(20)
    expect(appels).toHaveLength(3)
  })

  it('rend une table vide sans erreur', async () => {
    const r = await toutesLesLignes(table(0).lirePage, 10)
    expect(r).toEqual({ data: [], error: null, tronque: false })
  })

  it('signale une panne en cours de lecture, sans perdre les pages déjà lues', async () => {
    const r = await toutesLesLignes(table(25, 2).lirePage, 10)
    expect(r.data).toHaveLength(10)
    expect(r.error).toEqual({ message: 'panne' })
    expect(r.tronque).toBe(true)
  })
})
