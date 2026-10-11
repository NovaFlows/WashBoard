import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

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
  // `logger` est mocké une seule fois pour tout le fichier (`vi.mock` plus
  // haut) : `vi.resetModules()` dans `charger()` redonne un module
  // `visiteGuidee` neuf, mais PAS un `logger` neuf — ses `vi.fn()`
  // accumulent les appels de TOUS les tests précédents sans ce nettoyage.
  // Repéré le 2026-10-10 : un test de `fermerPourLInstant` qui appelle
  // vraiment `logger.warn` (nouveau, suite au correctif « Passer » marque
  // la visite en base) faisait échouer `terminerVisite > succès` plus loin
  // dans le fichier, qui vérifie que `logger.warn` n'a PAS été appelé.
  vi.clearAllMocks()
})

afterEach(() => vi.unstubAllGlobals())

describe('etapesPour', () => {
  it('site : les huit arrêts « page », dans l’ordre (tuto réduit de 21 à 13 le 2026-10-11, puis +1 « voir-page »)', async () => {
    const { etapesPour } = await charger()
    expect(etapesPour(false).map(e => e.route ?? null)).toEqual([
      '/dashboard',
      '/dashboard/parametres#lien-reservation',
      null, // voir-page : même page que « lien », pas de route à part.
      '/dashboard/parametres/prestations',
      '/dashboard/parametres/horaires',
      '/dashboard/calendrier',
      '/dashboard/clients',
      '/dashboard/guide',
    ])
    expect(etapesPour(false).map(e => e.texte)).toEqual([
      "Voilà ton tableau de bord : tes rendez-vous du jour et ceux à venir, en un coup d'œil.",
      "Le lien à donner à tes clients — celui que tu as choisi à l'inscription.",
      "Et voilà à quoi elle ressemble pour de vrai — ouvre-la, c'est exactement ce que voient tes clients.",
      "Ce que tu vends : nom, prix, durée. Ajoutes-en au moins une — ta page reste vide tant que tu n'en as pas créé une.",
      'Tes dispos et tes congés : choisis un modèle de semaine, ça décide des créneaux que voient tes clients.',
      'Sur Agenda : toute ton activité en vue mois/semaine/jour.',
      "Sur Clients : chaque client qui a réservé, avec son historique et son chiffre d'affaires.",
      "Si tu bloques un jour, commence ici : la plupart des questions ont déjà leur réponse — et si la tienne n'y est pas, tu peux écrire directement à l'équipe depuis cette page.",
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
    // Filtré des deux côtés : un arrêt du site peut lui aussi n'avoir aucune
    // route (Téléphone, même page que l'arrêt précédent).
    expect(pwa.filter(e => e.route).map(e => e.route)).toEqual(site.filter(e => e.route).map(e => e.route))
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

  it('seuls Lien, Voir-page, Prestations et Horaires mettent en évidence un élément de PAGE (hors barre du bas)', async () => {
    const { etapesPour } = await charger()
    const ciblesDePage = etapesPour(false).flatMap(e => (e.cible ? [e.cible] : []))
    expect(ciblesDePage).toEqual(['lien', 'voir-page', 'prestations', 'horaires'])
  })

  // Plus aucun arrêt interactif (Alexandre, 2026-10-11) : pendant le tuto, seuls Suivant et
  // Passer répondent, l'arrière-plan n'est jamais cliquable.
  it('aucun arrêt n’est interactif', async () => {
    const { etapesPour } = await charger()
    expect(etapesPour(true).filter(e => e.interactif)).toEqual([])
    expect(etapesPour(false).filter(e => e.interactif)).toEqual([])
  })

  // `cheminPwa` (2026-10-11, demande de Ryan) : affiché entre guillemets sous
  // le texte de l'arrêt, UNIQUEMENT quand la page visée demande au moins 2
  // taps depuis la barre du bas (jamais pour Aujourd'hui/Agenda/Clients, 1
  // tap direct). Chaque valeur a été vérifiée contre le vrai composant qui
  // porte le lien, pas devinée — voir le commentaire du champ dans
  // `EtapeVisite`.
  it('cheminPwa : jamais sur un arrêt à 1 tap (barre du bas directe)', async () => {
    const { etapesPour } = await charger()
    const unTap = ['/dashboard', '/dashboard/calendrier', '/dashboard/clients']
    for (const e of etapesPour(true)) {
      if (e.route && unTap.includes(e.route)) expect(e.cheminPwa, e.route).toBeUndefined()
    }
  })

  it('cheminPwa : posé sur chaque arrêt à 2 taps ou plus', async () => {
    const { etapesPour } = await charger()
    const attendus: Record<string, string> = {
      '/dashboard/parametres/prestations': 'Plus → Prestations et prix',
      '/dashboard/parametres/horaires': 'Plus → Horaires',
      '/dashboard/guide': 'Plus → Réglages → Guide d’utilisation',
    }
    for (const [route, cheminPwa] of Object.entries(attendus)) {
      const etape = etapesPour(true).find(e => e.route === route)
      expect(etape?.cheminPwa, route).toBe(cheminPwa)
    }
    // Lien (reste sur la page Plus elle-même, 1 tap) n'en a pas.
    const lien = etapesPour(true).find(e => e.cible === 'lien')
    expect(lien?.cheminPwa).toBeUndefined()
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

describe('visitesAFaire', () => {
  it('un tuto par design : chacun à faire seulement quand sa colonne existe et vaut NULL', async () => {
    const { visitesAFaire } = await charger()
    expect(visitesAFaire({ tuto_mobile_vu_le: null, tuto_ordinateur_vu_le: null })).toEqual({ mobile: true, ordinateur: true })
    expect(visitesAFaire({ tuto_mobile_vu_le: null, tuto_ordinateur_vu_le: '2026-10-01T08:00:00Z' })).toEqual({ mobile: true, ordinateur: false })
    expect(visitesAFaire({ tuto_mobile_vu_le: '2026-10-01T08:00:00Z', tuto_ordinateur_vu_le: null })).toEqual({ mobile: false, ordinateur: true })
    expect(visitesAFaire(null)).toEqual({ mobile: false, ordinateur: false })
  })

  it('colonnes absentes (SQL pas encore exécuté) : jamais déclenché', async () => {
    const { visitesAFaire } = await charger()
    expect(visitesAFaire({})).toEqual({ mobile: false, ordinateur: false })
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
  it('ferme tout de suite ET marque la visite vue en base — sinon elle se redéclenche toute seule en revenant sur /dashboard', async () => {
    const { fermerPourLInstant, ecrireVisite, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'en_cours', etape: 3 })
    const promesse = fermerPourLInstant('mobile')
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'absente' })
    expect(fetch).toHaveBeenCalledWith('/api/washer/visite-guidee?appareil=mobile', { method: 'POST', keepalive: true })
    // Attend la vraie fin de l'appel réseau (pas un délai deviné) — sinon il
    // peut se résoudre pendant le test SUIVANT, une fois `beforeEach` reposé
    // un `fetch` différent pour lui.
    await promesse
  })

  it('succès : rien à tracer', async () => {
    const { fermerPourLInstant, logger } = await charger()
    await fermerPourLInstant('mobile')
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('session expirée : averti (le serveur, lui, n’a rien tracé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const { fermerPourLInstant, logger } = await charger()
    await fermerPourLInstant('mobile')
    expect(logger.warn).toHaveBeenCalledWith('visite_guidee.passer.session_expiree', {})
  })

  it('requête qui n’arrive pas : erreur tracée, la carte reste fermée à l’écran', async () => {
    const panne = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw panne }))
    const { fermerPourLInstant, logger, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    await fermerPourLInstant('mobile')
    expect(logger.error).toHaveBeenCalledWith('visite_guidee.passer.reseau', {}, panne)
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'absente' })
  })
})

describe('terminerVisite', () => {
  it('finie tout de suite, une seule requête même sur double clic', async () => {
    const { terminerVisite, lireEtat, lireVisite, ecrireVisite, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'en_cours', etape: 3 })
    const premiere = terminerVisite('mobile')
    const seconde = terminerVisite('mobile')
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'finie' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/washer/visite-guidee?appareil=mobile', { method: 'POST', keepalive: true })
    // Attend la vraie fin (pas un délai deviné) — sinon le `.then()` peut se
    // résoudre pendant le test SUIVANT.
    await Promise.all([premiere, seconde])
  })

  it('succès : rien à tracer', async () => {
    const { terminerVisite, logger } = await charger()
    await terminerVisite('mobile')
    expect(logger.warn).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('session expirée : averti (le serveur, lui, n’a rien tracé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const { terminerVisite, logger } = await charger()
    await terminerVisite('mobile')
    expect(logger.warn).toHaveBeenCalledWith('visite_guidee.terminer.session_expiree', {})
  })

  it('requête qui n’arrive pas : erreur tracée, la visite reste fermée à l’écran', async () => {
    const panne = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw panne }))
    const { terminerVisite, logger, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    await terminerVisite('mobile')
    expect(logger.error).toHaveBeenCalledWith('visite_guidee.terminer.reseau', {}, panne)
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'finie' })
  })
})

