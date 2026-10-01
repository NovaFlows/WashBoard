import { describe, it, expect } from 'vitest'
import {
  libelleCanal, libelleDelaiAvis, libelleDelaiRelance, blocageAvis, avisActif, relanceActive, nombreActifs,
  lienAvisValide, jourRelatif, momentAvis, momentRelance, nomAffiche, relancesPrevues, apercuRelance,
  messagesProgrammes, messagesPartis, relanceEstPartie, aReserveDepuis, messageRelanceSuggere, texteSmsAvis,
  type ReglagesMessages, type RdvMessage, type ContexteMessages,
} from './messagesAutomatiques'

// Jeudi 24 septembre 2026, 12 h à Paris (10 h UTC, heure d'été).
const MAINTENANT = Date.parse('2026-09-24T10:00:00Z')
const JOUR = 86_400_000
const il = (jours: number, heures = 0) => new Date(MAINTENANT + jours * JOUR + heures * 3_600_000).toISOString()

const REGLAGES: ReglagesMessages = {
  review_enabled: true, review_delay_hours: 3, google_review_url: 'https://g.page/r/abc', review_channel: 'email',
  followup_enabled: true, followup_delay_days: 30, followup_message: 'Bonjour {{nom}}',
}
// Réglages où seule la demande d’avis peut partir (les rendez-vous de test, vieux de 40 jours, déclencheraient sinon une relance).
const AVIS_SEUL: ReglagesMessages = { ...REGLAGES, followup_enabled: false }
const PRO: ContexteMessages = { smsAutorise: true }
const ESSENTIEL: ContexteMessages = { smsAutorise: false }

let n = 0
function rdv(p: Partial<RdvMessage> = {}): RdvMessage {
  n += 1
  return {
    id: `r${n}`, client_name: 'Claire Martin', client_email: 'claire@x.fr', client_phone: '0600000000',
    scheduled_at: il(-40), created_at: il(-50), status: 'done', ...p,
  }
}

describe('libellés', () => {
  it('canal', () => {
    expect(libelleCanal('sms')).toBe('SMS')
    expect(libelleCanal('email')).toBe('Email')
  })
  it('délai d’avis : heures, jours, tout de suite', () => {
    expect(libelleDelaiAvis(3)).toBe('3 h après chaque prestation')
    expect(libelleDelaiAvis(0)).toBe('juste après chaque prestation')
    expect(libelleDelaiAvis(24)).toBe('1 jour après chaque prestation')
    expect(libelleDelaiAvis(48)).toBe('2 jours après chaque prestation')
    expect(libelleDelaiAvis(30)).toBe('30 h après chaque prestation')
  })
  it('délai de relance : mois quand le compte est rond, sinon jours', () => {
    expect(libelleDelaiRelance(30)).toBe('1 mois sans nouveau rendez-vous')
    expect(libelleDelaiRelance(90)).toBe('3 mois sans nouveau rendez-vous')
    expect(libelleDelaiRelance(45)).toBe('45 jours sans nouveau rendez-vous')
    expect(libelleDelaiRelance(1)).toBe('1 jour sans nouveau rendez-vous')
    expect(libelleDelaiRelance(NaN)).toBe('3 mois sans nouveau rendez-vous')
  })
})

