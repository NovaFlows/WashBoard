// Lecture du fuseau d'un laveur en base : seulement l'adresse et le téléphone,
// et Paris dès que quelque chose ne va pas.
import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lireFuseauLaveur, lireFuseauxLaveurs, fuseauDans } from './fuseauLaveur'

type Appel = { table: string; colonnes?: string; filtres: [string, unknown][] }

function faux(reponse: { data?: unknown; error?: unknown } | 'jette') {
  const appels: Appel[] = []
  const client = {
    from: (table: string) => {
      const appel: Appel = { table, filtres: [] }
      appels.push(appel)
      const fin = () => (reponse === 'jette' ? Promise.reject(new Error('réseau')) : Promise.resolve(reponse))
      const b: Record<string, unknown> = {
        select: (c: string) => { appel.colonnes = c; return b },
        eq: (c: string, v: unknown) => { appel.filtres.push([c, v]); return b },
        in: (c: string, v: unknown) => { appel.filtres.push([c, v]); return b },
        maybeSingle: fin,
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => fin().then(ok, ko),
      }
      return b
    },
  }
  return { client: client as unknown as SupabaseClient, appels }
}

describe('lireFuseauLaveur', () => {
  it('lit l’adresse et le téléphone du bon laveur, et en déduit le fuseau', async () => {
    const { client, appels } = faux({ data: { base_address: '97300 Cayenne', phone: '0612345678' }, error: null })
    expect(await lireFuseauLaveur(client, 'w1')).toBe('America/Cayenne')
    expect(appels).toEqual([{ table: 'washers', colonnes: 'base_address, phone', filtres: [['id', 'w1']] }])
  })

  it('le téléphone seul suffit', async () => {
    const { client } = faux({ data: { base_address: null, phone: '0692123456' }, error: null })
    expect(await lireFuseauLaveur(client, 'w1')).toBe('Indian/Reunion')
  })

  it('Paris pour un laveur de métropole', async () => {
    const { client } = faux({ data: { base_address: '52 Rue d’Enghien 95600 Eaubonne', phone: '0612345678' }, error: null })
    expect(await lireFuseauLaveur(client, 'w1')).toBe('Europe/Paris')
  })

  it('Paris si le laveur est introuvable, si la lecture échoue ou si la requête plante', async () => {
    expect(await lireFuseauLaveur(faux({ data: null, error: null }).client, 'w1')).toBe('Europe/Paris')
    expect(await lireFuseauLaveur(faux({ data: null, error: { message: 'permission denied' } }).client, 'w1')).toBe('Europe/Paris')
    expect(await lireFuseauLaveur(faux('jette').client, 'w1')).toBe('Europe/Paris')
  })
})

describe('lireFuseauxLaveurs (crons)', () => {
  it('un fuseau par laveur, en une seule lecture, sans doublon d’identifiant', async () => {
    const { client, appels } = faux({ data: [
      { id: 'a', base_address: '97300 Cayenne', phone: null },
      { id: 'b', base_address: '75011 Paris', phone: '0612345678' },
      { id: 'c', base_address: null, phone: '0696123456' },
    ], error: null })
    const m = await lireFuseauxLaveurs(client, ['a', 'b', 'a', 'c', ''])
    expect(appels).toHaveLength(1)
    expect(appels[0]).toEqual({ table: 'washers', colonnes: 'id, base_address, phone', filtres: [['id', ['a', 'b', 'c']]] })
    expect(fuseauDans(m, 'a')).toBe('America/Cayenne')
    expect(fuseauDans(m, 'b')).toBe('Europe/Paris')
    expect(fuseauDans(m, 'c')).toBe('America/Martinique')
    expect(fuseauDans(m, 'inconnu')).toBe('Europe/Paris')
    expect(fuseauDans(m, null)).toBe('Europe/Paris')
  })

  it('aucune lecture sans identifiant', async () => {
    const { client, appels } = faux({ data: [], error: null })
    expect((await lireFuseauxLaveurs(client, [])).size).toBe(0)
    expect(appels).toHaveLength(0)
  })

  it('en cas d’échec, tout le monde à Paris', async () => {
    expect(fuseauDans(await lireFuseauxLaveurs(faux({ data: null, error: { message: 'x' } }).client, ['a']), 'a')).toBe('Europe/Paris')
    expect(fuseauDans(await lireFuseauxLaveurs(faux('jette').client, ['a']), 'a')).toBe('Europe/Paris')
  })
})
