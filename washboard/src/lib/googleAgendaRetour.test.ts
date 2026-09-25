import { describe, expect, it } from 'vitest'
import { destinationRetourGoogle, etatConnexionGoogle, retourVersAgenda } from './googleAgendaRetour'

describe('retour de la connexion Google Agenda', () => {
  it('le site garde ses adresses historiques', () => {
    expect(destinationRetourGoogle('https://x.fr', false, 'ok')).toBe('https://x.fr/dashboard/admin?tab=identite&success=google-calendar')
    expect(destinationRetourGoogle('https://x.fr', false, 'erreur')).toBe('https://x.fr/dashboard/admin?error=google-calendar')
    expect(destinationRetourGoogle('https://x.fr', false, 'sans-jeton')).toBe('https://x.fr/dashboard/admin?error=google-calendar-no-token')
  })

  it("l'Agenda de la PWA reçoit l'issue en paramètre", () => {
    expect(destinationRetourGoogle('https://x.fr', true, 'ok')).toBe('https://x.fr/dashboard/calendrier?google=ok')
    expect(destinationRetourGoogle('https://x.fr', true, 'erreur')).toBe('https://x.fr/dashboard/calendrier?google=erreur')
    expect(destinationRetourGoogle('https://x.fr', true, 'sans-jeton')).toBe('https://x.fr/dashboard/calendrier?google=sans-jeton')
  })

  it("le choix voyage dans l'état et s'y relit", () => {
    const hex = 'ab12'.repeat(16)
    expect(etatConnexionGoogle(hex, false)).toBe(hex)
    expect(retourVersAgenda(etatConnexionGoogle(hex, false))).toBe(false)
    expect(retourVersAgenda(etatConnexionGoogle(hex, true))).toBe(true)
  })
})