describe('ce qui peut réellement partir', () => {
  it('l’avis exige un lien', () => {
    expect(blocageAvis({ ...REGLAGES, google_review_url: null }, PRO)).toBe('lien')
    expect(blocageAvis({ ...REGLAGES, google_review_url: '   ' }, PRO)).toBe('lien')
    expect(blocageAvis(REGLAGES, PRO)).toBeNull()
  })
  it('l’avis par SMS exige le plan qui l’autorise', () => {
    expect(blocageAvis({ ...REGLAGES, review_channel: 'sms' }, ESSENTIEL)).toBe('sms')
    expect(blocageAvis({ ...REGLAGES, review_channel: 'sms' }, PRO)).toBeNull()
    expect(blocageAvis({ ...REGLAGES, review_channel: 'email' }, ESSENTIEL)).toBeNull()
  })
  it('avisActif : activé ET sans blocage', () => {
    expect(avisActif(REGLAGES, PRO)).toBe(true)
    expect(avisActif({ ...REGLAGES, review_enabled: false }, PRO)).toBe(false)
    expect(avisActif({ ...REGLAGES, google_review_url: null }, PRO)).toBe(false)
  })
  it('la relance exige un message', () => {
    expect(relanceActive(REGLAGES)).toBe(true)
    expect(relanceActive({ ...REGLAGES, followup_message: null })).toBe(false)
    expect(relanceActive({ ...REGLAGES, followup_message: '  ' })).toBe(false)
    expect(relanceActive({ ...REGLAGES, followup_enabled: false })).toBe(false)
  })
  it('nombreActifs ne compte que ce qui part vraiment', () => {
    expect(nombreActifs(REGLAGES, PRO)).toBe(2)
    expect(nombreActifs({ ...REGLAGES, google_review_url: null }, PRO)).toBe(1)
    expect(nombreActifs({ ...REGLAGES, review_enabled: false, followup_enabled: false }, PRO)).toBe(0)
  })
  it('lienAvisValide : adresse web seulement', () => {
    expect(lienAvisValide('https://g.page/r/abc')).toBe(true)
    expect(lienAvisValide(' http://exemple.fr ')).toBe(true)
    expect(lienAvisValide('g.page/r/abc')).toBe(false)
    expect(lienAvisValide('javascript:alert(1)')).toBe(false)
    expect(lienAvisValide('')).toBe(false)
  })
})

describe('jourRelatif', () => {
  it('aujourd’hui, hier, demain', () => {
    expect(jourRelatif(MAINTENANT, MAINTENANT)).toBe('aujourd’hui')
    expect(jourRelatif(MAINTENANT - JOUR, MAINTENANT)).toBe('hier')
    expect(jourRelatif(MAINTENANT + JOUR, MAINTENANT)).toBe('demain')
  })
  it('un jour de la semaine dans les six jours', () => {
    expect(jourRelatif(MAINTENANT + 3 * JOUR, MAINTENANT)).toBe('dimanche')
    expect(jourRelatif(MAINTENANT - 3 * JOUR, MAINTENANT)).toBe('lundi')
  })
  it('une date au-delà, avec « 1er » et l’année seulement si elle change', () => {
    expect(jourRelatif(Date.parse('2026-06-09T10:00:00Z'), MAINTENANT)).toBe('9 juin')
    expect(jourRelatif(Date.parse('2026-10-01T10:00:00Z'), MAINTENANT)).toBe('1er octobre')
    expect(jourRelatif(Date.parse('2025-06-09T10:00:00Z'), MAINTENANT)).toBe('9 juin 2025')
  })
  it('se règle sur le jour de Paris, pas sur celui de la machine', () => {
    // 23 h 30 à Paris le 24 = 21 h 30 UTC le 24 ; 00 h 30 à Paris le 25 = 22 h 30 UTC le 24.
    expect(jourRelatif(Date.parse('2026-09-24T22:30:00Z'), MAINTENANT)).toBe('demain')
  })
})

describe('moments annoncés', () => {
  it('avis : heure pleine suivante, « ce soir » à partir de 18 h', () => {
    // 17 h 12 à Paris → passage de 18 h.
    expect(momentAvis(Date.parse('2026-09-24T15:12:00Z'), MAINTENANT)).toBe('ce soir vers 18h')
    // 14 h 10 → 15 h, encore l’après-midi.
    expect(momentAvis(Date.parse('2026-09-24T12:10:00Z'), MAINTENANT)).toBe('aujourd’hui vers 15h')
  })
  it('avis : demain, un jour de la semaine, et déjà échu', () => {
    expect(momentAvis(Date.parse('2026-09-25T09:30:00Z'), MAINTENANT)).toBe('demain vers 12h')
    expect(momentAvis(Date.parse('2026-09-27T09:00:00Z'), MAINTENANT)).toBe('dimanche vers 11h')
    expect(momentAvis(MAINTENANT - 5 * 3_600_000, MAINTENANT)).toBe('dans l’heure')
  })
  it('relance : jamais une heure', () => {
    expect(momentRelance(MAINTENANT - 1, MAINTENANT)).toBe('au prochain envoi')
    expect(momentRelance(MAINTENANT + JOUR, MAINTENANT)).toBe('dès demain')
    expect(momentRelance(MAINTENANT + 3 * JOUR, MAINTENANT)).toBe('dès dimanche')
    expect(momentRelance(Date.parse('2026-10-01T10:00:00Z'), MAINTENANT)).toBe('dès le 1er octobre')
  })
})

