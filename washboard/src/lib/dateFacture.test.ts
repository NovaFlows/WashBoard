import { describe, it, expect } from 'vitest'
import { devinerDate, dateDansTexte, dateMetadonnees, montantDansTexte, numeroDansTexte } from './dateFacture'

const maintenant = new Date('2026-09-15T12:00:00Z')

describe('devinerDate — ordre de préférence', () => {
  it('le nom du fichier en premier, sous toutes ses formes', () => {
    expect(devinerDate({ nomFichier: 'facture-2026-03-12.pdf' }, maintenant)).toEqual({ date: '2026-03-12', source: 'nom' })
    expect(devinerDate({ nomFichier: 'FACT_20260312_client.pdf' }, maintenant)).toEqual({ date: '2026-03-12', source: 'nom' })
    expect(devinerDate({ nomFichier: 'Facture 12.03.2026 Dupont.pdf' }, maintenant)).toEqual({ date: '2026-03-12', source: 'nom' })
    expect(devinerDate({ nomFichier: 'lavage 5 avril 2026.pdf' }, maintenant)).toEqual({ date: '2026-04-05', source: 'nom' })
  })

  it('puis le texte du PDF, puis ses métadonnées, puis la date du fichier', () => {
    expect(devinerDate({ nomFichier: 'facture.pdf', texte: 'Facture du 02/07/2026' }, maintenant))
      .toEqual({ date: '2026-07-02', source: 'texte' })
    expect(devinerDate({ nomFichier: 'facture.pdf', texte: 'aucune date', metadonnees: "D:20260615093000+02'00'" }, maintenant))
      .toEqual({ date: '2026-06-15', source: 'metadonnees' })
    expect(devinerDate({ nomFichier: 'scan.jpg', modifieLe: Date.parse('2026-05-20T10:00:00Z') }, maintenant))
      .toEqual({ date: '2026-05-20', source: 'fichier' })
  })

  it('rien de lisible : pas de date inventée', () => {
    expect(devinerDate({ nomFichier: 'scan.jpg' }, maintenant)).toBeNull()
  })

  it('écarte les dates impossibles ou dans le futur', () => {
    expect(devinerDate({ nomFichier: 'facture-2026-02-30.pdf' }, maintenant)).toBeNull()
    expect(devinerDate({ nomFichier: 'devis-2027-01-10.pdf' }, maintenant)).toBeNull()
  })
})

describe('dateDansTexte', () => {
  it('une date libellée l’emporte sur la première date venue', () => {
    const texte = 'Entreprise créée le 01/01/2020. Date de facture : 14/09/2026. Échéance : 14/10/2026'
    expect(dateDansTexte(texte, maintenant)).toBe('2026-09-14')
  })

  it('« Émise le » et les mois écrits en toutes lettres', () => {
    expect(dateDansTexte('Facture n° 45 — émise le 3 août 2026', maintenant)).toBe('2026-08-03')
  })
})

describe('dateMetadonnees', () => {
  it('lit la date de création d’un PDF', () => {
    expect(dateMetadonnees("D:20260102120000Z", maintenant)).toBe('2026-01-02')
    expect(dateMetadonnees(null, maintenant)).toBeNull()
  })
})

describe('factures en anglais (premier essai réel, 2026-09-15)', () => {
  // Texte tel qu'extrait d'une vraie facture d'abonnement en anglais.
  const texte = 'Invoice Invoice number RIBBOLOQ-0002 Date of issue April 6, 2026 Date due April 6, 2026 '
    + '€21.60 due April 6, 2026 Description Qty Unit price Tax Amount Claude Pro Apr 6–May 6, 2026 1 €18.00 20% €18.00 '
    + 'Subtotal €18.00 Total excluding tax €18.00 VAT - France (20% on €18.00) €3.60 Total €21.60 Amount due €21.60'

  it('lit la date d’émission, pas la période ni l’échéance', () => {
    expect(devinerDate({ nomFichier: 'ClaudeAvrilFacture (1).pdf', texte, metadonnees: 'D:20260407101500Z' }, maintenant))
      .toEqual({ date: '2026-04-06', source: 'texte' })
  })

  it('lit le montant à payer, pas le total hors taxes', () => {
    expect(montantDansTexte(texte)).toBe(21.6)
  })

  it('autres écritures anglaises', () => {
    expect(dateDansTexte('Invoice date: 6th April 2026', maintenant)).toBe('2026-04-06')
    expect(dateDansTexte('Issue date Sep 1, 2026', maintenant)).toBe('2026-09-01')
    expect(montantDansTexte('Total due: 1,250.50 EUR')).toBe(1250.5)
  })
})

describe('numeroDansTexte', () => {
  it('lit le numéro d’origine, en français comme en anglais', () => {
    expect(numeroDansTexte('Invoice Invoice number RIBBOLOQ-0002 Date of issue April 6, 2026')).toBe('RIBBOLOQ-0002')
    expect(numeroDansTexte('Facture n° 45 — émise le 3 août 2026')).toBe('45')
    expect(numeroDansTexte('N° de facture : F-2026-045.')).toBe('F-2026-045')
    expect(numeroDansTexte('Numéro de facture 2026/118')).toBe('2026/118')
  })

  it('sans libellé net ou sans chiffre, ne devine rien', () => {
    expect(numeroDansTexte('Lavage complet 65 €')).toBeNull()
    expect(numeroDansTexte('Invoice number: pending')).toBeNull()
  })
})

describe('montantDansTexte', () => {
  it('lit un total clairement libellé', () => {
    expect(montantDansTexte('Total TTC : 1 250,50 €')).toBe(1250.5)
    expect(montantDansTexte('Net à payer 95,00 €')).toBe(95)
  })

  it('sans libellé net, ne devine rien', () => {
    expect(montantDansTexte('Lavage 65 € — option 15 €')).toBeNull()
  })
})
