import { describe, it, expect } from 'vitest'
import { fusionnerFilsAvecServeur } from './useSupportThreads'
import type { SupportThread } from './support'

// Le hook lui-même (useState/useEffect/window) n'est pas testable dans cet
// environnement (node, sans DOM) — voir vitest.config.ts. La fonction de
// fusion, elle, est pure : c'est elle qui porte la logique à risque introduite
// par le refetch-on-focus (bug 3) et par le calage de `ouvrirFil` sur le
// serveur (bugs 1 et 2), donc celle qu'il faut prouver.

function fil(partiel: Partial<SupportThread> & { id: string }): SupportThread {
  return {
    title: 'Question',
    status: 'ouverte',
    messages: [{ id: 'm1', from: 'laveur', text: 'Bonjour', createdAt: '2026-09-19T10:00:00.000Z' }],
    ...partiel,
  }
}

describe('fusionnerFilsAvecServeur', () => {
  it('garde un fil créé localement mais pas encore connu du serveur (POST en vol)', () => {
    const local = fil({ id: 'nouveau-local' })
    const resultat = fusionnerFilsAvecServeur([local], [])
    expect(resultat).toEqual([local])
  })

  it('garde un message optimiste absent de la réponse serveur (réponse à un fil existant, en vol)', () => {
    const messageOptimiste = { id: 'm2', from: 'laveur' as const, text: 'Précision', createdAt: '2026-09-19T10:05:00.000Z' }
    const local = fil({ id: 'f1', messages: [fil({ id: 'f1' }).messages[0], messageOptimiste] })
    const serveur = fil({ id: 'f1' }) // le serveur ne connaît pas encore le 2e message

    const resultat = fusionnerFilsAvecServeur([local], [serveur])

    expect(resultat).toHaveLength(1)
    expect(resultat[0].messages.map(m => m.id)).toEqual(['m1', 'm2'])
  })

  it('remplace un fil connu par la version serveur quand rien n’est en vol', () => {
    const ancien = fil({ id: 'f1', title: 'Ancien titre' })
    const nouveau = fil({ id: 'f1', title: 'Nouveau titre (déduit serveur)' })

    const resultat = fusionnerFilsAvecServeur([ancien], [nouveau])

    expect(resultat).toEqual([nouveau])
  })

  it('remet nonLuesCount et nonLue à zéro pour un fil marqué lu localement (PATCH pas encore revenu)', () => {
    // Le serveur renvoie encore l'ancien compteur : sans le paramètre
    // `enCoursDeLecture`, un refetch (focus) pendant ce court laps de temps
    // ramènerait le fil en gras juste après que le laveur l'a ouvert — la
    // régression que bug 1 vient de corriger, réintroduite par bug 3.
    const serveur = fil({ id: 'f1', nonLue: true, nonLuesCount: 3 })

    const resultat = fusionnerFilsAvecServeur([], [serveur], new Set(['f1']))

    expect(resultat[0].nonLue).toBe(false)
    expect(resultat[0].nonLuesCount).toBe(0)
  })

  it('ne touche pas nonLuesCount pour un fil qui n’est pas en cours de lecture', () => {
    const serveur = fil({ id: 'f1', nonLue: true, nonLuesCount: 3 })

    const resultat = fusionnerFilsAvecServeur([], [serveur], new Set(['autre-fil']))

    expect(resultat[0].nonLuesCount).toBe(3)
  })
})
