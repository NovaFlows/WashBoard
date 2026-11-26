import { describe, expect, it } from 'vitest'
import { formatPhone, isMobilePhone, normaliserMobile, normalizePhone, paysDuTelephone, telephoneDuPays } from './phone'
import {
  identifiantValidePour, mentionFranchiseTva, mentionRetardPaiement, nifEspagnolValide, numeroTvaValide, paysDuTelephoneLaveur,
  paysFacturation, reglesPays, siretValide, tauxTvaNormal, tauxTvaPour,
} from './facture'
import { estMobileFrancais, phraseMobileRequis } from './codeSms'
import { paysOuverts } from './paysInscription'

describe('téléphone allemand', () => {
  it('lit la forme internationale et la saisie nationale quand le pays est connu', () => {
    expect(normalizePhone('+49 176 12345678')).toBe('+4917612345678')
    expect(normalizePhone('0049 176 12345678')).toBe('+4917612345678')
    expect(normalizePhone('+49(0)176 12345678')).toBe('+4917612345678')
    expect(normalizePhone('0176 12345678', 'DE')).toBe('+4917612345678')
    expect(telephoneDuPays('176 12345678', 'DE')).toBe('+4917612345678')
    expect(telephoneDuPays('0151 12345678', 'DE')).toBe('+4915112345678')
  })
  it('un mobile commence par 15, 16 ou 17 ; un fixe n’en est pas un', () => {
    for (const n of ['+4915112345678', '+491601234567', '+4917612345678']) expect(isMobilePhone(n), n).toBe(true)
    expect(isMobilePhone('+4930123456')).toBe(false)
    expect(normaliserMobile('+49 151 12345678')).toBe('+4915112345678')
    expect(normaliserMobile('+49 30 123456')).toBeNull()
  })
  it('reconnu comme allemand, affiché lisiblement', () => {
    expect(paysDuTelephone('+4917612345678')).toBe('DE')
    expect(formatPhone('+4917612345678')).toBe('+49 176 12345678')
  })
})

describe('téléphone espagnol', () => {
  it('lit la forme internationale et la saisie locale quand le pays est connu', () => {
    expect(normalizePhone('+34 612 34 56 78')).toBe('+34612345678')
    expect(normalizePhone('0034 612345678')).toBe('+34612345678')
    expect(normalizePhone('612 34 56 78', 'ES')).toBe('+34612345678')
    expect(telephoneDuPays('612 34 56 78', 'ES')).toBe('+34612345678')
  })
  it('un mobile commence par 6 ou 71 à 74', () => {
    expect(isMobilePhone('+34612345678')).toBe(true)
    expect(isMobilePhone('+34712345678')).toBe(true)
    expect(isMobilePhone('+34912345678')).toBe(false)
    expect(normaliserMobile('+34 612 345 678')).toBe('+34612345678')
  })
  it('un neuf chiffres sans indicatif n’est pas lu comme espagnol (confusion avec le Luxembourg)', () => {
    expect(normaliserMobile('612345678')).not.toBe('+34612345678')
    expect(paysDuTelephone('+34612345678')).toBe('ES')
    expect(formatPhone('+34612345678')).toBe('+34 612 345 678')
  })
})

describe('SMS et ouverture', () => {
  it('Allemagne et Espagne : refusés tant que leur pays n’est pas ouvert, acceptés une fois ouverts', () => {
    const ferme = { NEXT_PUBLIC_PAYS_INSCRIPTION: 'FR,BE,CH,LU' }
    const ouvert = { NEXT_PUBLIC_PAYS_INSCRIPTION: 'FR,BE,CH,LU,DE,ES' }
    expect(estMobileFrancais('+4917612345678', ferme)).toBe(false)
    expect(estMobileFrancais('+34612345678', ferme)).toBe(false)
    expect(estMobileFrancais('+4917612345678', ouvert)).toBe(true)
    expect(estMobileFrancais('+34612345678', ouvert)).toBe(true)
    expect(estMobileFrancais('+4930123456', ouvert)).toBe(false)
    expect(phraseMobileRequis(ouvert)).toMatch(/Allemagne.*Espagne/)
    expect(paysOuverts('DE,ES')).toEqual(['FR', 'DE', 'ES'])
  })
  it('ouverts par défaut', () => {
    expect(paysOuverts(undefined)).toContain('DE')
    expect(paysOuverts(undefined)).toContain('ES')
  })
})

