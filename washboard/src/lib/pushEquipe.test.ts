import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// `notifierEquipe` envoie aux appareils de l'équipe, et à EUX SEULS. C'est le
// point à ne jamais casser : une inscription ne doit pas déclencher de
// notification chez les laveurs.

const envoyer = vi.fn()
const traces = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

let comptes: { id: string; email: string }[] = []
let erreurComptes: unknown = null
let fiches: { id: string }[] = []
let erreurFiches: unknown = null
let abonnementsPar: Record<string, unknown[]> = {}

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => envoyer(...args),
  },
}))

vi.mock('@/lib/logger', () => ({ logger: traces }))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: comptes }, error: erreurComptes }),
      },
    },
    from: (table: string) => {
      if (table === 'washers') {
        return { select: () => ({ in: async () => ({ data: fiches, error: erreurFiches }) }) }
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

const ADMIN = 'novaflows.pro@gmail.com'
const message = { title: 'Nouveau client', body: 'Kooki Clean' }

function appareil(n: string) {
  return { id: `a-${n}`, endpoint: `https://push.example/${n}`, p256dh: 'p', auth: 'x' }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'cle-publique'
  process.env.VAPID_PRIVATE_KEY = 'cle-privee'
  process.env.SUPPORT_ADMIN_EMAILS = ADMIN

  envoyer.mockReset().mockResolvedValue(undefined)
  traces.error.mockReset(); traces.warn.mockReset(); traces.info.mockReset()

  erreurComptes = null
  erreurFiches = null
  comptes = [
    { id: 'u-admin', email: ADMIN },
    { id: 'u-laveur', email: 'kookii@exemple.fr' },
  ]
  fiches = [{ id: 'w-admin' }]
  abonnementsPar = { 'w-admin': [appareil('1')], 'w-laveur': [appareil('9')] }
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
  delete process.env.SUPPORT_ADMIN_EMAILS
})

describe('notifierEquipe — qui reçoit', () => {
  it('envoie aux appareils de l\'équipe', async () => {
    await notifierEquipe(message)
    expect(envoyer).toHaveBeenCalledTimes(1)
    expect(envoyer.mock.calls[0][0].endpoint).toBe('https://push.example/1')
    expect(JSON.parse(envoyer.mock.calls[0][1])).toEqual(message)
  })

  it('n\'envoie rien aux laveurs qui ne sont pas dans la liste', async () => {
    // Le cœur du sujet : une inscription ne doit prévenir que l'équipe.
    fiches = [{ id: 'w-laveur' }]
    comptes = [{ id: 'u-laveur', email: 'kookii@exemple.fr' }]
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('couvre tous les appareils quand un membre a plusieurs fiches', async () => {
    // Alexandre a un compte de test et un compte réel.
    fiches = [{ id: 'w-admin' }, { id: 'w-laveur' }]
    await notifierEquipe(message)
    expect(envoyer).toHaveBeenCalledTimes(2)
  })

  it('ignore la casse et les espaces dans la liste', async () => {
    process.env.SUPPORT_ADMIN_EMAILS = `  ${ADMIN.toUpperCase()} , autre@exemple.fr `
    await notifierEquipe(message)
    expect(envoyer).toHaveBeenCalledTimes(1)
  })
})

describe('notifierEquipe — refus par défaut', () => {
  it('n\'envoie rien si aucune adresse n\'est configurée', async () => {
    delete process.env.SUPPORT_ADMIN_EMAILS
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
  })

  it('n\'envoie rien si la liste est vide', async () => {
    process.env.SUPPORT_ADMIN_EMAILS = '   '
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
  it('signale une adresse configurée sans compte correspondant', async () => {
    // Typiquement une faute de frappe dans la variable. Silencieux, ce serait
    // indétectable : on croirait recevoir les notifications.
    comptes = [{ id: 'u-laveur', email: 'kookii@exemple.fr' }]
    await notifierEquipe(message)
    expect(envoyer).not.toHaveBeenCalled()
    expect(traces.warn).toHaveBeenCalledWith('push.equipe.aucun_compte_correspondant', {})
  })

  it('trace un échec de lecture des comptes sans lever', async () => {
    erreurComptes = { message: 'auth indisponible' }
    await expect(notifierEquipe(message)).resolves.toBeUndefined()
    expect(envoyer).not.toHaveBeenCalled()
    expect(traces.error).toHaveBeenCalled()
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