describe('redemarrerVisite', () => {
  it('repart au premier arrêt tout de suite, et efface la date en base', async () => {
    const { redemarrerVisite, ecrireVisite, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'finie' })
    // L'état en sessionStorage est écrit tout de suite, avant même que la
    // promesse se résolve — pas besoin de l'attendre pour le vérifier.
    const promesse = redemarrerVisite('mobile')
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'en_cours', etape: 0 })
    expect(fetch).toHaveBeenCalledWith('/api/washer/visite-guidee?appareil=mobile', { method: 'DELETE' })
    // Renvoie une promesse — l'appelant (GuideV2/GuideContent) DOIT l'attendre
    // avant de naviguer, sinon `/dashboard` peut resservir sa version en
    // cache d'avant la remise à zéro (Ryan, 2026-10-10 : premier clic sans
    // effet visible).
    await promesse
  })

  it('session expirée : averti (le serveur, lui, n’a rien tracé)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })))
    const { redemarrerVisite, logger } = await charger()
    await redemarrerVisite('mobile')
    expect(logger.warn).toHaveBeenCalledWith('visite_guidee.redemarrer.session_expiree', {})
  })

  it('requête qui n’arrive pas : erreur tracée, la reprise reste affichée à l’écran', async () => {
    const panne = new TypeError('Failed to fetch')
    vi.stubGlobal('fetch', vi.fn(async () => { throw panne }))
    const { redemarrerVisite, logger, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    await redemarrerVisite('mobile')
    expect(logger.error).toHaveBeenCalledWith('visite_guidee.redemarrer.reseau', {}, panne)
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'en_cours', etape: 0 })
  })
})