describe('nomAffiche', () => {
  it('l’entreprise pour un Pro, le nom sinon', () => {
    expect(nomAffiche({ client_name: 'Jean', is_professional: true, company_name: 'Garage Renault' })).toBe('Garage Renault')
    expect(nomAffiche({ client_name: 'Jean', is_professional: true, company_name: ' ' })).toBe('Jean')
    expect(nomAffiche({ client_name: 'Jean', is_professional: false, company_name: 'X' })).toBe('Jean')
    expect(nomAffiche({ client_name: 'Jean' })).toBe('Jean')
  })
})

describe('relancesPrevues — la décision du cron, sans rien envoyer', () => {
  it('un client à relancer : dernier rendez-vous + délai', () => {
    const b = rdv({ scheduled_at: il(-40) })
    const [p] = relancesPrevues([b], 30)
    expect(p.rdv.id).toBe(b.id)
    expect(p.instant).toBe(Date.parse(b.scheduled_at) + 30 * JOUR)
  })
  it('seul le rendez-vous le plus récent porte la relance', () => {
    const vieux = rdv({ scheduled_at: il(-100) })
    const recent = rdv({ scheduled_at: il(-60) })
    const prevues = relancesPrevues([vieux, recent], 30)
    expect(prevues.map(p => p.rdv.id)).toEqual([recent.id])
  })
  it('un rendez-vous à venir ou en attente met le client en attente', () => {
    const passe = rdv({ scheduled_at: il(-60) })
    expect(relancesPrevues([passe, rdv({ scheduled_at: il(5), status: 'confirmed' })], 30)[0].instant)
      .toBe(Date.parse(il(5)) + 30 * JOUR)
    expect(relancesPrevues([passe, rdv({ scheduled_at: il(-2), status: 'pending' })], 30)).toEqual([])
  })
  it('un rendez-vous annulé ne compte pas (le client reste relançable)', () => {
    const passe = rdv({ scheduled_at: il(-60) })
    const annule = rdv({ scheduled_at: il(-10), status: 'cancelled' })
    expect(relancesPrevues([passe, annule], 30)[0].rdv.id).toBe(passe.id)
  })
  it('déjà traité, sans email, ou seulement annulé : rien', () => {
    expect(relancesPrevues([rdv({ followup_sent_at: il(-3) })], 30)).toEqual([])
    expect(relancesPrevues([rdv({ client_email: null })], 30)).toEqual([])
    expect(relancesPrevues([rdv({ client_email: '  ' })], 30)).toEqual([])
    expect(relancesPrevues([rdv({ status: 'cancelled' })], 30)).toEqual([])
    expect(relancesPrevues([rdv({ scheduled_at: 'n’importe quoi' })], 30)).toEqual([])
  })
  it('regroupe par email À L’IDENTIQUE, comme le cron', () => {
    const a = rdv({ client_email: 'Claire@x.fr', scheduled_at: il(-60) })
    const b = rdv({ client_email: 'claire@x.fr', scheduled_at: il(-50) })
    expect(relancesPrevues([a, b], 30)).toHaveLength(2)
  })
  it('trie les plus proches d’abord', () => {
    const tard = rdv({ client_email: 'a@x.fr', scheduled_at: il(-10) })
    const tot = rdv({ client_email: 'b@x.fr', scheduled_at: il(-50) })
    expect(relancesPrevues([tard, tot], 30).map(p => p.rdv.id)).toEqual([tot.id, tard.id])
  })
})