describe('facturation Allemagne', () => {
  it('le pays se lit sur le téléphone ou la TVA', () => {
    expect(paysDuTelephoneLaveur('+4917612345678')).toBe('DE')
    expect(paysFacturation({ facture_numero_tva: 'DE123456789' })).toBe('DE')
    expect(paysFacturation({ facture_siret: '12/345/67890' })).toBe('DE')
  })
  it('Steuernummer, USt-IdNr. et TVA', () => {
    expect(identifiantValidePour('DE', '12/345/67890')).toBe(true)
    expect(identifiantValidePour('DE', 'DE123456789')).toBe(true)
    expect(identifiantValidePour('DE', '1234')).toBe(false)
    expect(siretValide('12/345/67890')).toBe(true)
    expect(numeroTvaValide('DE 123 456 789')).toBe(true)
    expect(numeroTvaValide('DE12345')).toBe(false)
  })
  it('taux, mentions', () => {
    expect([...tauxTvaPour('DE')]).toEqual([19, 7])
    expect(tauxTvaNormal('DE')).toBe(19)
    expect(mentionFranchiseTva('DE')).toMatch(/§ 19 UStG/)
    expect(mentionRetardPaiement('DE')).toMatch(/§ 288 BGB/)
    expect(reglesPays('DE').formes).toContain('GmbH')
  })
})

describe('facturation Espagne', () => {
  it('NIF : DNI, NIE et CIF avec leur clé', () => {
    expect(nifEspagnolValide('12345678Z')).toBe(true)
    expect(nifEspagnolValide('12345678A')).toBe(false)
    expect(nifEspagnolValide('X1234567L')).toBe(true)
    expect(nifEspagnolValide('B12345674')).toBe(true)
    expect(nifEspagnolValide('B12345675')).toBe(false)
  })
  it('le pays, l’identifiant et la TVA', () => {
    expect(paysDuTelephoneLaveur('+34612345678')).toBe('ES')
    expect(paysFacturation({ facture_siret: '12345678Z' })).toBe('ES')
    expect(identifiantValidePour('ES', '12345678Z')).toBe(true)
    expect(siretValide('B12345674')).toBe(true)
    expect(numeroTvaValide('ES12345678Z')).toBe(true)
    expect(numeroTvaValide('ES12345678A')).toBe(false)
  })
  it('taux, mentions', () => {
    expect([...tauxTvaPour('ES')]).toEqual([21, 10, 4])
    expect(tauxTvaNormal('ES')).toBe(21)
    expect(mentionFranchiseTva('ES')).toMatch(/art. 20/)
    expect(mentionRetardPaiement('ES')).toMatch(/3\/2004/)
  })
})

describe('les pays existants ne bougent pas', () => {
  it('France, Belgique, Suisse', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe('0612345678')
    expect(normalizePhone('0470 12 34 56', 'BE')).toBe('+32470123456')
    expect(paysFacturation({})).toBe('FR')
    expect(mentionRetardPaiement('FR')).toMatch(/L441-10/)
  })
})

describe('taux présélectionné', () => {
  it('le 20 % enregistré par défaut ne s’impose pas à un laveur allemand ou espagnol', async () => {
    const { tauxInitial } = await import('./facture')
    expect(tauxInitial(20, 'DE')).toBe(19)
    expect(tauxInitial(20, 'ES')).toBe(21)
    expect(tauxInitial(7, 'DE')).toBe(7)
    expect(tauxInitial(null, 'DE')).toBe(19)
    expect(tauxInitial(20, 'FR')).toBe(20)
    expect(tauxInitial(5.5, 'FR')).toBe(5.5)
  })
})
