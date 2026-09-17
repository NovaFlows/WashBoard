import { describe, it, expect, afterEach } from 'vitest'
import { SUPPORT_THREAD_READ_EVENT, notifySupportThreadRead } from './supportUnread'

// `window` n'existe pas dans l'environnement de test (node), ce qui tombe bien :
// c'est exactement la situation du rendu serveur, qu'il faut couvrir. Pour le
// cas navigateur, on pose un vrai `EventTarget` — fourni par Node — plutôt
// qu'un espion : on vérifie ainsi le nom réellement diffusé, qui est le seul
// contrat entre l'émetteur et l'écouteur (useSupportUnreadBadge).
const global = globalThis as unknown as { window?: EventTarget }

afterEach(() => { delete global.window })

describe('SUPPORT_THREAD_READ_EVENT', () => {
  it('garde son nom : émetteur et écouteur ne se trouvent que par lui', () => {
    // Le renommer d'un côté seulement éteindrait la pastille en silence.
    expect(SUPPORT_THREAD_READ_EVENT).toBe('wb:support-thread-read')
  })
})

describe('notifySupportThreadRead', () => {
  it('diffuse l’événement attendu dans le navigateur', () => {
    const cible = new EventTarget()
    global.window = cible

    const recus: string[] = []
    cible.addEventListener(SUPPORT_THREAD_READ_EVENT, e => recus.push(e.type))

    notifySupportThreadRead()

    expect(recus).toEqual([SUPPORT_THREAD_READ_EVENT])
  })

  it('ne fait rien, et surtout ne lève pas, côté serveur', () => {
    // Appelée pendant un rendu serveur, elle ferait tomber la page entière si
    // elle touchait `window` sans précaution.
    expect(global.window).toBeUndefined()
    expect(() => notifySupportThreadRead()).not.toThrow()
  })
})
