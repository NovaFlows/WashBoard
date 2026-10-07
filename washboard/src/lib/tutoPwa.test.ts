import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

// Chaque test repart d'un module neuf : la mémoire de l'onglet est une variable
// de module, comme après un rechargement de page.
async function charger() {
  vi.resetModules()
  const tuto = await import('./tutoPwa')
  const { logger } = await import('./logger')
  return { ...tuto, logger }
}

function fausseSession() {
  const donnees = new Map<string, string>()
  return {
    donnees,
    getItem: (k: string) => donnees.get(k) ?? null,
    setItem: (k: string, v: string) => { donnees.set(k, v) },
    removeItem: (k: string) => { donnees.delete(k) },
  }
}

let session: ReturnType<typeof fausseSession>

beforeEach(() => {
  session = fausseSession()
  vi.stubGlobal('sessionStorage', session)
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

afterEach(() => vi.unstubAllGlobals())

describe('ETAPES_TUTO_PWA', () => {
  it('quatre arrêts, dans l’ordre et le texte validés', async () => {
    const { ETAPES_TUTO_PWA } = await charger()
    expect(ETAPES_TUTO_PWA).toHaveLength(4)
    expect(ETAPES_TUTO_PWA.map(e => e.cible)).toEqual([
      'barre-bas', 'barre-bas-nouveau', undefined, 'barre-bas-plus',
    ])
  })

  it('seul le geste retour (étape 3) n’a pas de cible à découper', async () => {
    const { ETAPES_TUTO_PWA } = await charger()
    const sansCible = ETAPES_TUTO_PWA.flatMap((e, i) => (e.cible ? [] : [i]))
    expect(sansCible).toEqual([2])
  })
})

describe('lireEtat / serialiserEtat', () => {
  it('relit ce qu’il a écrit', async () => {
    const { lireEtat, serialiserEtat } = await charger()
    for (const etat of [{ statut: 'finie' }, { statut: 'en_cours', etape: 0 }, { statut: 'en_cours', etape: 3 }] as const) {
      expect(lireEtat(serialiserEtat(etat))).toEqual(etat)
    }
    expect(serialiserEtat({ statut: 'absente' })).toBeNull()
  })

  it('une valeur abîmée ou hors bornes vaut « absente », jamais un arrêt inventé', async () => {
    const { lireEtat } = await charger()
    for (const brut of [null, '', '4', '-1', '1.5', 'abc', ' 3', 'FINIE']) {
      expect(lireEtat(brut), String(brut)).toEqual({ statut: 'absente' })
    }
  })
})

describe('etapeSuivante', () => {
  it('avance d’un arrêt, et s’arrête au quatrième', async () => {
    const { etapeSuivante } = await charger()
    expect(etapeSuivante(0)).toBe(1)
    expect(etapeSuivante(2)).toBe(3)
    expect(etapeSuivante(3)).toBeNull()
  })
})

describe('tutoAFaire', () => {
  it('à faire seulement quand sa colonne vaut NULL et la visite guidée est déjà terminée', async () => {
    const { tutoAFaire } = await charger()
    expect(tutoAFaire({ pwa_tour_complete_at: null, dashboard_tour_complete_at: '2026-10-01T08:00:00Z' })).toBe(true)
    expect(tutoAFaire({ pwa_tour_complete_at: '2026-10-06T08:00:00Z', dashboard_tour_complete_at: '2026-10-01T08:00:00Z' })).toBe(false)
    expect(tutoAFaire(null)).toBe(false)
  })

  it('visite guidée pas encore terminée : le tuto PWA attend, pour ne pas se chevaucher', async () => {
    const { tutoAFaire } = await charger()
    expect(tutoAFaire({ pwa_tour_complete_at: null, dashboard_tour_complete_at: null })).toBe(false)
    expect(tutoAFaire({ pwa_tour_complete_at: null })).toBe(false)
  })

  it('colonne absente (SQL pas encore exécuté) : jamais déclenché', async () => {
    const { tutoAFaire } = await charger()
    expect(tutoAFaire({})).toBe(false)
  })
})

describe('etatAuChargement', () => {
  const absente = { statut: 'absente' } as const
  const finie = { statut: 'finie' } as const
  const arret2 = { statut: 'en_cours', etape: 1 } as const

  it('sur /dashboard, tuto à faire : démarre à l’arrêt 1, ou reprend où il en était', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(absente, true)).toEqual({ statut: 'en_cours', etape: 0 })
    expect(etatAuChargement(arret2, true)).toEqual(arret2)
  })

  it('fini dans cet onglet : ne repart jamais, même si /dashboard (en cache) dit « à faire »', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(finie, true)).toEqual(finie)
    expect(etatAuChargement(finie, undefined)).toEqual(finie)
  })

  it('sur /dashboard, déjà fait en base : une progression restée dans l’onglet est oubliée', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(arret2, false)).toEqual(absente)
    expect(etatAuChargement(absente, false)).toEqual(absente)
  })

  it('ailleurs que sur /dashboard : l’onglet fait foi, rien ne démarre', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(absente, undefined)).toEqual(absente)
    expect(etatAuChargement(arret2, undefined)).toEqual(arret2)
  })
})

