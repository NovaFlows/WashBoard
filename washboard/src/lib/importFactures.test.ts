import { describe, it, expect } from 'vitest'
import { cheminAppartient, validerSaisie, extensionStockage } from './importFactures'

const LAVEUR = '11111111-2222-4333-8444-555555555555'
const AUTRE = '99999999-2222-4333-8444-555555555555'
const FICHIER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const maintenant = new Date('2026-09-15T12:00:00Z')

const saisie = (surcharge: Record<string, unknown> = {}) => ({
  chemin: `${LAVEUR}/${FICHIER}.pdf`,
  nomFichier: 'facture-2026-03-12.pdf',
  typeFichier: 'application/pdf',
  taille: 120_000,
  dateFacture: '2026-03-12',
  montant: '95,00'.replace(',', '.'),
  numero: '2026-045',
  ...surcharge,
})

describe('cheminAppartient', () => {
  it('accepte un fichier rangé dans le dossier du laveur', () => {
    expect(cheminAppartient(`${LAVEUR}/${FICHIER}.pdf`, LAVEUR)).toBe(true)
  })

  it('refuse le dossier d’un autre laveur, les remontées de dossier et les noms libres', () => {
    expect(cheminAppartient(`${AUTRE}/${FICHIER}.pdf`, LAVEUR)).toBe(false)
    expect(cheminAppartient(`${LAVEUR}/../${AUTRE}/${FICHIER}.pdf`, LAVEUR)).toBe(false)
    expect(cheminAppartient(`${LAVEUR}/facture.pdf`, LAVEUR)).toBe(false)
    expect(cheminAppartient(`${LAVEUR}/${FICHIER}.exe`, LAVEUR)).toBe(false)
    expect(cheminAppartient(42, LAVEUR)).toBe(false)
  })
})

describe('validerSaisie', () => {
  it('une saisie complète passe, montant arrondi au centime', () => {
    const r = validerSaisie(saisie({ montant: 95.005 }), LAVEUR, maintenant)
    expect(r).toMatchObject({ ok: true, valeur: { dateFacture: '2026-03-12', montant: 95.01, numero: '2026-045' } })
  })

  it('montant et numéro facultatifs', () => {
    const r = validerSaisie(saisie({ montant: '', numero: '  ' }), LAVEUR, maintenant)
    expect(r).toMatchObject({ ok: true, valeur: { montant: null, numero: null } })
  })

  it('refuse une date absente, impossible ou future', () => {
    expect(validerSaisie(saisie({ dateFacture: '' }), LAVEUR, maintenant).ok).toBe(false)
    expect(validerSaisie(saisie({ dateFacture: '2026-02-30' }), LAVEUR, maintenant).ok).toBe(false)
    expect(validerSaisie(saisie({ dateFacture: '2026-12-01' }), LAVEUR, maintenant).ok).toBe(false)
  })

  it('refuse un fichier d’un autre laveur, un format ou une taille hors limites', () => {
    expect(validerSaisie(saisie({ chemin: `${AUTRE}/${FICHIER}.pdf` }), LAVEUR, maintenant).ok).toBe(false)
    expect(validerSaisie(saisie({ typeFichier: 'text/html' }), LAVEUR, maintenant).ok).toBe(false)
    expect(validerSaisie(saisie({ taille: 20 * 1024 * 1024 }), LAVEUR, maintenant).ok).toBe(false)
    expect(validerSaisie(saisie({ montant: -5 }), LAVEUR, maintenant).ok).toBe(false)
  })
})

describe('extensionStockage', () => {
  it('seulement PDF, JPG et PNG', () => {
    expect(extensionStockage('application/pdf')).toBe('pdf')
    expect(extensionStockage('image/jpeg')).toBe('jpg')
    expect(extensionStockage('image/svg+xml')).toBeNull()
  })
})
