import { describe, it, expect } from 'vitest'
import {
  relireRegistre, choixPour, doitDemander, peutChargerPixel,
  pixelIdValide, nettoyerPixelId, VALIDITE_MOIS, type Registre,
} from './consentement'

// ─────────────────────────────────────────────────────────────────────────────
// Le consentement décide si un script tiers se charge et dépose des cookies.
// Une erreur dans un sens affiche un bandeau pour rien et coûte des
// réservations au laveur ; dans l'autre, elle dépose un cookie publicitaire
// sans accord — et celle-là ne se rattrape pas.
// ─────────────────────────────────────────────────────────────────────────────

const JOUR = 24 * 60 * 60 * 1000
const T0 = new Date('2026-10-01T10:00:00Z').getTime()
const PIXEL = '123456789012345'

const registre = (choix: 'accepte' | 'refuse', le = T0): Registre => ({ autonettoyage: { choix, le } })

describe('peutChargerPixel — la fonction qui ne doit jamais se tromper', () => {
  it('ne charge QUE sur un accord explicite', () => {
    expect(peutChargerPixel(PIXEL, registre('accepte'), 'autonettoyage')).toBe(true)
  })

  it('ne charge pas sans réponse', () => {
    expect(peutChargerPixel(PIXEL, {}, 'autonettoyage')).toBe(false)
  })

  it('ne charge pas sur un refus', () => {
    expect(peutChargerPixel(PIXEL, registre('refuse'), 'autonettoyage')).toBe(false)
  })

  it('ne charge pas sans Pixel déclaré', () => {
    expect(peutChargerPixel(null, registre('accepte'), 'autonettoyage')).toBe(false)
    expect(peutChargerPixel('', registre('accepte'), 'autonettoyage')).toBe(false)
  })

  it('ne confond JAMAIS deux laveurs', () => {
    // Le Pixel de Kooki Clean et celui d'un autre laveur sont deux
    // destinataires différents, et tous partagent le domaine washboard.fr.
    // Accepter chez l'un n'autorise pas l'autre.
    const accepteChezA = registre('accepte')
    expect(peutChargerPixel(PIXEL, accepteChezA, 'autonettoyage')).toBe(true)
    expect(peutChargerPixel(PIXEL, accepteChezA, 'kookii-clean')).toBe(false)
  })

  it('ne charge plus une fois le choix périmé', () => {
    const vieux = registre('accepte', T0 - (VALIDITE_MOIS * 30 + 5) * JOUR)
    const relu = relireRegistre(JSON.stringify(vieux), T0)
    expect(peutChargerPixel(PIXEL, relu, 'autonettoyage')).toBe(false)
  })
})

describe('doitDemander', () => {
  it('demande quand le laveur a un Pixel et que personne n’a répondu', () => {
    expect(doitDemander(PIXEL, {}, 'autonettoyage')).toBe(true)
  })

  it('ne demande RIEN sans Pixel', () => {
    // Un bandeau sans Pixel serait une nuisance pure : il coûterait des
    // réservations pour protéger de quelque chose qui n'existe pas.
    expect(doitDemander(null, {}, 'autonettoyage')).toBe(false)
    expect(doitDemander(undefined, {}, 'autonettoyage')).toBe(false)
  })

  it('ne redemande pas après une réponse, quelle qu’elle soit', () => {
    expect(doitDemander(PIXEL, registre('accepte'), 'autonettoyage')).toBe(false)
    expect(doitDemander(PIXEL, registre('refuse'), 'autonettoyage')).toBe(false)
  })

  it('redemande une fois le délai passé — au refus COMME à l’acceptation', () => {
    // Redemander plus vite à ceux qui ont refusé serait exactement la
    // dissymétrie que la CNIL interdit.
    const perime = (c: 'accepte' | 'refuse') =>
      relireRegistre(JSON.stringify(registre(c, T0 - (VALIDITE_MOIS * 30 + 5) * JOUR)), T0)
    expect(doitDemander(PIXEL, perime('refuse'), 'autonettoyage')).toBe(true)
    expect(doitDemander(PIXEL, perime('accepte'), 'autonettoyage')).toBe(true)
  })
})

describe('relireRegistre', () => {
  it('relit un choix valide', () => {
    expect(choixPour(relireRegistre(JSON.stringify(registre('accepte')), T0), 'autonettoyage')).toBe('accepte')
  })

  it('tient toute la durée de validité, et pas au-delà', () => {
    const presquePerime = JSON.stringify(registre('accepte', T0 - (VALIDITE_MOIS * 30 - 1) * JOUR))
    expect(choixPour(relireRegistre(presquePerime, T0), 'autonettoyage')).toBe('accepte')
    const perime = JSON.stringify(registre('accepte', T0 - (VALIDITE_MOIS * 30 + 1) * JOUR))
    expect(choixPour(relireRegistre(perime, T0), 'autonettoyage')).toBeNull()
  })

  it('jette un horodatage venu du futur', () => {
    const futur = JSON.stringify(registre('accepte', T0 + 10 * JOUR))
    expect(choixPour(relireRegistre(futur, T0), 'autonettoyage')).toBeNull()
  })

  it('ne casse jamais, et ne laisse jamais passer, sur une valeur abîmée', () => {
    // La valeur vient du navigateur du visiteur : n'importe qui peut y écrire
    // n'importe quoi, y compris pour tenter de faire charger le script.
    for (const brut of [
      null, '', 'pas du json', '[]', '"texte"',
      '{"autonettoyage":null}',
      '{"autonettoyage":{"choix":"oui","le":0}}',
      '{"autonettoyage":{"choix":"accepte"}}',
      '{"autonettoyage":{"choix":"accepte","le":"hier"}}',
      '{"autonettoyage":{"le":123}}',
    ]) {
      expect(() => relireRegistre(brut, T0)).not.toThrow()
      expect(peutChargerPixel(PIXEL, relireRegistre(brut, T0), 'autonettoyage'), brut ?? 'null').toBe(false)
    }
  })

  it('garde les laveurs valides et jette les lignes abîmées, dans le même registre', () => {
    const mixte = '{"a":{"choix":"accepte","le":' + T0 + '},"b":{"choix":"n’importe quoi","le":' + T0 + '}}'
    const relu = relireRegistre(mixte, T0)
    expect(choixPour(relu, 'a')).toBe('accepte')
    expect(choixPour(relu, 'b')).toBeNull()
  })
})

describe('identifiant de Pixel', () => {
  it('accepte 15 et 16 chiffres', () => {
    expect(pixelIdValide('123456789012345')).toBe(true)
    expect(pixelIdValide('1234567890123456')).toBe(true)
  })

  it('refuse tout le reste', () => {
    for (const v of ['12345', '12345678901234567', 'abcdefghijklmno', '', null, undefined, '1234-5678-9012-345']) {
      expect(pixelIdValide(v as string), String(v)).toBe(false)
    }
  })

  it('nettoie ce que le laveur colle depuis son gestionnaire de publicités', () => {
    expect(nettoyerPixelId(' 1234 5678 9012 345 ')).toBe('123456789012345')
    expect(nettoyerPixelId('ID: 123456789012345')).toBe('123456789012345')
    expect(nettoyerPixelId('')).toBeNull()
    expect(nettoyerPixelId('aucun chiffre')).toBeNull()
  })
})
