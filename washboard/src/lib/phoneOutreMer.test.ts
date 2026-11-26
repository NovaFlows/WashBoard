import { describe, it, expect } from 'vitest'
import { normalizePhone, normaliserMobile, isMobilePhone, whatsappDigits, chiffresInternationaux, formatPhone, telephoneDuPays } from './phone'
import { normalizePhone as versSms } from './sms'
import { estMobileFrancais } from './codeSms'
import { verifierNouveauNumero } from './changerTelephone'

// Numéros d'outre-mer (2026-11-26, Azura à Cayenne) : stockés en 10 chiffres comme en métropole,
// mais envoyés (SMS, WhatsApp) avec LEUR indicatif, jamais en +33.

describe('numéros d’outre-mer : saisie', () => {
  it('le +594 guyanais, sous toutes ses écritures, devient 0694…', () => {
    for (const saisie of ['+594 694 12 34 56', '+594694123456', '00594694123456', '594694123456', '0694 12 34 56', '06.94.12.34.56']) {
      expect(normalizePhone(saisie)).toBe('0694123456')
    }
  })

  it('Guadeloupe, Martinique, La Réunion, Mayotte', () => {
    expect(normalizePhone('+590 690 12 34 56')).toBe('0690123456')
    expect(normalizePhone('+596 696 12 34 56')).toBe('0696123456')
    expect(normalizePhone('+596 697 12 34 56')).toBe('0697123456')
    expect(normalizePhone('+262 692 12 34 56')).toBe('0692123456')
    expect(normalizePhone('+262 639 12 34 56')).toBe('0639123456')
    expect(normalizePhone('+262 262 12 34 56')).toBe('0262123456')
    expect(normalizePhone('+594 594 12 34 56')).toBe('0594123456')
  })

  it('un numéro d’outre-mer écrit en +33 retrouve sa forme à 10 chiffres', () => {
    expect(normalizePhone('+33 694 12 34 56')).toBe('0694123456')
  })

  it('refuse un indicatif qui ne va pas avec le numéro, ou une longueur fausse', () => {
    expect(normalizePhone('+594 612 34 56 78')).toBeNull() // un mobile de métropole n'est pas guyanais
    expect(normalizePhone('+594 696 12 34 56')).toBeNull() // 0696 est martiniquais
    expect(normalizePhone('+594 694 12 34 5')).toBeNull()
    expect(normalizePhone('+594 694 12 34 567')).toBeNull()
  })

  it('à l’inscription (pays France) et au changement de numéro, c’est un mobile accepté', () => {
    expect(telephoneDuPays('694 12 34 56', 'FR')).toBe('0694123456')
    expect(telephoneDuPays('+594 694 12 34 56', 'FR')).toBe('0694123456')
    expect(normaliserMobile('+594 694 12 34 56')).toBe('0694123456')
    expect(isMobilePhone('+262 692 12 34 56')).toBe(true)
    expect(isMobilePhone('+594 594 12 34 56')).toBe(false) // un fixe ne reçoit pas de SMS
    expect(estMobileFrancais('0694123456')).toBe(true)
    expect(verifierNouveauNumero('+594 694 12 34 56', '0612345678')).toEqual({ telephone: '0694123456' })
  })

  it('l’affichage reste celui d’un numéro français', () => {
    expect(formatPhone('+594694123456')).toBe('06 94 12 34 56')
  })
})

describe('numéros d’outre-mer : envoi', () => {
  it('WhatsApp reçoit le vrai indicatif', () => {
    expect(whatsappDigits('0694123456')).toBe('594694123456')
    expect(whatsappDigits('06 90 12 34 56')).toBe('590690123456')
    expect(whatsappDigits('0696123456')).toBe('596696123456')
    expect(whatsappDigits('0692123456')).toBe('262692123456')
    expect(whatsappDigits('0639123456')).toBe('262639123456')
    expect(whatsappDigits('0262123456')).toBe('262262123456')
  })

  it('la métropole ne change pas', () => {
    expect(whatsappDigits('0612345678')).toBe('33612345678')
    expect(whatsappDigits('0698765432')).toBe('33698765432') // 0698 n'est pas un préfixe d'outre-mer
    expect(chiffresInternationaux('0123456789')).toBe('33123456789')
    expect(chiffresInternationaux('+32470123456')).toBe('32470123456')
  })

  it('le SMS part avec le vrai indicatif, même si le numéro a été écrit en +33', () => {
    expect(versSms('0694123456')).toBe('+594694123456')
    expect(versSms('+33694123456')).toBe('+594694123456')
    expect(versSms('+594 694 12 34 56')).toBe('+594694123456')
    expect(versSms('00262692123456')).toBe('+262692123456')
    expect(versSms('0696123456')).toBe('+596696123456')
    expect(versSms('0612345678')).toBe('+33612345678')
    expect(versSms('+33612345678')).toBe('+33612345678')
  })
})
