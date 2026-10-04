import { describe, it, expect } from 'vitest'
import { resumePublicites } from './resumePublicites'

// ─────────────────────────────────────────────────────────────────────────────
// Le texte sous « Publicités » dans la liste des Automatismes. Une ligne de
// liste se lit en une demi-seconde, sans s'arrêter : elle doit dire la seule
// chose qui demande une action, ou se taire.
// ─────────────────────────────────────────────────────────────────────────────

const MAINTENANT = new Date('2026-10-03T12:00:00Z').getTime()
const AUJOURD_HUI = '2026-10-03'

describe('resumePublicites', () => {
  it('invite, plutôt que d’annoncer un vide', () => {
    // « 0 campagne » ne donne envie de rien. La ligne dit ce qu'on y gagne.
    expect(resumePublicites([], AUJOURD_HUI, MAINTENANT))
      .toEqual({ texte: 'Savoir ce que vos publicités vous rapportent' })
  })

  it('compte les campagnes et celles qui tournent', () => {
    const r = resumePublicites([
      { debut: '2026-09-01', fin: null, budget_maj_le: '2026-10-02T12:00:00Z' },
      { debut: '2026-05-01', fin: '2026-06-01', budget_maj_le: '2026-10-02T12:00:00Z' },
    ], AUJOURD_HUI, MAINTENANT)
    expect(r).toEqual({ texte: '2 campagnes · 1 en cours' })
  })

  it('accorde le singulier', () => {
    expect(resumePublicites([
      { debut: '2026-09-01', fin: null, budget_maj_le: '2026-10-02T12:00:00Z' },
    ], AUJOURD_HUI, MAINTENANT)).toEqual({ texte: '1 campagne · 1 en cours' })
  })

  it('dit quand plus aucune ne tourne', () => {
    expect(resumePublicites([
      { debut: '2026-01-01', fin: '2026-02-01', budget_maj_le: '2026-10-02T12:00:00Z' },
    ], AUJOURD_HUI, MAINTENANT)).toEqual({ texte: '1 campagne · aucune en cours' })
  })

  it('fait passer un budget à actualiser DEVANT le décompte', () => {
    // Entre « 3 campagnes » et « un budget à actualiser », seul le second
    // demande quelque chose. C'est le seul cas où la ligne doit attirer l'œil.
    const r = resumePublicites([
      { debut: '2026-07-01', fin: null, budget_maj_le: '2026-08-01T12:00:00Z' },
      { debut: '2026-09-01', fin: null, budget_maj_le: '2026-10-02T12:00:00Z' },
    ], AUJOURD_HUI, MAINTENANT)
    expect(r).toEqual({ texte: 'Un budget à actualiser', ton: 'ambre' })
  })

  it('accorde le pluriel des budgets', () => {
    const vieux = '2026-08-01T12:00:00Z'
    const r = resumePublicites([
      { debut: '2026-07-01', fin: null, budget_maj_le: vieux },
      { debut: '2026-07-01', fin: null, budget_maj_le: vieux },
    ], AUJOURD_HUI, MAINTENANT)
    expect(r).toEqual({ texte: '2 budgets à actualiser', ton: 'ambre' })
  })

  it('n’alerte pas sur une campagne terminée', () => {
    // Son budget est définitif : réclamer une mise à jour serait du bruit, et
    // une ligne qui crie pour rien finit par ne plus être lue.
    expect(resumePublicites([
      { debut: '2026-01-01', fin: '2026-02-01', budget_maj_le: '2026-01-01T12:00:00Z' },
    ], AUJOURD_HUI, MAINTENANT)).toEqual({ texte: '1 campagne · aucune en cours' })
  })

  it('reste muet quand la date de saisie est inconnue', () => {
    // Campagne antérieure à la migration 009 : on ne sait pas, donc on
    // n'invente pas une alerte.
    expect(resumePublicites([
      { debut: '2026-01-01', fin: null, budget_maj_le: null },
    ], AUJOURD_HUI, MAINTENANT)).toEqual({ texte: '1 campagne · 1 en cours' })
  })
})