describe('apercuRelance', () => {
  it('compte les clients déjà concernés et annonce le suivant', () => {
    const dus = [
      rdv({ client_email: 'a@x.fr', scheduled_at: il(-60) }),
      rdv({ client_email: 'b@x.fr', scheduled_at: il(-45) }),
    ]
    const suivant = rdv({ client_email: 'c@x.fr', client_name: 'Marc Petit', scheduled_at: il(-27) })
    const a = apercuRelance([...dus, suivant], 30, MAINTENANT)
    expect(a.concernes).toBe(2)
    expect(a.suivant).toEqual({ nom: 'Marc Petit', moment: 'dès dimanche' })
  })
  it('un délai plus court concerne plus de monde', () => {
    const b = rdv({ scheduled_at: il(-20) })
    expect(apercuRelance([b], 30, MAINTENANT).concernes).toBe(0)
    expect(apercuRelance([b], 15, MAINTENANT).concernes).toBe(1)
    expect(apercuRelance([b], 30, MAINTENANT).suivant?.nom).toBe('Claire Martin')
  })
  it('personne : rien à annoncer', () => {
    expect(apercuRelance([], 30, MAINTENANT)).toEqual({ concernes: 0, suivant: null })
  })
})

describe('messagesProgrammes', () => {
  it('une demande d’avis en attente, avec la prestation et le jour', () => {
    const b = rdv({
      review_request_at: il(0, 5), scheduled_at: il(0, -2),
      services: { name: 'Lavage complet' },
    })
    const [l] = messagesProgrammes(REGLAGES, PRO, [b], MAINTENANT)
    expect(l).toMatchObject({ type: 'avis', nom: 'Claire Martin', detail: 'Lavage complet · aujourd’hui', deduit: false })
    expect(l.droite).toBe('aujourd’hui vers 17h')
  })
  it('écarte comme le cron : envoyée, annulée, sans email, SMS sans numéro', () => {
    const base = { review_request_at: il(0, 5) }
    expect(messagesProgrammes(AVIS_SEUL, PRO, [rdv({ ...base, review_request_sent_at: il(-1) })], MAINTENANT)).toEqual([])
    expect(messagesProgrammes(AVIS_SEUL, PRO, [rdv({ ...base, status: 'cancelled' })], MAINTENANT)).toEqual([])
    expect(messagesProgrammes(AVIS_SEUL, PRO, [rdv({ ...base, client_email: null })], MAINTENANT)).toEqual([])
    const sms = { ...AVIS_SEUL, review_channel: 'sms' as const }
    expect(messagesProgrammes(sms, PRO, [rdv({ ...base, client_phone: '' })], MAINTENANT)).toEqual([])
    expect(messagesProgrammes(sms, PRO, [rdv({ ...base })], MAINTENANT)).toHaveLength(1)
  })
  it('rien ne part tant que l’avis ne peut pas partir', () => {
    const b = rdv({ review_request_at: il(0, 5) })
    expect(messagesProgrammes({ ...AVIS_SEUL, google_review_url: null }, PRO, [b], MAINTENANT)).toEqual([])
    expect(messagesProgrammes({ ...AVIS_SEUL, review_enabled: false }, PRO, [b], MAINTENANT)).toEqual([])
    expect(messagesProgrammes({ ...AVIS_SEUL, review_channel: 'sms' }, ESSENTIEL, [b], MAINTENANT)).toEqual([])
  })
  it('une demande sans horodatage programmé n’est pas programmée', () => {
    expect(messagesProgrammes(AVIS_SEUL, PRO, [rdv({ review_request_at: null })], MAINTENANT)).toEqual([])
  })
  it('une relance échue part « au prochain envoi », avec le dernier rendez-vous', () => {
    const b = rdv({ scheduled_at: '2026-06-09T08:00:00Z' })
    const [l] = messagesProgrammes({ ...REGLAGES, followup_delay_days: 30 }, PRO, [b], MAINTENANT)
    expect(l).toMatchObject({ type: 'relance', detail: 'Dernier RDV le 9 juin', droite: 'au prochain envoi' })
  })
  it('une relance de la semaine est annoncée, une relance lointaine non', () => {
    const proche = rdv({ client_email: 'a@x.fr', scheduled_at: il(-27) })
    const loin = rdv({ client_email: 'b@x.fr', scheduled_at: il(-5) })
    const l = messagesProgrammes(REGLAGES, PRO, [proche, loin], MAINTENANT)
    expect(l.map(x => x.cle)).toEqual([`relance-${proche.id}`])
    expect(l[0].droite).toBe('dès dimanche')
  })
  it('un rendez-vous à venir est dit « prévu » et non « dernier »', () => {
    const b = rdv({ scheduled_at: il(-29), status: 'confirmed' })
    const futur = rdv({ scheduled_at: il(2), status: 'confirmed', client_email: 'z@x.fr', followup_sent_at: il(-1) })
    const [l] = messagesProgrammes({ ...REGLAGES, followup_delay_days: 1 }, PRO, [b, futur], MAINTENANT)
    expect(l.detail).toBe('Dernier RDV le 26 août')
    const d = messagesProgrammes({ ...REGLAGES, followup_delay_days: 1 }, PRO,
      [rdv({ scheduled_at: il(2), status: 'confirmed', client_email: 'q@x.fr' })], MAINTENANT)
    expect(d[0].detail).toMatch(/^RDV prévu le /)
  })
  it('rien sans message de relance', () => {
    const b = rdv({ scheduled_at: il(-60) })
    expect(messagesProgrammes({ ...REGLAGES, followup_message: null }, PRO, [b], MAINTENANT)).toEqual([])
  })
  it('mélange avis et relances dans l’ordre du temps', () => {
    const avis = rdv({ client_email: 'a@x.fr', review_request_at: il(0, 6), review_request_sent_at: null, scheduled_at: il(-1) })
    const rel = rdv({ client_email: 'b@x.fr', scheduled_at: il(-60) })
    const l = messagesProgrammes(REGLAGES, PRO, [avis, rel], MAINTENANT)
    expect(l.map(x => x.type)).toEqual(['relance', 'avis'])
  })
})

