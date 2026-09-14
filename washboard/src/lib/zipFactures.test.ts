import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
import { extraireZip, extension } from './zipFactures'

describe('extraireZip', () => {
  it('garde les PDF, JPG et PNG, même rangés dans des dossiers', () => {
    const zip = zipSync({
      'factures/mars/facture-2026-03-12.pdf': strToU8('%PDF-1.4 facture'),
      'photo.JPG': strToU8('jpeg'),
      'logo.png': strToU8('png'),
    })
    const { fichiers, ignores } = extraireZip(zip)
    expect(fichiers.map(f => [f.nom, f.type]).sort()).toEqual([
      ['facture-2026-03-12.pdf', 'application/pdf'],
      ['logo.png', 'image/png'],
      ['photo.JPG', 'image/jpeg'],
    ])
    expect(ignores).toEqual([])
  })

  it('écarte les autres formats en le disant, et les fichiers système sans bruit', () => {
    const zip = zipSync({
      'compta.xlsx': strToU8('x'),
      '__MACOSX/._facture.pdf': strToU8('x'),
      '.DS_Store': strToU8('x'),
      'facture.pdf': strToU8('%PDF'),
    })
    const { fichiers, ignores } = extraireZip(zip)
    expect(fichiers.map(f => f.nom)).toEqual(['facture.pdf'])
    expect(ignores).toEqual(['compta.xlsx : format non accepté'])
  })

  it('refuse un fichier de plus de 10 Mo', () => {
    const gros = new Uint8Array(10 * 1024 * 1024 + 1)
    const { fichiers, ignores } = extraireZip(zipSync({ 'gros.pdf': gros, 'petit.pdf': strToU8('%PDF') }, { level: 1 }))
    expect(fichiers.map(f => f.nom)).toEqual(['petit.pdf'])
    expect(ignores).toEqual(['gros.pdf : plus de 10 Mo'])
  })
})

describe('extension', () => {
  it('en minuscules, vide si absente', () => {
    expect(extension('Facture.PDF')).toBe('pdf')
    expect(extension('sans-extension')).toBe('')
  })
})
