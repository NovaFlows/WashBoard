import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// `notifierLaveur` ne doit jamais faire échouer la réservation qui l'appelle,
// et doit purger les appareils devenus invalides — sinon la table accumule des
// adresses mortes qu'on réessaie indéfiniment.

const envoyer = vi.fn()
const supprimes: string[][] = []
let abonnements: unknown[] = []
let erreurLecture: unknown = null

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => envoyer(...args),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: abonnements, error: erreurLecture }) }),
      delete: () => ({ in: (_col: string, ids: string[]) => { supprimes.push(ids); return Promise.resolve({ error: null }) } }),
    }),
  }),
}))

const { notifierLaveur } = await import('./push')

const message = { title: 'Nouvelle réservation', body: 'Marc — vendredi 14h' }

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'cle-publique'
  process.env.VAPID_PRIVATE_KEY = 'cle-privee'
  envoyer.mockReset().mockResolvedValue(undefined)
  supprimes.length = 0
  erreurLecture = null
  abonnements = [
    { id: 'a1', endpoint: 'https://push.example/1', p256dh: 'p1', auth: 'x1' },
    { id: 'a2', endpoint: 'https://push.example/2', p256dh: 'p2', auth: 'x2' },
  ]
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
})

describe('notifierLaveur', () => {
  it('envoie à tous les appareils du laveur', async () => {
    await notifierLaveur('w1', message)
    expect(envoyer).toHaveBeenCalledTimes(2)
  })

  it('supprime les appareils dont l’abonnement a expiré (410)', async () => {
    // Le laveur a désinstallé l'application ou changé de téléphone.
    envoyer.mockImplementation((sub: { endpoint: string }) =>
      sub.endpoint.endsWith('/2')
        ? Promise.reject(Object.assign(new Error('Gone'), { statusCode: 410 }))
        : Promise.resolve())

    await notifierLaveur('w1', message)
    expect(supprimes).toEqual([['a2']])
  })

  it('ne supprime rien sur une panne passagère du service de push', async () => {
    // Une erreur 500 est temporaire : effacer l'abonnement priverait le laveur
    // de toutes ses notifications futures pour un incident d'une minute.
    envoyer.mockRejectedValue(Object.assign(new Error('Boom'), { statusCode: 500 }))
    await notifierLaveur('w1', message)
    expect(supprimes).toEqual([])
  })

  it('ne lève jamais : une notification ratée ne doit pas casser la réservation', async () => {
    envoyer.mockRejectedValue(new Error('réseau injoignable'))
    await expect(notifierLaveur('w1', message)).resolves.toBeUndefined()
  })

  it('ne fait rien si les clés ne sont pas configurées', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    await notifierLaveur('w1', message)
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('ne tente aucun envoi si la lecture des abonnements échoue', async () => {
    // Mieux vaut ne rien envoyer que d'envoyer à une liste vide interprétée
    // comme « ce laveur n'a aucun appareil ».
    erreurLecture = { message: 'lecture impossible' }
    await notifierLaveur('w1', message)
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('ne fait rien quand le laveur n’a aucun appareil', async () => {
    abonnements = []
    await notifierLaveur('w1', message)
    expect(envoyer).not.toHaveBeenCalled()
  })
})