describe('messagesPartis', () => {
  it('un SMS d’avis envoyé cette semaine : lu, pas déduit', () => {
    const b = rdv({ review_request_at: il(-2), review_request_sent_at: il(-2), review_sms_sent_at: il(-2) })
    const [l] = messagesPartis({ ...REGLAGES, review_channel: 'sms' }, PRO, [b], MAINTENANT)
    expect(l).toMatchObject({ type: 'avis', droite: 'SMS envoyé', deduit: false, detail: 'Avis · mardi' })
  })
  it('un email d’avis est déduit, et seulement si l’avis est en marche par email', () => {
    const b = rdv({ review_request_at: il(-2), review_request_sent_at: il(-2) })
    expect(messagesPartis(REGLAGES, PRO, [b], MAINTENANT)[0]).toMatchObject({ droite: 'email envoyé', deduit: true })
    expect(messagesPartis({ ...REGLAGES, review_enabled: false }, PRO, [b], MAINTENANT)).toEqual([])
    expect(messagesPartis({ ...REGLAGES, review_channel: 'sms' }, PRO, [b], MAINTENANT)).toEqual([])
  })
  it('une demande écartée (annulée, sans email) n’est pas comptée comme partie', () => {
    const base = { review_request_at: il(-2), review_request_sent_at: il(-2) }
    expect(messagesPartis(REGLAGES, PRO, [rdv({ ...base, status: 'cancelled' })], MAINTENANT)).toEqual([])
    expect(messagesPartis(REGLAGES, PRO, [rdv({ ...base, client_email: null })], MAINTENANT)).toEqual([])
    expect(messagesPartis(REGLAGES, PRO, [rdv({ review_request_sent_at: il(-2) })], MAINTENANT)).toEqual([])
  })
  it('hors fenêtre : rien', () => {
    const b = rdv({ review_request_at: il(-9), review_request_sent_at: il(-9), review_sms_sent_at: il(-9) })
    expect(messagesPartis(REGLAGES, PRO, [b], MAINTENANT)).toEqual([])
    expect(messagesPartis(REGLAGES, PRO, [rdv({ review_sms_sent_at: il(1) })], MAINTENANT)).toEqual([])
  })
  it('une relance envoyée sans retour : « pas encore revenu »', () => {
    const b = rdv({ scheduled_at: il(-45), followup_sent_at: il(-1) })
    expect(messagesPartis(REGLAGES, PRO, [b], MAINTENANT)[0])
      .toMatchObject({ type: 'relance', droite: 'pas encore revenu', ton: 'discret', detail: 'Relance · hier', deduit: true })
  })
  it('une relance suivie d’un rendez-vous pris après : « a réservé depuis »', () => {
    const b = rdv({ scheduled_at: il(-45), followup_sent_at: il(-3) })
    const retour = rdv({ scheduled_at: il(4), created_at: il(-1), status: 'pending' })
    const l = messagesPartis(REGLAGES, PRO, [b, retour], MAINTENANT)
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ droite: 'a réservé depuis', ton: 'ok' })
  })
  it('un rendez-vous clos sans envoi (client déjà revenu avant) n’est pas une relance partie', () => {
    const clos = rdv({ scheduled_at: il(-60), followup_sent_at: il(-2) })
    const revenu = rdv({ scheduled_at: il(-40), created_at: il(-70), status: 'done' })
    expect(messagesPartis(REGLAGES, PRO, [clos, revenu], MAINTENANT)).toEqual([])
  })
  it('trie du plus récent au plus ancien', () => {
    const a = rdv({ client_email: 'a@x.fr', scheduled_at: il(-50), followup_sent_at: il(-4) })
    const b = rdv({ client_email: 'b@x.fr', scheduled_at: il(-50), followup_sent_at: il(-1) })
    expect(messagesPartis(REGLAGES, PRO, [a, b], MAINTENANT).map(l => l.cle)).toEqual([`relance-${b.id}`, `relance-${a.id}`])
  })
})

