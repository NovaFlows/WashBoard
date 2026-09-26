import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Demandes d'avis : ce qui se passe quand l'envoi ÉCHOUE.
//
// Le motif corrigé ici a coûté 7 demandes d'avis perdues. `review_request_sent_at`
// était posé à la fin de chaque tour, succès ou échec confondus : quand les
// crédits SMS de Brevo se sont épuisés le 2026-09-15, les demandes ont été
// classées « envoyées » et plus jamais rejouées, sans que personne ne le voie.

type Fiche = Record<string, unknown>

let plan: {
  due: Fiche[]
  washer: Fiche
  smsCeMois: number
  smsEchoue: boolean
  emailEchoue: boolean
}

/** Écritures réellement envoyées à la base, pour vérifier ce qui a été marqué. */
let ecritures: { table: string; valeurs: Record<string, unknown>; id?: string }[] = []
const notifications: { title?: string; body?: string; tag?: string }[] = []

function builder(table: string) {
  const etat: { valeurs?: Record<string, unknown>; id?: string; comptage?: boolean } = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {}
  const suite = () => b

  function reponse() {
    if (etat.valeurs) {
      ecritures.push({ table, valeurs: etat.valeurs, id: etat.id })
      return { data: null, error: null }
    }
    if (etat.comptage) return { count: plan.smsCeMois, error: null }
    if (table === 'washers') return { data: plan.washer, error: null }
    return { data: plan.due, error: null }
  }

  b.select = (_colonnes?: string, options?: { head?: boolean }) => {
    if (options?.head) etat.comptage = true
    return b
  }
  b.update = (valeurs: Record<string, unknown>) => { etat.valeurs = valeurs; return b }
  b.eq = (colonne: string, valeur: string) => { if (colonne === 'id') etat.id = valeur; return b }
  b.is = suite; b.not = suite; b.gte = suite; b.lte = suite; b.limit = suite; b.order = suite
  b.single = () => Promise.resolve(reponse())
  b.maybeSingle = () => Promise.resolve(reponse())
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(reponse()).then(ok, ko)
  return b
}

vi.mock('@/lib/cronRequest', () => ({
  isAuthorizedCron: () => true,
  parseTestMode: () => ({ enabled: false }),
  createAdminClient: () => ({ from: (table: string) => builder(table) }),
}))
vi.mock('@/lib/email', () => ({
  sendReviewRequest: async () => { if (plan.emailEchoue) throw new Error('Resend indisponible') },
}))
let dernierSms: { to: string; sender: string; content: string } | null = null
vi.mock('@/lib/sms', () => ({
  sendSms: async (p: { to: string; sender: string; content: string }) => {
    dernierSms = p
    if (plan.smsEchoue) throw new Error('Brevo SMS error 402: not enough credit')
  },
}))
vi.mock('@/lib/push', () => ({
  notifierEquipe: async (p: { title?: string; body?: string; tag?: string }) => { notifications.push(p) },
}))

const { GET } = await import('./route')

const requete = () => new Request('https://www.washboard.fr/api/cron/send-reviews') as never
const ilYA = (heures: number) => new Date(Date.now() - heures * 3600_000).toISOString()

const RESERVATION = {
  id: 'b1', client_name: 'Julie', client_email: 'julie@example.fr',
  client_phone: '0612345678', washer_id: 'w1', status: 'done',
  review_request_at: ilYA(1),
}

beforeEach(() => {
  ecritures = []
  dernierSms = null
  notifications.length = 0
  plan = {
    due: [{ ...RESERVATION }],
    washer: {
      name: 'Kooki Clean', review_enabled: true, google_review_url: 'https://g.page/x',
      review_channel: 'sms', plan: 'pro', grandfathered: false, sms_sender: 'Kooki',
      subscription_status: 'active', trial_ends_at: null, subscription_ends_at: null,
    },
    smsCeMois: 0,
    smsEchoue: false,
    emailEchoue: false,
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.restoreAllMocks() })

const marquages = () => ecritures.filter(e => 'review_request_sent_at' in e.valeurs)

describe('GET /api/cron/send-reviews', () => {
  it('marque la demande quand le SMS part', async () => {
    const body = await (await GET(requete())).json()
    expect(body.smsSent).toBe(1)
    expect(body.failed).toBe(0)
    expect(marquages()).toHaveLength(1)
    expect(ecritures.some(e => 'review_sms_sent_at' in e.valeurs)).toBe(true)
  })

  it('nomme le laveur DANS le texte, pas seulement dans l expéditeur', async () => {
    // En France, un expéditeur non enregistré est remplacé par celui du compte
    // (« Nova » le 2026-09-26, alors qu'on demandait « Kooki Clean »). Sans le
    // nom dans le corps, le client reçoit un message anonyme avec un lien.
    await GET(requete())
    expect(dernierSms!.content).toContain('Kooki Clean')
    expect(dernierSms!.content).toContain('https://g.page/x')
    // Sous 160 caractères : au-delà, le message compte double chez l'opérateur.
    expect(dernierSms!.content.length).toBeLessThanOrEqual(160)
  })

  it('NE marque PAS la demande quand le SMS échoue', async () => {
    plan.smsEchoue = true
    const body = await (await GET(requete())).json()
    expect(body.failed).toBe(1)
    expect(body.ok).toBe(false)
    // Le cœur du correctif : la demande reste en attente, donc rejouable.
    expect(marquages()).toHaveLength(0)
  })

  it('ne marque pas non plus un email en échec', async () => {
    plan.washer.review_channel = 'email'
    plan.emailEchoue = true
    const body = await (await GET(requete())).json()
    expect(body.failed).toBe(1)
    expect(marquages()).toHaveLength(0)
  })

  it('abandonne au-delà de 48 h plutôt que de réessayer sans fin', async () => {
    // Une adresse définitivement invalide rejouerait toutes les heures pour
    // toujours ; et un avis demandé trois jours après n'a plus d'intérêt.
    plan.due = [{ ...RESERVATION, review_request_at: ilYA(72) }]
    plan.smsEchoue = true
    const body = await (await GET(requete())).json()
    expect(body.abandonnees).toBe(1)
    expect(marquages()).toHaveLength(1)
  })

  it('prévient l équipe, avec la cause exacte', async () => {
    plan.smsEchoue = true
    await GET(requete())
    expect(notifications).toHaveLength(1)
    expect(notifications[0].body).toContain('not enough credit')
    // Tag fixe : la notification se remplace au lieu de s'empiler chaque heure.
    expect(notifications[0].tag).toBe('envois-avis-echec')
  })

  it('ne prévient personne quand tout passe', async () => {
    await GET(requete())
    expect(notifications).toHaveLength(0)
  })
})
