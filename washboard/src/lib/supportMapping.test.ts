import { describe, it, expect } from 'vitest'
import {
  dbStatusToUi,
  uiStatusToDb,
  dbAuthorToUi,
  mapMessageRow,
  mapThreadRow,
  mapConversationRow,
  assistanceThreadUrl,
  countUnreadMessages,
  isThreadHiddenForTeam,
} from './supportMapping'

describe('dbStatusToUi / uiStatusToDb', () => {
  it('traduisent chaque statut sans perte', () => {
    expect(dbStatusToUi('open')).toBe('ouverte')
    expect(dbStatusToUi('resolved')).toBe('resolue')
    expect(uiStatusToDb('ouverte')).toBe('open')
    expect(uiStatusToDb('resolue')).toBe('resolved')
  })

  it('sont l’inverse l’une de l’autre', () => {
    expect(uiStatusToDb(dbStatusToUi('open'))).toBe('open')
    expect(uiStatusToDb(dbStatusToUi('resolved'))).toBe('resolved')
  })
})

describe('dbAuthorToUi', () => {
  it('traduit chaque auteur', () => {
    expect(dbAuthorToUi('washer')).toBe('laveur')
    expect(dbAuthorToUi('team')).toBe('equipe')
  })
})

describe('mapMessageRow', () => {
  it('conserve id, texte et horodatage, et traduit l’auteur', () => {
    expect(mapMessageRow({
      id: 'm1', author_type: 'team', body: 'On regarde ça.', created_at: '2026-09-17T10:00:00.000Z',
    })).toEqual({
      id: 'm1', from: 'equipe', text: 'On regarde ça.', createdAt: '2026-09-17T10:00:00.000Z',
    })
  })
})

describe('countUnreadMessages', () => {
  const messages = [
    { author_type: 'washer' as const, created_at: '2026-09-17T09:00:00.000Z' },
    { author_type: 'team' as const, created_at: '2026-09-17T09:05:00.000Z' },
    { author_type: 'team' as const, created_at: '2026-09-17T10:00:00.000Z' },
  ]

  it('ne compte que les messages du camp demandé, postérieurs au curseur', () => {
    expect(countUnreadMessages(messages, 'team', '2026-09-17T09:05:00.000Z')).toBe(1)
    expect(countUnreadMessages(messages, 'washer', '2026-09-17T08:00:00.000Z')).toBe(1)
  })

  it('curseur null : LE PIÈGE — compte tout le camp au lieu de ne rien renvoyer', () => {
    // Le motif des quatre bugs de prod : `created_at > null` ne matche jamais
    // rien en SQL. Un curseur jamais posé (fil jamais lu) doit faire compter
    // TOUS les messages de l'autre camp, pas 0.
    expect(countUnreadMessages(messages, 'team', null)).toBe(2)
    expect(countUnreadMessages(messages, 'washer', null)).toBe(1)
  })

  it('traite undefined comme null (sélection qui ne demande pas la colonne)', () => {
    expect(countUnreadMessages(messages, 'team', undefined)).toBe(2)
  })

  it('un curseur illisible ne fait jamais disparaître de messages', () => {
    expect(countUnreadMessages(messages, 'team', 'pas-une-date')).toBe(2)
  })

  it('renvoie 0 sur une liste vide, null ou undefined', () => {
    expect(countUnreadMessages([], 'team', null)).toBe(0)
    expect(countUnreadMessages(null, 'team', null)).toBe(0)
    expect(countUnreadMessages(undefined, 'team', null)).toBe(0)
  })
})

describe('isThreadHiddenForTeam', () => {
  it('non masqué (hiddenAt absent) : visible', () => {
    expect(isThreadHiddenForTeam(null, '2026-09-17T10:00:00.000Z')).toBe(false)
    expect(isThreadHiddenForTeam(undefined, '2026-09-17T10:00:00.000Z')).toBe(false)
  })

  it('masqué après le dernier message : masqué', () => {
    expect(isThreadHiddenForTeam('2026-09-17T11:00:00.000Z', '2026-09-17T10:00:00.000Z')).toBe(true)
  })

  it('nouveau message du laveur après le masquage : redevient visible, sans action explicite', () => {
    // Le cœur de la règle 3 du besoin : `last_message_at` avance tout seul
    // quand le laveur écrit, la condition devient fausse d'elle-même.
    expect(isThreadHiddenForTeam('2026-09-17T10:00:00.000Z', '2026-09-17T11:00:00.000Z')).toBe(false)
  })

  it('égalité stricte : masquage et dernier message à la même horodate → visible', () => {
    expect(isThreadHiddenForTeam('2026-09-17T10:00:00.000Z', '2026-09-17T10:00:00.000Z')).toBe(false)
  })

  it('date de masquage illisible : doute → visible, jamais masqué à tort', () => {
    expect(isThreadHiddenForTeam('pas-une-date', '2026-09-17T10:00:00.000Z')).toBe(false)
  })

  it('last_message_at illisible : doute → visible', () => {
    expect(isThreadHiddenForTeam('2026-09-17T11:00:00.000Z', 'pas-une-date')).toBe(false)
  })
})

