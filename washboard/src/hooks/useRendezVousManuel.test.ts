import { describe, it, expect } from 'vitest'
import { lieuDuRendezVous } from './useRendezVousManuel'

const centre = { adresse: '8 avenue Foch, 69006 Lyon', domicile: true }
const saisie = { address: '12 rue de la Paix, 75001 Paris', lat: 48.87, lng: 2.33 }

describe('lieuDuRendezVous', () => {
  it('à domicile : garde l’adresse et les coordonnées saisies', () => {
    expect(lieuDuRendezVous({ ...saisie, lieu: 'domicile' }, centre))
      .toEqual({ lieu: 'domicile', address: saisie.address, lat: 48.87, lng: 2.33 })
  })

  it('au centre : adresse du centre, sans coordonnées', () => {
    expect(lieuDuRendezVous({ ...saisie, lieu: 'centre' }, centre))
      .toEqual({ lieu: 'centre', address: centre.adresse, lat: null, lng: null })
  })

  it('au centre sans adresse saisie : l’adresse du centre suffit', () => {
    expect(lieuDuRendezVous({ address: '', lat: null, lng: null, lieu: 'centre' }, centre).address).toBe(centre.adresse)
  })

  it('sans centre proposé : toujours à domicile', () => {
    expect(lieuDuRendezVous({ ...saisie, lieu: 'centre' }, null))
      .toEqual({ lieu: 'domicile', address: saisie.address, lat: 48.87, lng: 2.33 })
  })
})
