import { describe, it, expect } from 'vitest'
import { pourLeNavigateur, COLONNES_SERVEUR } from './washerNavigateur'

const fiche = {
  id: 'w1', name: 'Laveur', slug: 'laveur', base_address: '1 rue X',
  google_refresh_token: 'jeton-google', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', cgv_acceptees_ip: '203.0.113.1',
} as never

describe('pourLeNavigateur', () => {
  it('retire toutes les colonnes serveur', () => {
    const w = pourLeNavigateur(fiche) as Record<string, unknown>
    for (const c of COLONNES_SERVEUR) expect(c in w).toBe(false)
    const texte = JSON.stringify(w)
    for (const v of ['jeton-google', 'cus_1', 'sub_1', '203.0.113.1']) expect(texte).not.toContain(v)
  })

  it('garde le reste et indique si Google Agenda est connecté', () => {
    const w = pourLeNavigateur(fiche)
    expect(w.name).toBe('Laveur')
    expect(w.google_agenda_connecte).toBe(true)
    expect(pourLeNavigateur({ ...(fiche as object), google_refresh_token: null } as never).google_agenda_connecte).toBe(false)
  })

  it('ne modifie pas la fiche d’origine', () => {
    const origine = { ...(fiche as object) } as Record<string, unknown>
    pourLeNavigateur(origine as never)
    expect(origine.google_refresh_token).toBe('jeton-google')
  })
})
