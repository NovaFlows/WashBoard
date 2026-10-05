import { describe, expect, it } from 'vitest'
import { semaineAccueil } from './semaineAccueil'

// Jeudi 2026-10-01 (une semaine quelconque, choisie pour ne pas tomber sur
// un lundi ou un dimanche — ça forcerait un biais dans les tests d'ordre).
const AUJOURDHUI = '2026-10-01'
const LUNDI = '2026-09-28'
const MARDI = '2026-09-29'
const MERCREDI = '2026-09-30'
const VENDREDI = '2026-10-02'
const SAMEDI = '2026-10-03'
const DIMANCHE = '2026-10-04'

const rdv = (jour: string, heure: string, status: 'pending' | 'confirmed' | 'cancelled' | 'done') => ({
  scheduled_at: `${jour}T${heure}:00Z`,
  status,
})

describe('semaineAccueil', () => {
  it('rend les sept jours de lundi à dimanche, dans cet ordre', () => {
    const jours = semaineAccueil([], AUJOURDHUI, null)
    expect(jours.map(j => j.jour)).toEqual([LUNDI, MARDI, MERCREDI, AUJOURDHUI, VENDREDI, SAMEDI, DIMANCHE])
    expect(jours.map(j => j.lettre)).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D'])
  })

  it('marque aujourd’hui, et lui seul', () => {
    const jours = semaineAccueil([], AUJOURDHUI, null)
    expect(jours.filter(j => j.aujourdhui).map(j => j.jour)).toEqual([AUJOURDHUI])
  })

  it('un jour sans rendez-vous est vide quand aucun jour n’est marqué fermé', () => {
    const jours = semaineAccueil([], AUJOURDHUI, null)
    expect(jours.every(j => j.etat === 'vide')).toBe(true)
  })

  it('un jour avec un rendez-vous confirmé devient "confirme"', () => {
    const jours = semaineAccueil([rdv(MARDI, '10:00', 'confirmed')], AUJOURDHUI, null)
    expect(jours.find(j => j.jour === MARDI)?.etat).toBe('confirme')
  })

  it('un rendez-vous déjà terminé compte comme "confirme" — le travail a bien eu lieu', () => {
    const jours = semaineAccueil([rdv(LUNDI, '09:00', 'done')], AUJOURDHUI, null)
    expect(jours.find(j => j.jour === LUNDI)?.etat).toBe('confirme')
  })

  it('un jour avec une demande en attente devient "attente"', () => {
    const jours = semaineAccueil([rdv(VENDREDI, '10:00', 'pending')], AUJOURDHUI, null)
    expect(jours.find(j => j.jour === VENDREDI)?.etat).toBe('attente')
  })

  it('"attente" prime sur "confirme" quand un jour a les deux', () => {
    const jours = semaineAccueil(
      [rdv(VENDREDI, '10:00', 'confirmed'), rdv(VENDREDI, '15:00', 'pending')],
      AUJOURDHUI,
      null,
    )
    expect(jours.find(j => j.jour === VENDREDI)?.etat).toBe('attente')
  })

  it('un rendez-vous annulé ne compte jamais, même seul sur son jour', () => {
    const jours = semaineAccueil([rdv(SAMEDI, '10:00', 'cancelled')], AUJOURDHUI, null)
    expect(jours.find(j => j.jour === SAMEDI)?.etat).toBe('vide')
  })

  it('un jour sans plage d’horaires devient "ferme" quand joursOuverts est fourni', () => {
    // Dimanche (0) et samedi (6) absents : fermé le week-end.
    const joursOuverts = new Set([1, 2, 3, 4, 5])
    const jours = semaineAccueil([], AUJOURDHUI, joursOuverts)
    expect(jours.find(j => j.jour === SAMEDI)?.etat).toBe('ferme')
    expect(jours.find(j => j.jour === DIMANCHE)?.etat).toBe('ferme')
    expect(jours.find(j => j.jour === MARDI)?.etat).toBe('vide')
  })

  it('un rendez-vous l’emporte sur la fermeture — un jour fermé peut quand même avoir un rendez-vous', () => {
    const joursOuverts = new Set([1, 2, 3, 4, 5])
    const jours = semaineAccueil([rdv(SAMEDI, '10:00', 'confirmed')], AUJOURDHUI, joursOuverts)
    expect(jours.find(j => j.jour === SAMEDI)?.etat).toBe('confirme')
  })

  it('joursOuverts = null ne marque jamais un jour fermé, même sans aucune plage', () => {
    const jours = semaineAccueil([], AUJOURDHUI, new Set())
    // Avec un ensemble VIDE (information lue, mais aucun jour ouvert) : tout est fermé.
    expect(jours.every(j => j.etat === 'ferme')).toBe(true)
    const sansInfo = semaineAccueil([], AUJOURDHUI, null)
    // Sans l'information (non lue) : jamais de fermeture devinée.
    expect(sansInfo.every(j => j.etat === 'vide')).toBe(true)
  })

  it('un rendez-vous hors de la semaine en cours n’est rangé sur aucun jour', () => {
    const jours = semaineAccueil([rdv('2026-10-10', '10:00', 'confirmed')], AUJOURDHUI, null)
    expect(jours.every(j => j.etat === 'vide')).toBe(true)
  })

  it('fonctionne quand aujourd’hui est un dimanche (fin de semaine)', () => {
    const jours = semaineAccueil([], DIMANCHE, null)
    expect(jours.map(j => j.jour)).toEqual([LUNDI, MARDI, MERCREDI, AUJOURDHUI, VENDREDI, SAMEDI, DIMANCHE])
    expect(jours[6].aujourdhui).toBe(true)
  })
})
