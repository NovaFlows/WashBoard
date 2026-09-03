import { describe, it, expect, afterEach } from 'vitest'
import { normalizePhone, isValidPhone, isMobilePhone, formatPhone, isPhoneExemptFromUniqueness } from './phone'

// Cette normalisation porte une règle anti-abus : sans forme canonique, la
// contrainte d'unicité en base laisserait passer trois comptes d'essai avec le
// même numéro écrit différemment.
describe('normalizePhone', () => {
  it('accepte les formats de saisie courants et renvoie la même forme', () => {
    const attendu = '0612345678'
    for (const saisie of [
      '0612345678',
      '06 12 34 56 78',
      '06.12.34.56.78',
      '06-12-34-56-78',
      ' 0612345678 ',
      '+33612345678',
      '+33 6 12 34 56 78',
      '0033612345678',
      '33612345678',
    ]) {
      expect(normalizePhone(saisie), `échec sur « ${saisie} »`).toBe(attendu)
    }
  })

  it('accepte un fixe', () => {
    expect(normalizePhone('01 23 45 67 89')).toBe('0123456789')
    expect(normalizePhone('+33123456789')).toBe('0123456789')
  })

  it('refuse un numéro trop court ou trop long', () => {
    expect(normalizePhone('061234567')).toBeNull()
    expect(normalizePhone('06123456789')).toBeNull()
  })

  it('refuse un second chiffre à 0 — aucun numéro français ne commence par 00', () => {
    expect(normalizePhone('0012345678')).toBeNull()
  })

  it('refuse ce qui n’est pas un numéro', () => {
    expect(normalizePhone('pas un numéro')).toBeNull()
    expect(normalizePhone('06 12 34 56 7A')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })

  it('refuse un numéro étranger non français', () => {
    // +32 = Belgique : hors périmètre pour l'instant, et l'accepter
    // fausserait la détection de doublons.
    expect(normalizePhone('+32470123456')).toBeNull()
  })

  it('deux écritures du même numéro donnent la même clé', () => {
    // C'est exactement ce qui empêche d'ouvrir deux comptes avec le même
    // téléphone en changeant le format de saisie.
    expect(normalizePhone('+33612345678')).toBe(normalizePhone('06 12 34 56 78'))
  })
})

describe('isValidPhone', () => {
  it('valide un numéro correct', () => {
    expect(isValidPhone('06 12 34 56 78')).toBe(true)
  })
  it('invalide une saisie incorrecte', () => {
    expect(isValidPhone('123')).toBe(false)
    expect(isValidPhone(null)).toBe(false)
  })
})

describe('isMobilePhone', () => {
  it('reconnaît un mobile 06 ou 07', () => {
    expect(isMobilePhone('0612345678')).toBe(true)
    expect(isMobilePhone('+33712345678')).toBe(true)
  })
  it('distingue un fixe, qui ne recevrait jamais un SMS', () => {
    expect(isMobilePhone('0123456789')).toBe(false)
    expect(isMobilePhone('0512345678')).toBe(false)
  })
  it('refuse une saisie invalide', () => {
    expect(isMobilePhone('abc')).toBe(false)
  })
})

describe('formatPhone', () => {
  it('groupe par deux chiffres', () => {
    expect(formatPhone('0612345678')).toBe('06 12 34 56 78')
    expect(formatPhone('+33612345678')).toBe('06 12 34 56 78')
  })
  it('renvoie l’entrée telle quelle si elle n’est pas normalisable', () => {
    // On préfère afficher une donnée existante imparfaite plutôt que de la
    // masquer : un numéro étranger déjà en base doit rester lisible.
    expect(formatPhone('+32470123456')).toBe('+32470123456')
  })
  it('gère l’absence de valeur', () => {
    expect(formatPhone(null)).toBe('')
    expect(formatPhone('')).toBe('')
  })
})

describe('isPhoneExemptFromUniqueness', () => {
  // L'unicité du numéro empêche d'ouvrir plusieurs essais gratuits. Elle gêne
  // une seule personne légitime : Alexandre, qui teste sur son propre numéro.
  // La liste vit dans une variable d'environnement — le dépôt est public.
  const initial = process.env.PHONE_UNIQUENESS_EXEMPT

  afterEach(() => {
    if (initial === undefined) delete process.env.PHONE_UNIQUENESS_EXEMPT
    else process.env.PHONE_UNIQUENESS_EXEMPT = initial
  })

  it('n’exempte personne quand la variable est absente', () => {
    delete process.env.PHONE_UNIQUENESS_EXEMPT
    expect(isPhoneExemptFromUniqueness('0612345678')).toBe(false)
  })

  it('exempte un numéro listé', () => {
    process.env.PHONE_UNIQUENESS_EXEMPT = '0612345678'
    expect(isPhoneExemptFromUniqueness('0612345678')).toBe(true)
  })

  it('reconnaît le numéro quelle que soit son écriture', () => {
    // Sans normalisation des deux côtés, l'exemption ne s'appliquerait pas
    // selon la façon dont le numéro a été saisi à l'inscription.
    process.env.PHONE_UNIQUENESS_EXEMPT = '+33612345678'
    expect(isPhoneExemptFromUniqueness('06 12 34 56 78')).toBe(true)
  })

  it('gère plusieurs numéros séparés par des virgules', () => {
    process.env.PHONE_UNIQUENESS_EXEMPT = '0612345678, 06 84 14 04 38'
    expect(isPhoneExemptFromUniqueness('0684140438')).toBe(true)
    expect(isPhoneExemptFromUniqueness('0612345678')).toBe(true)
    expect(isPhoneExemptFromUniqueness('0799887766')).toBe(false)
  })

  it('n’exempte pas un numéro absent de la liste', () => {
    process.env.PHONE_UNIQUENESS_EXEMPT = '0612345678'
    expect(isPhoneExemptFromUniqueness('0698765432')).toBe(false)
  })

  it('refuse une saisie invalide, même si la liste est mal remplie', () => {
    process.env.PHONE_UNIQUENESS_EXEMPT = 'nimporte quoi'
    expect(isPhoneExemptFromUniqueness('pas un numero')).toBe(false)
    expect(isPhoneExemptFromUniqueness(null)).toBe(false)
  })
})
