import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TYPES_AVEC_SILHOUETTE, silhouettePour } from './silhouettesVehicules'
import { VEHICLE_LABELS } from './vehicle-labels'

const fichier = (url: string) => join(process.cwd(), 'public', decodeURIComponent(url.split('?')[0]))

describe('silhouettes des véhicules', () => {
  it('chaque type de véhicule de l’app a sa silhouette', () => {
    for (const type of Object.keys(VEHICLE_LABELS)) expect(silhouettePour(type), type).not.toBeNull()
  })
  it('un type personnalisé par le laveur n’en a pas', () => {
    expect(silhouettePour('3f2a9c0e-1b2c-4d5e-8f90-123456789abc')).toBeNull()
    expect(silhouettePour(null)).toBeNull()
    expect(silhouettePour('toString')).toBeNull()
  })
  it('les deux fichiers de chaque silhouette existent, dans le repère commun', () => {
    for (const type of TYPES_AVEC_SILHOUETTE) {
      const s = silhouettePour(type)!
      for (const url of [s.face, s.contour]) {
        expect(existsSync(fichier(url)), url).toBe(true)
        expect(readFileSync(fichier(url), 'utf8')).toContain('viewBox="-20 -10 1040 420"')
      }
    }
  })
})
