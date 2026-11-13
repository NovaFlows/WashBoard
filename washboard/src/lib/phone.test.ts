import { describe, it, expect, afterEach } from 'vitest'
import { normalizePhone, isValidPhone, isMobilePhone, formatPhone, isPhoneExemptFromUniqueness, whatsappDigits, normaliserMobile, paysDuTelephone } from './phone'

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
    // Seules la France et la Belgique (+32, depuis le 2026-11-11) sont acceptées.
    expect(normalizePhone('+447911123456')).toBeNull()
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
    expect(formatPhone('+447911123456')).toBe('+447911123456')
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

// Extraite de contact.ts (openWhatsapp) le 2026-09-24 — comportement à
// préserver au chiffre près, y compris ce qui la distingue de
// normalizePhone : elle ne valide rien, un numéro imparfait produit quand
// même un lien plutôt que rien.
describe('whatsappDigits', () => {
  it('remplace le 0 initial français par 33', () => {
    expect(whatsappDigits('0612345678')).toBe('33612345678')
  })

  it('nettoie espaces, points et tirets avant de préfixer', () => {
    expect(whatsappDigits('06 12 34 56 78')).toBe('33612345678')
    expect(whatsappDigits('06.12.34.56.78')).toBe('33612345678')
    expect(whatsappDigits('06-12-34-56-78')).toBe('33612345678')
  })

  it('laisse un numéro déjà en 33 tel quel', () => {
    expect(whatsappDigits('+33612345678')).toBe('33612345678')
    expect(whatsappDigits('33612345678')).toBe('33612345678')
  })

  it('ne valide rien, contrairement à normalizePhone : un numéro étranger ou un fixe reste utilisable', () => {
    expect(whatsappDigits('+32470123456')).toBe('32470123456')
    expect(whatsappDigits('0123456789')).toBe('33123456789')
  })

  it('ne renvoie jamais null : une saisie vide ou incomplète donne une chaîne, pas une erreur', () => {
    expect(whatsappDigits('')).toBe('')
    expect(whatsappDigits('061234567')).toBe('3361234567')
  })
})

describe('numéros belges (ouverture du 2026-11-11)', () => {
  it('garde un numéro belge en forme internationale', () => {
    expect(normalizePhone('+32 470 12 34 56')).toBe('+32470123456')
    expect(normalizePhone('0032470123456')).toBe('+32470123456')
    expect(normalizePhone('32470123456')).toBe('+32470123456')
  })
  it('lit un 0470… à la belge seulement quand on est en Belgique', () => {
    expect(normalizePhone('0470 12 34 56', 'BE')).toBe('+32470123456')
    expect(normalizePhone('0470 12 34 56')).toBe('0470123456') // sans pays : un fixe français, comme avant
  })
  it('normaliserMobile : 06/07 français ou 04xx belge, rien d’autre', () => {
    expect(normaliserMobile('06 12 34 56 78')).toBe('0612345678')
    expect(normaliserMobile('0470 12 34 56')).toBe('+32470123456')
    expect(normaliserMobile('+32 470 12 34 56')).toBe('+32470123456')
    expect(normaliserMobile('04 72 12 34 56')).toBe('+32472123456') // à l'inscription, un fixe français ne peut pas recevoir de SMS
    expect(normaliserMobile('02 123 45 67')).toBeNull() // fixe belge
    expect(normaliserMobile('+44 7911 123456')).toBeNull() // autre pays
  })
  it('paysDuTelephone, whatsappDigits et formatPhone', () => {
    expect(paysDuTelephone('+32470123456')).toBe('BE')
    expect(paysDuTelephone('0612345678')).toBe('FR')
    expect(whatsappDigits('+32470123456')).toBe('32470123456')
    expect(whatsappDigits('0612345678')).toBe('33612345678')
    expect(formatPhone('+32470123456')).toBe('+32 470 12 34 56')
  })
  it('isMobilePhone reconnaît un mobile belge', () => {
    expect(isMobilePhone('+32470123456')).toBe(true)
    expect(isMobilePhone('+3221234567')).toBe(false)
  })
})

describe('numéros suisses (ouverture du 2026-11-13)', () => {
  it('garde un numéro suisse en forme internationale', () => {
    expect(normalizePhone('+41 79 123 45 67')).toBe('+41791234567')
    expect(normalizePhone('0041791234567')).toBe('+41791234567')
    expect(normalizePhone('+41 22 123 45 67')).toBe('+41221234567') // fixe genevois
  })
  it('lit un 079… à la suisse seulement quand on est en Suisse', () => {
    expect(normalizePhone('079 123 45 67', 'CH')).toBe('+41791234567')
    expect(normalizePhone('022 123 45 67', 'CH')).toBe('+41221234567')
    // sans le pays, c'est un numéro français : on ne devine pas
    expect(normalizePhone('079 123 45 67')).toBe('0791234567')
  })
  it('refuse un numéro suisse trop court ou trop long', () => {
    expect(normalizePhone('+41 79 123 45')).toBeNull()
    expect(normalizePhone('+41 79 123 45 678')).toBeNull()
  })
  it('un 41… collé n’est pas lu comme suisse (c’est un début de numéro français)', () => {
    expect(normalizePhone('0412345678')).toBe('0412345678')
  })
  it('normaliserMobile : un mobile suisse doit s’écrire avec +41', () => {
    expect(normaliserMobile('+41 79 123 45 67')).toBe('+41791234567')
    expect(normaliserMobile('0041 78 123 45 67')).toBe('+41781234567')
    expect(normaliserMobile('+41 22 123 45 67')).toBeNull() // fixe
    expect(normaliserMobile('079 123 45 67')).toBe('0791234567') // lu comme un 07 français
  })
  it('pays, WhatsApp, affichage, mobile', () => {
    expect(paysDuTelephone('+41791234567')).toBe('CH')
    expect(paysDuTelephone('0041791234567')).toBe('CH')
    expect(whatsappDigits('+41791234567')).toBe('41791234567')
    expect(formatPhone('+41791234567')).toBe('+41 79 123 45 67')
    expect(isMobilePhone('+41791234567')).toBe(true)
    expect(isMobilePhone('+41221234567')).toBe(false)
  })
})
