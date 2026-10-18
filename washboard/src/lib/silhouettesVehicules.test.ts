import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TYPES_AVEC_SILHOUETTE, silhouettePour } from './silhouettesVehicules'
import { VEHICLE_LABELS } from './vehicle-labels'

const fichier = (url: string) => join(process.cwd(), 'public', decodeURIComponent(url.split('?')[0]))

describe('images des véhicules', () => {
  it('chaque véhicule photographié a son image', () => {
    for (const type of ['citadine', 'citadine_2p', 'berline', 'SUV', 'monospace', '7places', 'utilitaire', 'moto', 'camion']) {
      expect(silhouettePour(type), type).not.toBeNull()
    }
  })
  it('un type sans photo ou personnalisé par le laveur n’en a pas', () => {
    expect(silhouettePour('scooter')).toBeNull()
    expect(silhouettePour('3f2a9c0e-1b2c-4d5e-8f90-123456789abc')).toBeNull()
    expect(silhouettePour(null)).toBeNull()
    expect(silhouettePour('toString')).toBeNull()
  })
  it('chaque image existe, est un WebP, pour un type connu de l’app', () => {
    for (const type of TYPES_AVEC_SILHOUETTE) {
      expect(VEHICLE_LABELS[type], type).toBeDefined()
      const chemin = fichier(silhouettePour(type)!)
      expect(existsSync(chemin), chemin).toBe(true)
      const entete = readFileSync(chemin).subarray(0, 12).toString('latin1')
      expect(entete.startsWith('RIFF') && entete.endsWith('WEBP'), chemin).toBe(true)
    }
  })
})
