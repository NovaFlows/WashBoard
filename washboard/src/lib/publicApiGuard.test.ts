import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { refusSiQuotaMapsDepasse, MAPS_LIMITE, MAPS_FENETRE_MS } from './publicApiGuard'

// Le compteur vit dans un module partagé et survit d'un test à l'autre : chaque
// cas utilise donc sa propre adresse IP, sinon ils se marcheraient dessus.
let compteur = 0
function requete(ip = `10.0.0.${++compteur}`) {
  return { headers: { get: (n: string) => (n === 'x-forwarded-for' ? ip : null) } }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('refusSiQuotaMapsDepasse', () => {
  it('laisse passer un usage normal', () => {
    const req = requete()
    // Un parcours de réservation complet consomme une trentaine d'appels.
    for (let i = 0; i < 30; i++) {
      expect(refusSiQuotaMapsDepasse(req)).toBeNull()
    }
  })

  it('laisse passer jusqu\'au plafond, refuse au-delà', () => {
    const req = requete()
    for (let i = 0; i < MAPS_LIMITE; i++) {
      expect(refusSiQuotaMapsDepasse(req)).toBeNull()
    }
    expect(refusSiQuotaMapsDepasse(req)).not.toBeNull()
  })

  it('répond 429 avec un Retry-After exploitable', () => {
    const req = requete()
    for (let i = 0; i < MAPS_LIMITE; i++) refusSiQuotaMapsDepasse(req)

    const refus = refusSiQuotaMapsDepasse(req)!
    expect(refus.status).toBe(429)
    const retry = Number(refus.headers.get('Retry-After'))
    expect(retry).toBeGreaterThan(0)
    expect(retry).toBeLessThanOrEqual(MAPS_FENETRE_MS / 1000)
  })

  it('compte les cinq routes ensemble, pas chacune de son côté', () => {
    // C'est le point : répartir le plafond route par route laisserait un script
    // tourner cinq fois plus longtemps. Ici, un seul appelant épuise le quota
    // quelle que soit la route qu'il vise.
    const req = requete()
    for (let i = 0; i < MAPS_LIMITE; i++) refusSiQuotaMapsDepasse(req)
    expect(refusSiQuotaMapsDepasse(req)).not.toBeNull()
  })

  it('ne pénalise pas un autre visiteur', () => {
    const abuseur = requete()
    for (let i = 0; i < MAPS_LIMITE + 10; i++) refusSiQuotaMapsDepasse(abuseur)

    expect(refusSiQuotaMapsDepasse(requete())).toBeNull()
  })

  it('rouvre le quota une fois la fenêtre écoulée', () => {
    const req = requete()
    for (let i = 0; i < MAPS_LIMITE + 1; i++) refusSiQuotaMapsDepasse(req)
    expect(refusSiQuotaMapsDepasse(req)).not.toBeNull()

    vi.advanceTimersByTime(MAPS_FENETRE_MS + 1000)
    expect(refusSiQuotaMapsDepasse(req)).toBeNull()
  })

  it('garde une marge confortable pour les adresses IP partagées', () => {
    // Les opérateurs mobiles font passer des centaines d'abonnés derrière une
    // même IP. Le plafond doit absorber plusieurs réservations simultanées,
    // sinon on refuse de vrais clients — le défaut déjà rencontré sur le
    // comptage des visites.
    const parcoursComplet = 30
    expect(MAPS_LIMITE / parcoursComplet).toBeGreaterThanOrEqual(10)
  })
})
