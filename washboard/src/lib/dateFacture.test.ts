import { describe, it, expect } from 'vitest'
import { devinerDate, dateDansTexte, dateMetadonnees, montantDansTexte } from './dateFacture'

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

describe('montantDansTexte', () => {
  it('lit un total clairement libellé', () => {
    expect(montantDansTexte('Total TTC : 1 250,50 €')).toBe(1250.5)
    expect(montantDansTexte('Net à payer 95,00 €')).toBe(95)
  })

  it('sans libellé net, ne devine rien', () => {
    expect(montantDansTexte('Lavage 65 € — option 15 €')).toBeNull()
  })
})
