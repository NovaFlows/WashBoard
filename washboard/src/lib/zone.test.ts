import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verdictZone } from './zone'
import type { ZoneConfig } from '@/types'

const CLE = 'cle-google-test'

/** Remplace fetch par une file de réponses JSON, consommées dans l'ordre. */
function fauxFetch(...reponses: unknown[]) {
  const file = [...reponses]
  const spy = vi.fn(async () => {
    const suivante = file.shift()
    if (suivante instanceof Error) throw suivante
    return { json: async () => suivante } as unknown as Response
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('verdictZone — cas où l\'on ne vérifie rien', () => {
  it('laisse passer si la zone n\'est pas activée', async () => {
    const appels = fauxFetch()
    expect(await verdictZone({ enabled: false }, '12 rue de Paris', CLE)).toEqual({ allowed: true })
    expect(await verdictZone(null, '12 rue de Paris', CLE)).toEqual({ allowed: true })
    expect(appels).not.toHaveBeenCalled()
  })

  it('laisse passer si l\'adresse est vide', async () => {
    const config: ZoneConfig = { enabled: true, type: 'road', center_address: 'Auxerre', radius_km: 30 }
    expect(await verdictZone(config, '   ', CLE)).toEqual({ allowed: true })
  })

  it('laisse passer sans clé Google plutôt que de refuser un client', async () => {
    const config: ZoneConfig = { enabled: true, type: 'road', center_address: 'Auxerre', radius_km: 30 }
    expect(await verdictZone(config, '12 rue de Paris', null)).toEqual({ allowed: true })
  })
})

describe('verdictZone — rayon routier', () => {
  const config: ZoneConfig = { enabled: true, type: 'road', center_address: 'Auxerre', radius_km: 30 }
  const distance = (m: number) => ({ rows: [{ elements: [{ status: 'OK', distance: { value: m } }] }] })

  it('accepte une adresse dans le rayon', async () => {
    fauxFetch(distance(12_000))
    expect(await verdictZone(config, '12 rue de Paris', CLE))
      .toEqual({ allowed: true, distance_km: 12, radius_km: 30 })
  })

  it('refuse une adresse hors rayon', async () => {
    // Le cas visé : 400 km, accepté auparavant par un appel direct à l'API.
    fauxFetch(distance(400_000))
    expect(await verdictZone(config, 'Marseille', CLE))
      .toEqual({ allowed: false, distance_km: 400, radius_km: 30 })
  })

  it('accepte pile à la limite', async () => {
    fauxFetch(distance(30_000))
    expect((await verdictZone(config, 'Ailleurs', CLE)).allowed).toBe(true)
  })

  it('laisse passer si Google ne reconnaît pas l\'adresse', async () => {
    fauxFetch({ rows: [{ elements: [{ status: 'NOT_FOUND' }] }] })
    expect(await verdictZone(config, 'zzz', CLE)).toEqual({ allowed: true })
  })

  it('laisse passer si Google est en panne', async () => {
    fauxFetch(new Error('réseau coupé'))
    expect(await verdictZone(config, 'Marseille', CLE)).toEqual({ allowed: true })
  })
})

describe('verdictZone — rayon à vol d\'oiseau', () => {
  const AUXERRE = { lat: 47.7982, lng: 3.5731 }
  const base: ZoneConfig = {
    enabled: true, type: 'crow', center_address: 'Auxerre', radius_km: 30,
    center_lat: AUXERRE.lat, center_lng: AUXERRE.lng,
  }
  const geocode = (lat: number, lng: number) => ({ results: [{ geometry: { location: { lat, lng } } }] })

  it('accepte une adresse proche', async () => {
    fauxFetch(geocode(47.81, 3.58))
    const v = await verdictZone(base, 'Auxerre centre', CLE)
    expect(v.allowed).toBe(true)
    expect(v.distance_km).toBeLessThan(5)
  })

  it('refuse une adresse lointaine', async () => {
    fauxFetch(geocode(43.2965, 5.3698)) // Marseille
    const v = await verdictZone(base, 'Marseille', CLE)
    expect(v.allowed).toBe(false)
    expect(v.distance_km).toBeGreaterThan(400)
  })

  it('géocode le centre à la volée quand ses coordonnées manquent', async () => {
    // Cas réel : le géocodage a échoué à l'enregistrement des réglages.
    const config: ZoneConfig = { enabled: true, type: 'crow', center_address: 'Auxerre', radius_km: 30 }
    const appels = fauxFetch(geocode(AUXERRE.lat, AUXERRE.lng), geocode(43.2965, 5.3698))
    expect((await verdictZone(config, 'Marseille', CLE)).allowed).toBe(false)
    expect(appels).toHaveBeenCalledTimes(2)
  })

  it('laisse passer si le centre reste introuvable', async () => {
    const config: ZoneConfig = { enabled: true, type: 'crow', center_address: 'zzz', radius_km: 30 }
    fauxFetch({ results: [] })
    expect(await verdictZone(config, 'Marseille', CLE)).toEqual({ allowed: true })
  })

  it('laisse passer si l\'adresse du client reste introuvable', async () => {
    fauxFetch({ results: [] })
    expect(await verdictZone(base, 'zzz', CLE)).toEqual({ allowed: true })
  })
})

describe('verdictZone — départements', () => {
  const config: ZoneConfig = { enabled: true, type: 'departments', departments: ['89', '21'] }
  const gouv = (context: string) => ({ features: [{ properties: { context } }] })

  it('accepte un département desservi', async () => {
    fauxFetch(gouv('89, Yonne, Bourgogne-Franche-Comté'))
    expect(await verdictZone(config, '3 rue Colbert 89000 Auxerre', CLE))
      .toEqual({ allowed: true, department: '89', department_name: 'Yonne' })
  })

  it('refuse un département non desservi', async () => {
    fauxFetch(gouv('13, Bouches-du-Rhône, PACA'))
    expect((await verdictZone(config, '1 rue X 13001 Marseille', CLE)).allowed).toBe(false)
  })

  it('laisse passer une adresse sans code postal : rien à vérifier', async () => {
    const appels = fauxFetch()
    expect(await verdictZone(config, 'chez Paul', CLE)).toEqual({ allowed: true })
    expect(appels).not.toHaveBeenCalled()
  })

  it('retombe sur le code postal quand l\'API gouvernementale ne répond pas', async () => {
    // Auparavant on laissait simplement passer, ce qui vidait la zone
    // « départements » de son sens dès que ce service toussait.
    fauxFetch({ features: [] })
    expect((await verdictZone(config, '1 rue X 13001 Marseille', CLE)).allowed).toBe(false)
    fauxFetch({ features: [] })
    expect((await verdictZone(config, '3 rue Colbert 89000 Auxerre', CLE)).allowed).toBe(true)
  })

  it('retombe aussi sur le code postal si le service plante', async () => {
    fauxFetch(new Error('api-adresse HS'))
    // Une exception rend la main au filet général : on laisse passer.
    expect(await verdictZone(config, '1 rue X 13001 Marseille', CLE)).toEqual({ allowed: true })
  })

  it('gère la Corse, dont le département ne se déduit pas des deux premiers chiffres', async () => {
    const corse: ZoneConfig = { enabled: true, type: 'departments', departments: ['2A'] }
    fauxFetch({ features: [] })
    expect((await verdictZone(corse, '1 rue X 20000 Ajaccio', CLE)).allowed).toBe(true)
  })
})
