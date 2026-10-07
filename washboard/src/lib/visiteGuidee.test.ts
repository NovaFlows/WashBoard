import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { requiredPlanLabel } from './plan'

vi.mock('./logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

// Chaque test repart d'un module neuf : la mémoire de l'onglet est une variable
// de module, comme après un rechargement de page.
async function charger() {
  vi.resetModules()
  const visite = await import('./visiteGuidee')
  const { logger } = await import('./logger')
  return { ...visite, logger }
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

describe('etapesPour', () => {
  it('site : exactement les onze arrêts « page » d’avant, dans le même ordre', async () => {
    const { etapesPour } = await charger()
    expect(etapesPour(false).map(e => e.route)).toEqual([
      '/dashboard',
      '/dashboard/parametres#lien-reservation',
      '/dashboard/parametres/prestations',
      '/dashboard/parametres/horaires',
      '/dashboard/calendrier',
      '/dashboard/clients',
      '/dashboard/crm',
      '/dashboard/compta',
      '/dashboard/factures',
      '/dashboard/abonnement',
      '/dashboard/guide',
    ])
    expect(etapesPour(false).map(e => e.texte)).toEqual([
      "Voilà ton tableau de bord : tes rendez-vous du jour et ceux à venir, en un coup d'œil.",
      "Le lien à donner à tes clients — celui que tu as choisi à l'inscription.",
      "Ce que tu vends : nom, prix, durée. Ta page reste vide tant que tu n'en as pas créé une.",
      'Tes dispos et tes congés : ça décide des créneaux que voient tes clients.',
      'Toute ton activité en vue mois/semaine/jour.',
      "Chaque client qui a réservé, avec son historique et son chiffre d'affaires.",
      `D'où viennent tes visiteurs et combien réservent vraiment — en formule ${requiredPlanLabel('crm')}.`,
      `Ton chiffre d'affaires et tes dépenses, par jour, semaine, mois ou année — en formule ${requiredPlanLabel('compta')}.`,
      `Facture conforme générée et envoyée automatiquement à chaque prestation terminée — en formule ${requiredPlanLabel('facturation')}.`,
      "Ici tu changes d'offre quand tu en as besoin.",
      "Si tu bloques un jour : le Guide répond seul, l'Assistance contacte l'équipe.",
    ])
  })

  it('aucun arrêt « pwaSeulement » ne fuite dans la liste du site', async () => {
    const { etapesPour } = await charger()
    expect(etapesPour(false).some(e => e.pwaSeulement)).toBe(false)
  })

  it('application installée : les arrêts PWA s’intercalent, sans déplacer les arrêts du site', async () => {
    const { etapesPour } = await charger()
    const pwa = etapesPour(true)
    const site = etapesPour(false)
    // Les arrêts « page » (avec route) se retrouvent dans le même ordre relatif.
    expect(pwa.filter(e => e.route).map(e => e.route)).toEqual(site.map(e => e.route))
    // Strictement plus d'arrêts côté PWA : les repères de la barre du bas en plus.
    expect(pwa.length).toBeGreaterThan(site.length)
  })

  it('chaque arrêt PWA sans route vise un élément de la barre du bas ou n’a aucune cible', async () => {
    const { etapesPour } = await charger()
    const pwaSansRoute = etapesPour(true).filter(e => e.pwaSeulement && !e.route)
    expect(pwaSansRoute.length).toBeGreaterThan(0)
    for (const e of pwaSansRoute) {
      if (e.cible) expect(e.cible).toMatch(/^barre-bas/)
    }
  })

  it('chaque arrêt « page » pointe vers une page qui existe', async () => {
    const { etapesPour } = await charger()
    for (const { route } of etapesPour(true)) {
      if (!route) continue
      const chemin = route.split('#')[0]
      expect(existsSync(join(__dirname, '..', 'app', '(dashboard)', chemin, 'page.tsx')), route).toBe(true)
    }
  })

  it('seuls Prestations, Horaires et Lien mettent en évidence un élément de PAGE (hors barre du bas)', async () => {
    const { etapesPour } = await charger()
    const ciblesDePage = etapesPour(false).flatMap(e => (e.cible ? [e.cible] : []))
    expect(ciblesDePage).toEqual(['lien', 'prestations', 'horaires'])
  })
})

describe('lireEtat / serialiserEtat', () => {
  it('relit ce qu’il a écrit', async () => {
    const { lireEtat, serialiserEtat, ETAPES_VISITE } = await charger()
    for (const etat of [{ statut: 'finie' }, { statut: 'en_cours', etape: 0 }, { statut: 'en_cours', etape: 10 }] as const) {
      expect(lireEtat(serialiserEtat(etat), ETAPES_VISITE.length)).toEqual(etat)
    }
    expect(serialiserEtat({ statut: 'absente' })).toBeNull()
  })

  it('une valeur abîmée ou hors bornes vaut « absente », jamais un arrêt inventé', async () => {
    const { lireEtat } = await charger()
    for (const brut of [null, '', '18', '-1', '1.5', 'abc', ' 3', 'FINIE']) {
      expect(lireEtat(brut, 11), String(brut)).toEqual({ statut: 'absente' })
    }
  })
})

describe('etapeSuivante', () => {
  it('avance d’un arrêt, et s’arrête au dernier d’une liste donnée', async () => {
    const { etapeSuivante } = await charger()
    expect(etapeSuivante(0, 11)).toBe(1)
    expect(etapeSuivante(9, 11)).toBe(10)
    expect(etapeSuivante(10, 11)).toBeNull()
  })
})

describe('visiteAFaire', () => {
  it('à faire seulement quand la colonne existe et vaut NULL', async () => {
    const { visiteAFaire } = await charger()
    expect(visiteAFaire({ dashboard_tour_complete_at: null })).toBe(true)
    expect(visiteAFaire({ dashboard_tour_complete_at: '2026-10-01T08:00:00Z' })).toBe(false)
    expect(visiteAFaire(null)).toBe(false)
  })

  it('colonne absente (SQL pas encore exécuté) : jamais déclenchée', async () => {
    const { visiteAFaire } = await charger()
    expect(visiteAFaire({})).toBe(false)
  })
})

describe('etatAuChargement', () => {
  const absente = { statut: 'absente' } as const
  const finie = { statut: 'finie' } as const
  const arret5 = { statut: 'en_cours', etape: 4 } as const

  it('sur /dashboard, visite à faire : démarre à l’arrêt 1, ou reprend où elle en était', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(absente, true)).toEqual({ statut: 'en_cours', etape: 0 })
    expect(etatAuChargement(arret5, true)).toEqual(arret5)
  })

  it('finie dans cet onglet : ne repart jamais, même si /dashboard (en cache) dit « à faire »', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(finie, true)).toEqual(finie)
    expect(etatAuChargement(finie, undefined)).toEqual(finie)
  })

  it('sur /dashboard, déjà faite en base : une progression restée dans l’onglet est oubliée', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(arret5, false)).toEqual(absente)
    expect(etatAuChargement(absente, false)).toEqual(absente)
  })

  it('ailleurs que sur /dashboard : l’onglet fait foi, rien ne démarre', async () => {
    const { etatAuChargement } = await charger()
    expect(etatAuChargement(absente, undefined)).toEqual(absente)
    expect(etatAuChargement(arret5, undefined)).toEqual(arret5)
  })
})

