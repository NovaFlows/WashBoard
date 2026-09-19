import { describe, it, expect } from 'vitest'
import { fusionnerConversationsAvecServeur } from './SupportInbox'
import type { SupportConversationEquipe } from '@/lib/support'

// Composant non testable ici (node, sans DOM, sans testing-library — voir
// vitest.config.ts). La fonction de fusion, elle, est pure et porte toute la
// logique à risque du refetch-on-focus (bug 3) : c'est elle qu'on prouve.

function conv(partiel: Partial<SupportConversationEquipe> & { id: string }): SupportConversationEquipe {
  return {
    washerName: 'Kooki Clean',
    washerSlug: 'kooki-clean',
    status: 'ouverte',
    nonLue: false,
    messages: [{ id: 'm1', from: 'laveur', text: 'Bonjour', createdAt: '2026-09-19T10:00:00.000Z' }],
    ...partiel,
  }
}

describe('fusionnerConversationsAvecServeur', () => {
  it('garde une réponse envoyée à l’équipe mais pas encore confirmée par le serveur', () => {
    const messageOptimiste = { id: 'm2', from: 'equipe' as const, text: 'On regarde ça', createdAt: '2026-09-19T10:05:00.000Z' }
    const locale = conv({ id: 'c1', messages: [conv({ id: 'c1' }).messages[0], messageOptimiste] })
    const serveur = conv({ id: 'c1' }) // le serveur ne connaît pas encore la réponse

    const resultat = fusionnerConversationsAvecServeur([locale], [serveur])

    expect(resultat).toHaveLength(1)
    expect(resultat[0].messages.map(m => m.id)).toEqual(['m1', 'm2'])
  })

  it('remet nonLue à false pour une conversation ouverte localement (PATCH pas encore revenu)', () => {
    const serveur = conv({ id: 'c1', nonLue: true })

    const resultat = fusionnerConversationsAvecServeur([], [serveur], new Set(['c1']))

    expect(resultat[0].nonLue).toBe(false)
  })

  it('remet aussi nonLuesCount à 0 pour une conversation ouverte localement, sinon la ligne reste en gras avec son chiffre', () => {
    const serveur = conv({ id: 'c1', nonLue: true, nonLuesCount: 3 })

    const resultat = fusionnerConversationsAvecServeur([], [serveur], new Set(['c1']))

    expect(resultat[0].nonLuesCount).toBe(0)
  })

  it('ne touche pas nonLue pour une conversation qui n’est pas en cours de lecture', () => {
    const serveur = conv({ id: 'c1', nonLue: true })

    const resultat = fusionnerConversationsAvecServeur([], [serveur], new Set(['autre']))

    expect(resultat[0].nonLue).toBe(true)
  })

  it('remplace une conversation connue par la version serveur quand rien n’est en vol', () => {
    const ancienne = conv({ id: 'c1', status: 'ouverte' })
    const nouvelle = conv({ id: 'c1', status: 'resolue' })

    const resultat = fusionnerConversationsAvecServeur([ancienne], [nouvelle])

    expect(resultat).toEqual([nouvelle])
  })
})
