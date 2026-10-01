import { describe, it, expect } from 'vitest'
import { estCreneauPasse, doitDemanderConfirmation, statutAffiche } from './cloture'

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

describe('statutAffiche — ce que la PWA montre', () => {
  const FIN_PASSEE = new Date('2026-09-26T15:00:00Z')
  const rdv = (extra: Record<string, unknown> = {}) => ({
    status: 'confirmed' as const,
    scheduled_at: '2026-09-26T08:00:00Z',
    services: { duration_minutes: 90 },
    ...extra,
  })

  it('un rendez-vous fait porte « Terminé », même clôturé en retard', () => {
    expect(statutAffiche({ ...rdv({ status: 'done' }) }, FIN_PASSEE)).toBe('done')
  })

  it('un créneau fini, ni clôturé ni annulé, demande une action', () => {
    expect(statutAffiche(rdv(), FIN_PASSEE)).toBe('a_cloturer')
    expect(statutAffiche(rdv({ status: 'pending' }), FIN_PASSEE)).toBe('a_cloturer')
  })

  it('un lavage EN COURS n’est pas en retard : on attend la fin du créneau', () => {
    // 08:00 + 1h30 = 09:30 ; il est 09:00.
    expect(statutAffiche(rdv(), new Date('2026-09-26T07:00:00Z'))).toBe('confirmed')
    expect(statutAffiche(rdv(), new Date('2026-09-26T09:31:00Z'))).toBe('a_cloturer')
  })

  it('compte les options et les véhicules dans la durée', () => {
    const deuxVehicules = rdv({ vehicle_count: 2, selected_addons: [{ duration_minutes: 30 }] })
    // (90 + 30) × 2 = 4 h → fini à 12:00.
    expect(statutAffiche(deuxVehicules, new Date('2026-09-26T11:00:00Z'))).toBe('confirmed')
    expect(statutAffiche(deuxVehicules, new Date('2026-09-26T12:01:00Z'))).toBe('a_cloturer')
  })

  it('durée inconnue : une heure', () => {
    const sansDuree = { status: 'confirmed' as const, scheduled_at: '2026-09-26T08:00:00Z' }
    expect(statutAffiche(sansDuree, new Date('2026-09-26T08:30:00Z'))).toBe('confirmed')
    expect(statutAffiche(sansDuree, new Date('2026-09-26T09:30:00Z'))).toBe('a_cloturer')
  })

  it('annulé reste annulé', () => {
    expect(statutAffiche(rdv({ status: 'cancelled' }), FIN_PASSEE)).toBe('cancelled')
  })
})