describe('mémoire de l’onglet', () => {
  it('la progression survit à un rechargement', async () => {
    const avant = await charger()
    avant.ecrireTuto({ statut: 'en_cours', etape: 2 })
    expect(session.donnees.get('wb_tuto_pwa')).toBe('2')

    const apres = await charger()
    expect(apres.lireEtat(apres.lireTuto())).toEqual({ statut: 'en_cours', etape: 2 })
  })

  it('« absente » efface la clé', async () => {
    const { ecrireTuto } = await charger()
    ecrireTuto({ statut: 'en_cours', etape: 1 })
    ecrireTuto({ statut: 'absente' })
    expect(session.donnees.has('wb_tuto_pwa')).toBe(false)
  })

  it('stockage refusé : le tuto avance quand même pendant la vie de la page', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError') },
    })
    const { ecrireTuto, lireTuto } = await charger()
    expect(lireTuto()).toBeNull()
    ecrireTuto({ statut: 'en_cours', etape: 1 })
    expect(lireTuto()).toBe('1')
  })

  it('prévient les abonnés à chaque écriture, plus après désabonnement', async () => {
    const { ecrireTuto, abonnerTuto } = await charger()
    const abonne = vi.fn()
    const desabonner = abonnerTuto(abonne)
    ecrireTuto({ statut: 'en_cours', etape: 1 })
    expect(abonne).toHaveBeenCalledTimes(1)
    desabonner()
    ecrireTuto({ statut: 'en_cours', etape: 2 })
    expect(abonne).toHaveBeenCalledTimes(1)
  })
})

describe('terminerTuto', () => {
  it('fini tout de suite, une seule requête même sur double clic', async () => {
    const { terminerTuto, lireEtat, lireTuto, ecrireTuto } = await charger()
    ecrireTuto({ statut: 'en_cours', etape: 1 })
    terminerTuto()
    terminerTuto()
    expect(lireEtat(lireTuto())).toEqual({ statut: 'finie' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/washer/tuto-pwa', { method: 'POST', keepalive: true })
  })

  it('succès : rien à tracer', async () => {
    const { terminerTuto, logger } = await charger()
    terminerTuto()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('session expirée : averti (le serveur, lui, n’a rien tracé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const { terminerTuto, logger } = await charger()
    terminerTuto()
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith('tuto_pwa.terminer.session_expiree', {}))
  })

  it('requête qui n’arrive pas : erreur tracée, le tuto reste fermé à l’écran', async () => {
    const panne = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw panne }))
    const { terminerTuto, logger, lireEtat, lireTuto } = await charger()
    terminerTuto()
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith('tuto_pwa.terminer.reseau', {}, panne))
    expect(lireEtat(lireTuto())).toEqual({ statut: 'finie' })
  })
})
