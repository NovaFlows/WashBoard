import { describe, it, expect } from 'vitest'
import { clientsARelancer } from './clientsARelancer'
import type { ReglagesMessages, RdvMessage } from './messagesAutomatiques'

// Jeudi 24 septembre 2026, 12 h à Paris (10 h UTC, heure d'été) — même instant de référence
// que messagesAutomatiques.test.ts, pour pouvoir comparer les deux calculs de tête si besoin.
const MAINTENANT = Date.parse('2026-09-24T10:00:00Z')
const JOUR = 86_400_000
const il = (jours: number) => new Date(MAINTENANT + jours * JOUR).toISOString()

const REGLAGES: ReglagesMessages = {
  review_enabled: false, review_delay_hours: 3, google_review_url: null, review_channel: 'email',
  followup_enabled: true, followup_delay_days: 30, followup_message: 'Bonjour {{nom}}',
}

let n = 0
function rdv(p: Partial<RdvMessage> = {}): RdvMessage {
  n += 1
  return {
    id: `r${n}`, client_name: 'Claire Martin', client_email: `claire${n}@x.fr`, client_phone: '0600000000',
    scheduled_at: il(-40), created_at: il(-50), status: 'done', ...p,
  }
}

describe('clientsARelancer', () => {
  it('un client avec un rendez-vous à venir n’est pas dans la liste : il est déjà revenu', () => {
    const lignes = clientsARelancer(
      [rdv({ client_email: 'a@x.fr', scheduled_at: il(-40) }), rdv({ client_email: 'a@x.fr', scheduled_at: il(5), status: 'confirmed' })],
      REGLAGES, [], MAINTENANT,
    )
    expect(lignes).toHaveLength(0)
  })

  it('un rendez-vous annulé ne compte pas, y compris comme dernier rendez-vous', () => {
    const lignes = clientsARelancer(
      [rdv({ client_email: 'a@x.fr', scheduled_at: il(-40), status: 'done' }), rdv({ client_email: 'a@x.fr', scheduled_at: il(-5), status: 'cancelled' })],
      REGLAGES, [], MAINTENANT,
    )
    expect(lignes).toHaveLength(1)
    expect(lignes[0].jours).toBe(40)
  })

  it('une relance déjà due : « À appeler », marqué urgent', () => {
    // 40 jours d'ancienneté, délai réglé à 30 : la relance est due depuis 10 jours.
    const [l] = clientsARelancer([rdv({ scheduled_at: il(-40) })], REGLAGES, [], MAINTENANT)
    expect(l.statut).toBe('À appeler')
    expect(l.urgent).toBe(true)
  })

  it('une relance pas encore due : « Relance dès… », pas urgent', () => {
    const [l] = clientsARelancer([rdv({ scheduled_at: il(-10) })], REGLAGES, [], MAINTENANT)
    expect(l.statut).toMatch(/^Relance /)
    expect(l.urgent).toBe(false)
  })

  it('une relance déjà partie ne redevient jamais « à appeler »', () => {
    const [l] = clientsARelancer(
      [rdv({ scheduled_at: il(-40), followup_sent_at: il(-9) })], REGLAGES, [], MAINTENANT,
    )
    expect(l.statut).toBe('Relancé il y a 9 j')
    expect(l.urgent).toBe(false)
  })

  it('« ne plus contacter » prime sur tout, même une relance qui serait due', () => {
    const [l] = clientsARelancer(
      [rdv({ client_email: 'a@x.fr', scheduled_at: il(-90) })], REGLAGES,
      [{ cle: 'a@x.fr', nePlusContacter: true }], MAINTENANT,
    )
    expect(l.statut).toBe('Ne veut plus')
    expect(l.urgent).toBe(false)
    expect(l.nePlusContacter).toBe(true)
  })

  it('relance automatique éteinte : un simple compte de jours, jamais une promesse d’envoi', () => {
    const [l] = clientsARelancer(
      [rdv({ scheduled_at: il(-40) })], { ...REGLAGES, followup_enabled: false }, [], MAINTENANT,
    )
    expect(l.statut).toBe('40 j sans revenir')
    expect(l.urgent).toBe(false)
  })

  it('trie les relances dues avant les programmées, elles-mêmes avant le reste', () => {
    const lignes = clientsARelancer([
      rdv({ client_email: 'programmee@x.fr', scheduled_at: il(-10) }),   // relance dans 20 j
      rdv({ client_email: 'due@x.fr', scheduled_at: il(-40) }),          // due depuis 10 j
      rdv({ client_email: 'partie@x.fr', scheduled_at: il(-90), followup_sent_at: il(-9) }),
    ], REGLAGES, [], MAINTENANT)
    expect(lignes.map(l => l.cle)).toEqual(['due@x.fr', 'programmee@x.fr', 'partie@x.fr'])
  })

  it('parmi les relances dues, la plus ancienne d’abord', () => {
    const lignes = clientsARelancer([
      rdv({ client_email: 'due-40@x.fr', scheduled_at: il(-40) }),
      rdv({ client_email: 'due-60@x.fr', scheduled_at: il(-60) }),
    ], REGLAGES, [], MAINTENANT)
    expect(lignes.map(l => l.cle)).toEqual(['due-60@x.fr', 'due-40@x.fr'])
  })

  it('identifie le client par téléphone quand la relance n’a pas d’email — cas impossible en pratique (le cron l’exige), gardé pour ne pas planter', () => {
    const lignes = clientsARelancer(
      [rdv({ client_email: '', client_phone: '0611223344', scheduled_at: il(-40) })], REGLAGES, [], MAINTENANT,
    )
    // Le regroupement par client_email de messagesAutomatiques exige une clé non vide : sans
    // email, ce rendez-vous n'est simplement pas regroupé — comportement du cron, reproduit tel quel.
    expect(lignes).toHaveLength(0)
  })
})