describe('relanceEstPartie / aReserveDepuis', () => {
  it('sans marque : jamais partie', () => {
    expect(relanceEstPartie(rdv({ followup_sent_at: null }), [])).toBe(false)
  })
  it('un rendez-vous annulé pris avant la marque ne clôt pas', () => {
    const b = rdv({ scheduled_at: il(-60), followup_sent_at: il(-2) })
    const annule = rdv({ scheduled_at: il(-30), created_at: il(-40), status: 'cancelled' })
    expect(relanceEstPartie(b, [b, annule])).toBe(true)
  })
  it('un autre client ne compte pas', () => {
    const b = rdv({ scheduled_at: il(-60), followup_sent_at: il(-2) })
    const autre = rdv({ client_email: 'autre@x.fr', scheduled_at: il(-30), created_at: il(-40) })
    expect(relanceEstPartie(b, [b, autre])).toBe(true)
    expect(aReserveDepuis(b, [b, autre])).toBe(false)
  })
  it('un rendez-vous annulé pris après ne vaut pas retour', () => {
    const b = rdv({ scheduled_at: il(-60), followup_sent_at: il(-2) })
    const annule = rdv({ scheduled_at: il(3), created_at: il(-1), status: 'cancelled' })
    expect(aReserveDepuis(b, [b, annule])).toBe(false)
  })
})

describe('textes', () => {
  it('la suggestion de relance porte {{nom}} et le lien', () => {
    const m = messageRelanceSuggere('https://x.fr/book/moi')
    expect(m).toContain('{{nom}}')
    expect(m).toContain('https://x.fr/book/moi')
    expect(m.length).toBeLessThanOrEqual(500)
  })
  it('le texte du SMS d’avis est décrit', () => {
    expect(texteSmsAvis()).toContain('avis')
  })
})
