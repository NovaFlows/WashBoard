import { describe, it, expect } from 'vitest'
import { construireArbre, type LigneParrainage } from './arbreParrainage'

const NOW = new Date('2026-12-20T10:00:00.000Z')
const laveur = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: id, subscription_status: 'active', ...extra })
const ligne = (id: string, parrain: ReturnType<typeof laveur>, filleul: ReturnType<typeof laveur>, extra: Partial<LigneParrainage> = {}): LigneParrainage =>
  ({ id, cree_le: '2026-11-20T10:00:00.000Z', ip_inscription: null, recompense_le: null, recompense_forme: null, parrain, filleul, ...extra })

describe('construireArbre', () => {
  it('plusieurs niveaux : Bell Auto → CleanCar → LavMobile', () => {
    const bell = laveur('Bell'), clean = laveur('Clean'), lav = laveur('Lav', { subscription_status: 'trial', trial_ends_at: '2027-01-01T00:00:00Z' })
    const arbre = construireArbre([
      ligne('1', bell, clean, { recompense_le: '2026-12-01T00:00:00Z', recompense_forme: 'abonnement' }),
      ligne('2', clean, lav),
    ], NOW)
    expect(arbre.total).toBe(2)
    expect(arbre.recompenses).toBe(1)
    expect(arbre.racines).toHaveLength(1)
    expect(arbre.racines[0].nom).toBe('Bell')
    expect(arbre.racines[0].moisGagnes).toBe(1)
    expect(arbre.racines[0].filleuls[0].nom).toBe('Clean')
    expect(arbre.racines[0].filleuls[0].filleuls[0]).toMatchObject({ nom: 'Lav', statut: 'essai' })
  })

  it('signale même connexion et même SIRET, sans rien bloquer', () => {
    const bell = laveur('Bell', { cgv_acceptees_ip: '1.2.3.4', facture_siret: '123 456 789 00012' })
    const faux = laveur('Faux', { facture_siret: '12345678900012' })
    const arbre = construireArbre([ligne('1', bell, faux, { ip_inscription: '1.2.3.4' })], NOW)
    expect(arbre.racines[0].filleuls[0].signaux).toEqual(['meme_connexion', 'meme_siret'])
  })

  it('signale plus de 3 mois gagnés en 30 jours', () => {
    const bell = laveur('Bell')
    const lignes = [1, 2, 3, 4].map(i => ligne(String(i), bell, laveur(`F${i}`), { recompense_le: `2026-12-0${i}T00:00:00Z`, recompense_forme: 'abonnement' }))
    const arbre = construireArbre(lignes, NOW)
    expect(arbre.racines[0].moisGagnes).toBe(4)
    expect(arbre.racines[0].filleuls.every(f => f.signaux.includes('recompenses_rapprochees'))).toBe(true)
  })

  it('ignore une ligne dont un compte a disparu', () => {
    expect(construireArbre([ligne('1', laveur('Bell'), null as never)], NOW).total).toBe(0)
  })
})

describe('signaux jugés normaux', () => {
  it('une ligne marquée « C’est normal » ne remonte plus', () => {
    const bell = laveur('Bell', { cgv_acceptees_ip: '1.2.3.4' })
    const arbre = construireArbre([ligne('1', bell, laveur('Faux'), { ip_inscription: '1.2.3.4', signal_ok_le: '2026-12-01T00:00:00Z' })], NOW)
    expect(arbre.racines[0].filleuls[0].signaux).toEqual([])
    expect(arbre.racines[0].filleuls[0].ligneId).toBe('1')
  })
})
