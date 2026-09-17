import { describe, it, expect } from 'vitest'
import {
  dbStatusToUi,
  uiStatusToDb,
  dbAuthorToUi,
  mapMessageRow,
  mapThreadRow,
  mapConversationRow,
  assistanceThreadUrl,
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
})

describe('assistanceThreadUrl', () => {
  it('construit le lien de fil attendu par l’interface (?fil=<id>)', () => {
    expect(assistanceThreadUrl('q1')).toBe('/dashboard/assistance?fil=q1')
  })

  it('échappe un id qui contiendrait des caractères spéciaux d’URL', () => {
    expect(assistanceThreadUrl('a b&c')).toBe('/dashboard/assistance?fil=a%20b%26c')
  })
})
