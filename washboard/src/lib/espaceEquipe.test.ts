import { describe, it, expect } from 'vitest'
import { SANS_RESPONSABLE, contenuMembre, membreDepuisSlug, resumerEquipe, resumerMembre, slugMembre } from './espaceEquipe'
import { validerSaisie, type Prospect } from './prospects'
import type { LaveurResume } from './resumeLaveurs'

const NOW = new Date('2026-11-09T12:00:00Z')

const prospect = (p: Partial<Prospect> = {}): Prospect => ({
  id: 'p1', instagram: 'laveur.exemple', nom: 'Laveur Exemple', ville: null, telephone: null, statut: 'contacte', source: 'instagram',
  message: null, reponse: null, notes: null, contacte_le: '2026-11-08T10:00:00Z', repondu_le: null, relancer_le: null,
  created_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T10:00:00Z', responsable: null, ...p,
})
const laveur = (l: Partial<LaveurResume> = {}): LaveurResume => ({
  id: 'l1', name: 'Laveur', slug: 'laveur', phone: null, creeLe: '2026-10-01T00:00:00Z', statut: 'En essai', statutDetail: null, ton: 'ok', priorite: 2,
  pagePrete: true, enEssai: true, payant: false, source: null, visites30: 0, reservations30: 0, chiffre30: 0, reservations24h: 0, reservations24hEnLigne: 0,
  derniereConnexion: null, relance: null, responsable: null, dernierAppel: null, ...l,
})

describe('membres', () => {
  it('l’adresse d’un membre est son prénom sans majuscule', () => {
    expect(slugMembre('Alexandre')).toBe('alexandre')
    expect(membreDepuisSlug('yanis')).toBe('Yanis')
    expect(membreDepuisSlug(SANS_RESPONSABLE)).toBe(SANS_RESPONSABLE)
    expect(membreDepuisSlug('inconnu')).toBeNull()
  })
})

describe('resumerMembre', () => {
  const laveurs = [
    laveur({ id: 'a', responsable: 'Ryan', relance: { le: '2026-11-09', action: null, appelId: 'x', mise: true } }),
    laveur({ id: 'b', responsable: 'Ryan', relance: { le: '2026-11-12', action: null, appelId: 'y', mise: true } }),
    laveur({ id: 'c', responsable: 'Yanis' }),
    laveur({ id: 'd', responsable: null }),
  ]
  const prospects = [
    prospect({ id: '1', responsable: 'Ryan', statut: 'a_repondu' }),
    prospect({ id: '2', responsable: 'Ryan', statut: 'en_discussion', relancer_le: '2026-11-08' }),
    prospect({ id: '3', responsable: 'Ryan', statut: 'pas_interesse' }),
    prospect({ id: '4', responsable: 'Alexandre', statut: 'interesse', relancer_le: '2026-11-20' }),
    prospect({ id: '5', responsable: null, statut: 'a_vu' }),
  ]
  it('compte ses laveurs, ses prospects en cours, ses rappels dus et ses réponses à trier', () => {
    expect(resumerMembre('Ryan', laveurs, prospects, NOW)).toEqual({ membre: 'Ryan', laveurs: 2, prospects: 2, aRappeler: 2, aTrier: 1 })
    expect(resumerMembre('Alexandre', laveurs, prospects, NOW)).toEqual({ membre: 'Alexandre', laveurs: 0, prospects: 1, aRappeler: 0, aTrier: 0 })
  })
  it('« à répartir » regroupe ceux que personne ne suit', () => {
    expect(resumerMembre(SANS_RESPONSABLE, laveurs, prospects, NOW)).toMatchObject({ laveurs: 1, prospects: 1 })
  })
  it('« à répartir » n’apparaît que s’il reste quelqu’un', () => {
    expect(resumerEquipe(laveurs, prospects, NOW).map(r => r.membre)).toEqual(['Alexandre', 'Ryan', 'Yanis', SANS_RESPONSABLE])
    const tous = [laveur({ responsable: 'Yanis' })]
    expect(resumerEquipe(tous, [prospect({ responsable: 'Ryan' }), prospect({ id: '9', responsable: null, statut: 'pas_interesse' })], NOW).map(r => r.membre)).toEqual(['Alexandre', 'Ryan', 'Yanis'])
  })
})

describe('contenuMembre', () => {
  it('range les réponses à trier, puis les rappels dus, puis le reste', () => {
    const prospects = [
      prospect({ id: 'vu', responsable: 'Ryan', statut: 'a_vu' }),
      prospect({ id: 'rappel', responsable: 'Ryan', statut: 'en_discussion', relancer_le: '2026-11-09' }),
      prospect({ id: 'reponse', responsable: 'Ryan', statut: 'a_repondu' }),
      prospect({ id: 'autre', responsable: 'Yanis', statut: 'a_repondu' }),
    ]
    expect(contenuMembre('Ryan', [], prospects, NOW).prospects.map(p => p.id)).toEqual(['reponse', 'rappel', 'vu'])
  })
})

describe('validerSaisie : responsable', () => {
  it('accepte un membre, ou personne', () => {
    expect(validerSaisie({ responsable: 'Ryan' }, false)).toEqual({ champs: { responsable: 'Ryan' } })
    expect(validerSaisie({ responsable: null }, false)).toEqual({ champs: { responsable: null } })
    expect(validerSaisie({ responsable: '' }, false)).toEqual({ champs: { responsable: null } })
  })
  it('refuse quelqu’un d’autre', () => {
    expect(validerSaisie({ responsable: 'Paul' }, false)).toHaveProperty('erreur')
  })
  it('ne touche pas à l’affiliation si elle n’est pas envoyée', () => {
    expect(validerSaisie({ notes: 'x' }, false)).toEqual({ champs: { notes: 'x' } })
  })
})
