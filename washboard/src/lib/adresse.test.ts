import { describe, expect, it } from 'vitest'
import { villeDepuisAdresse } from '@/lib/adresse'

describe('villeDepuisAdresse', () => {
  it('lit la ville d’une adresse Google complète', () => {
    expect(villeDepuisAdresse("52 Rue d'Enghien, Eaubonne, France")).toBe('Eaubonne')
    expect(villeDepuisAdresse('8 Rue des Lilas, Maffliers, France')).toBe('Maffliers')
  })

  it('retire le code postal', () => {
    expect(villeDepuisAdresse("52 Rue d'Enghien, 95600 Eaubonne, France")).toBe('Eaubonne')
    expect(villeDepuisAdresse('3 allée des Pins, 33600 Pessac, France')).toBe('Pessac')
  })

  it('accepte un autre pays', () => {
    expect(villeDepuisAdresse('Rue Neuve 12, Bruxelles, Belgique')).toBe('Bruxelles')
  })

  it('garde les villes composées', () => {
    expect(villeDepuisAdresse('1 rue du Port, Saint-Étienne, France')).toBe('Saint-Étienne')
  })

  it('sans pays, prend le dernier segment', () => {
    expect(villeDepuisAdresse('12 avenue Foch, Mérignac')).toBe('Mérignac')
  })

  // Le point important : ne jamais inventer.
  it('renvoie null quand la ville ne se lit pas', () => {
    expect(villeDepuisAdresse('Eaubonne')).toBeNull()
    expect(villeDepuisAdresse("52 Rue d'Enghien")).toBeNull()
    expect(villeDepuisAdresse('chez le client, derrière l’église')).toBeNull()
    expect(villeDepuisAdresse('12 rue des Fleurs, France')).toBeNull()
    expect(villeDepuisAdresse('rue X, 95600')).toBeNull()
    expect(villeDepuisAdresse('')).toBeNull()
    expect(villeDepuisAdresse(null)).toBeNull()
    expect(villeDepuisAdresse(undefined)).toBeNull()
  })
})