describe('oublierVisite', () => {
  it('efface un état « finie » laissé par un AUTRE compte dans le même onglet', async () => {
    // Le bug exact signalé par Ryan le 2026-10-11 : il supprime un compte de
    // test et s'en recrée un dans le même onglet (PWA) pour retester un
    // correctif — la visite « finie » du compte précédent reste en mémoire,
    // le tuto du nouveau compte ne se lance jamais.
    const { oublierVisite, ecrireVisite, lireEtat, lireVisite, etatAuChargement, ETAPES_VISITE } = await charger()
    ecrireVisite({ statut: 'finie' })
    oublierVisite()
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'absente' })
    // Une fois effacée, `/dashboard` du nouveau compte redonne la main à
    // `aFaire` (lu en base) au lieu de rester bloqué sur « finie ».
    expect(etatAuChargement({ statut: 'absente' }, true)).toEqual({ statut: 'en_cours', etape: 0 })
  })

  it('ne fait rien de spécial sans état laissé derrière (cas normal, un seul compte)', async () => {
    const { oublierVisite, lireEtat, lireVisite, ETAPES_VISITE } = await charger()
    oublierVisite()
    expect(lireEtat(lireVisite(), ETAPES_VISITE.length)).toEqual({ statut: 'absente' })
  })
})
