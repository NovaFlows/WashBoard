import { describe, it, expect } from 'vitest'
import { estCreneauPasse, doitDemanderConfirmation } from './cloture'

const MAINTENANT = new Date('2026-09-16T12:00:00Z')
const passe = '2026-09-15T10:00:00Z'
const futur = '2026-09-20T10:00:00Z'

describe('estCreneauPasse', () => {
  it('hier est passé, la semaine prochaine non', () => {
    expect(estCreneauPasse(passe, MAINTENANT)).toBe(true)
    expect(estCreneauPasse(futur, MAINTENANT)).toBe(false)
  })

  it('une date illisible n’est jamais « passée » : on ne demande rien plutôt que de demander à tort', () => {
    expect(estCreneauPasse('pas une date', MAINTENANT)).toBe(false)
  })
})

describe('doitDemanderConfirmation', () => {
  it('créneau passé, resté en attente ou confirmé : on demande', () => {
    expect(doitDemanderConfirmation({ status: 'pending', scheduled_at: passe }, MAINTENANT)).toBe(true)
    expect(doitDemanderConfirmation({ status: 'confirmed', scheduled_at: passe }, MAINTENANT)).toBe(true)
  })

  it('rendez-vous à venir : on clôture d’un clic, sans question', () => {
    // Le laveur qui finit en avance ne doit pas subir un clic de plus.
    expect(doitDemanderConfirmation({ status: 'confirmed', scheduled_at: futur }, MAINTENANT)).toBe(false)
    expect(doitDemanderConfirmation({ status: 'pending', scheduled_at: futur }, MAINTENANT)).toBe(false)
  })

  it('déjà terminé ou annulé : rien à demander', () => {
    expect(doitDemanderConfirmation({ status: 'done', scheduled_at: passe }, MAINTENANT)).toBe(false)
    expect(doitDemanderConfirmation({ status: 'cancelled', scheduled_at: passe }, MAINTENANT)).toBe(false)
  })
})