describe('mapThreadRow', () => {
  const base = {
    id: 'q1',
    subject: 'Souci de facturation',
    status: 'open' as const,
    is_read_by_washer: true,
    is_read_by_team: false,
  }

  it('reprend le sujet comme titre et le statut traduit', () => {
    const thread = mapThreadRow({ ...base, support_messages: [] })
    expect(thread.id).toBe('q1')
    expect(thread.title).toBe('Souci de facturation')
    expect(thread.status).toBe('ouverte')
  })

  it('déduit nonLue de is_read_by_washer, pas de is_read_by_team', () => {
    expect(mapThreadRow({ ...base, is_read_by_washer: true, support_messages: [] }).nonLue).toBe(false)
    expect(mapThreadRow({ ...base, is_read_by_washer: false, support_messages: [] }).nonLue).toBe(true)
  })

  it('déduit vuParEquipe de is_read_by_team, pas de is_read_by_washer', () => {
    expect(mapThreadRow({ ...base, is_read_by_team: true, support_messages: [] }).vuParEquipe).toBe(true)
    expect(mapThreadRow({ ...base, is_read_by_team: false, support_messages: [] }).vuParEquipe).toBe(false)
  })

  it('convertit chaque message imbriqué', () => {
    const thread = mapThreadRow({
      ...base,
      support_messages: [
        { id: 'm1', author_type: 'washer', body: 'Bonjour', created_at: '2026-09-17T09:00:00.000Z' },
        { id: 'm2', author_type: 'team', body: 'On regarde', created_at: '2026-09-17T09:05:00.000Z' },
      ],
    })
    expect(thread.messages).toEqual([
      { id: 'm1', from: 'laveur', text: 'Bonjour', createdAt: '2026-09-17T09:00:00.000Z' },
      { id: 'm2', from: 'equipe', text: 'On regarde', createdAt: '2026-09-17T09:05:00.000Z' },
    ])
  })

  it('ne casse pas si la sélection imbriquée renvoie null', () => {
    // Défense de typage sur un résultat déjà validé (pas d'erreur de lecture
    // masquée ici) : une relation vide peut arriver sous forme de null.
    expect(mapThreadRow({ ...base, support_messages: null }).messages).toEqual([])
  })

  it('nonLuesCount compte les messages de l’équipe postérieurs au curseur du laveur', () => {
    const messages = [
      { id: 'm1', author_type: 'washer' as const, body: 'Bonjour', created_at: '2026-09-17T09:00:00.000Z' },
      { id: 'm2', author_type: 'team' as const, body: 'On regarde', created_at: '2026-09-17T09:05:00.000Z' },
      { id: 'm3', author_type: 'team' as const, body: 'C’est corrigé', created_at: '2026-09-17T10:00:00.000Z' },
    ]
    expect(mapThreadRow({ ...base, support_messages: messages, last_read_by_washer_at: '2026-09-17T09:05:00.000Z' }).nonLuesCount).toBe(1)
    // Jamais lu (curseur null) : les deux réponses de l'équipe comptent, pas 0.
    expect(mapThreadRow({ ...base, support_messages: messages, last_read_by_washer_at: null }).nonLuesCount).toBe(2)
  })
})

describe('mapConversationRow', () => {
  const base = {
    id: 'q1',
    subject: 'Question calendrier',
    status: 'resolved' as const,
    is_read_by_washer: false,
    is_read_by_team: true,
    support_messages: [],
  }

  it('porte l’identité du laveur et le statut traduit', () => {
    const conv = mapConversationRow(base, { name: 'Kooki Clean', slug: 'kooki-clean' })
    expect(conv.washerName).toBe('Kooki Clean')
    expect(conv.washerSlug).toBe('kooki-clean')
    expect(conv.status).toBe('resolue')
  })

  it('déduit nonLue de is_read_by_team, pas de is_read_by_washer', () => {
    expect(mapConversationRow({ ...base, is_read_by_team: true }, { name: 'X', slug: 'x' }).nonLue).toBe(false)
    expect(mapConversationRow({ ...base, is_read_by_team: false }, { name: 'X', slug: 'x' }).nonLue).toBe(true)
  })

  it('déduit vuParLaveur de is_read_by_washer, pas de is_read_by_team', () => {
    expect(mapConversationRow({ ...base, is_read_by_washer: true }, { name: 'X', slug: 'x' }).vuParLaveur).toBe(true)
    expect(mapConversationRow({ ...base, is_read_by_washer: false }, { name: 'X', slug: 'x' }).vuParLaveur).toBe(false)
  })

  it('nonLuesCount compte les messages du laveur postérieurs au curseur de l’équipe', () => {
    const messages = [
      { id: 'm1', author_type: 'team' as const, body: 'Bonjour', created_at: '2026-09-17T09:00:00.000Z' },
      { id: 'm2', author_type: 'washer' as const, body: 'Toujours bloqué', created_at: '2026-09-17T09:05:00.000Z' },
    ]
    expect(mapConversationRow({ ...base, support_messages: messages, last_read_by_team_at: '2026-09-17T09:05:00.000Z' }, { name: 'X', slug: 'x' }).nonLuesCount).toBe(0)
    // Jamais lu par l'équipe (curseur null) : le message du laveur compte, pas 0.
    expect(mapConversationRow({ ...base, support_messages: messages, last_read_by_team_at: null }, { name: 'X', slug: 'x' }).nonLuesCount).toBe(1)
  })
})

describe('assistanceThreadUrl', () => {
  it('construit le lien de fil attendu par l’interface (?fil=<id>)', () => {
    expect(assistanceThreadUrl('q1')).toBe('/dashboard/assistance?fil=q1')
  })

  it('échappe un id qui contiendrait des caractères spéciaux d’URL', () => {
    expect(assistanceThreadUrl('a b&c')).toBe('/dashboard/assistance?fil=a%20b%26c')
  })
})
