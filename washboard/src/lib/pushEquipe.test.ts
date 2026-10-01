import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// `notifierEquipe` envoie aux appareils de l'équipe, et à EUX SEULS. C'est le
// point à ne jamais casser : une inscription ne doit pas déclencher de
// notification chez les laveurs.

const envoyer = vi.fn()
const traces = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

let fiches: { id: string }[] = []
let erreurFiches: unknown = null
let abonnementsPar: Record<string, unknown[]> = {}
// Identifiants demandés à la table `washers` : ce qui décide qui est notifié.
const demandes: string[][] = []

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => envoyer(...args),
  },
}))

vi.mock('@/lib/logger', () => ({ logger: traces }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === 'washers') {
        return {
          select: () => ({
            in: async (_col: string, ids: string[]) => {
              demandes.push(ids)
              return { data: fiches, error: erreurFiches }
            },
          }),
        }
      }
      // push_subscriptions
      return {
        select: () => ({
          eq: async (_col: string, id: string) =>
            ({ data: abonnementsPar[id] ?? [], error: null }),
        }),
        delete: () => ({ in: async () => ({ error: null }) }),
      }
    },
  }),
}))

const { notifierEquipe } = await import('./push')

const ADMIN = '72164139-29f0-4594-b133-410ad5bde6dc'
const message = { title: 'Nouveau client', body: 'Kooki Clean' }

function appareil(n: string) {
  return { id: `a-${n}`, endpoint: `https://push.example/${n}`, p256dh: 'p', auth: 'x' }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'cle-publique'
  process.env.VAPID_PRIVATE_KEY = 'cle-privee'
  process.env.SUPPORT_ADMIN_USER_IDS = ADMIN
  demandes.length = 0

  envoyer.mockReset().mockResolvedValue(undefined)
  traces.error.mockReset(); traces.warn.mockReset(); traces.info.mockReset()

  erreurFiches = null
  fiches = [{ id: 'w-admin' }]
  abonnementsPar = { 'w-admin': [appareil('1')], 'w-laveur': [appareil('9')] }
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
  delete process.env.SUPPORT_ADMIN_USER_IDS
})

describe('notifierEquipe — qui reçoit', () => {
  it('envoie aux appareils de l\'équipe', async () => {
    await notifierEquipe(message)
    expect(envoyer).toHaveBeenCalledTimes(1)
    expect(envoyer.mock.calls[0][0].endpoint).toBe('https://push.example/1')
    expect(JSON.parse(envoyer.mock.calls[0][1])).toEqual(message)
  })

  it('ne cherche les fiches QUE des comptes de la liste', async () => {
    // Le cœur du sujet : une inscription ne doit prévenir que l'équipe.
    await notifierEquipe(message)
    expect(demandes).toEqual([[ADMIN]])
  })

  it('couvre tous les appareils quand un membre a plusieurs fiches', async () => {
    // Alexandre a un compte de test et un compte réel.
    fiches = [{ id: 'w-admin' }, { id: 'w-laveur' }]
    await notifierEquipe(message)
    expect(envoyer).toHaveBeenCalledTimes(2)
  })

  it('ignore la casse et les espaces dans la liste', async () => {
    process.env.SUPPORT_ADMIN_USER_IDS = `  ${ADMIN.toUpperCase()} , u-autre `
    await notifierEquipe(message)
    expect(demandes).toEqual([[ADMIN, 'u-autre']])
  })
})

describe('notifierEquipe — refus par défaut', () => {
  it('n\'envoie rien si aucun identifiant n\'est configuré', async () => {
    delete process.env.SUPPORT_ADMIN_USER_IDS
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('n\'envoie rien si la liste est vide', async () => {
    process.env.SUPPORT_ADMIN_USER_IDS = '   '
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('n\'envoie rien sans clés VAPID', async () => {
    delete process.env.VAPID_PRIVATE_KEY
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
  })
})

describe('notifierEquipe — pannes', () => {
  it('signale un identifiant configuré sans fiche correspondante', async () => {
    // Typiquement une faute de frappe dans la variable. Silencieux, ce serait
    // indétectable : on croirait recevoir les notifications.
    fiches = []
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
    expect(traces.warn).toHaveBeenCalledWith('push.equipe.aucun_compte_correspondant', {})
  })

  it('trace un échec de lecture des fiches sans lever', async () => {
    erreurFiches = { message: 'RLS' }
    await expect(notifierEquipe(message)).resolves.toBeUndefined()
    expect(envoyer).not.toHaveBeenCalled()
    expect(traces.error).toHaveBeenCalled()
  })

  it('ne fait jamais échouer l\'inscription qui l\'appelle', async () => {
    // Une notification est un confort. Si l'envoi casse, l'inscription doit
    // aboutir quand même.
    envoyer.mockRejectedValue(new Error('service push injoignable'))
    await expect(notifierEquipe(message)).resolves.toBeUndefined()
  })
})