describe('mémoire de l’onglet', () => {
  it('la progression survit à un rechargement', async () => {
    const avant = await charger()
    avant.ecrireVisite({ statut: 'en_cours', etape: 6 })
    expect(session.donnees.get('wb_visite_guidee')).toBe('6')

    const apres = await charger()
    const { ETAPES_VISITE } = apres
    expect(apres.lireEtat(apres.lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'en_cours', etape: 6 })
  })

  it('« absente » efface la clé', async () => {
    const { ecrireVisite } = await charger()
    ecrireVisite({ statut: 'en_cours', etape: 2 })
    ecrireVisite({ statut: 'absente' })
    expect(session.donnees.has('wb_visite_guidee')).toBe(false)
  })

  it('stockage refusé : la visite avance quand même pendant la vie de la page', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('SecurityError') },
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => { throw new Error('SecurityError') },
    })
    const { ecrireVisite, lireVisite } = await charger()
    expect(lireVisite()).toBeNull()
    ecrireVisite({ statut: 'en_cours', etape: 3 })
    expect(lireVisite()).toBe('3')
  })

  it('prévient les abonnés à chaque écriture, plus après désabonnement', async () => {
    const { ecrireVisite, abonnerVisite } = await charger()
    const abonne = vi.fn()
    const desabonner = abonnerVisite(abonne)
    ecrireVisite({ statut: 'en_cours', etape: 1 })
    expect(abonne).toHaveBeenCalledTimes(1)
    desabonner()
    ecrireVisite({ statut: 'en_cours', etape: 2 })
    expect(abonne).toHaveBeenCalledTimes(1)
  })
})

describe('fermerPourLInstant', () => {
  it('ferme sans marquer terminé : ni « finie », ni appel réseau', async () => {
    const { fermerPourLInstant, ecrireVisite, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'en_cours', etape: 3 })
    fermerPourLInstant()
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'absente' })
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('terminerVisite', () => {
  it('finie tout de suite, une seule requête même sur double clic', async () => {
    const { terminerVisite, lireEtat, lireVisite, ecrireVisite, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'en_cours', etape: 3 })
    terminerVisite()
    terminerVisite()
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'finie' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/washer/visite-guidee', { method: 'POST', keepalive: true })
  })

  it('succès : rien à tracer', async () => {
    const { terminerVisite, logger } = await charger()
    terminerVisite()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 0))
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('session expirée : averti (le serveur, lui, n’a rien tracé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const { terminerVisite, logger } = await charger()
    terminerVisite()
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith('visite_guidee.terminer.session_expiree', {}))
  })

  it('requête qui n’arrive pas : erreur tracée, la visite reste fermée à l’écran', async () => {
    const panne = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw panne }))
    const { terminerVisite, logger, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    terminerVisite()
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith('visite_guidee.terminer.reseau', {}, panne))
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'finie' })
  })
})

describe('redemarrerVisite', () => {
  it('repart au premier arrêt tout de suite, et efface la date en base', async () => {
    const { redemarrerVisite, ecrireVisite, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'finie' })
    redemarrerVisite()
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'en_cours', etape: 0 })
    expect(fetch).toHaveBeenCalledWith('/api/washer/visite-guidee', { method: 'DELETE', keepalive: true })
  })

  it('session expirée : averti (le serveur, lui, n’a rien tracé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const { redemarrerVisite, logger } = await charger()
    redemarrerVisite()
    await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledWith('visite_guidee.redemarrer.session_expiree', {}))
  })

  it('requête qui n’arrive pas : erreur tracée, la reprise reste affichée à l’écran', async () => {
    const panne = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw panne }))
    const { redemarrerVisite, logger, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    redemarrerVisite()
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalledWith('visite_guidee.redemarrer.reseau', {}, panne))
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'en_cours', etape: 0 })
  })
})
