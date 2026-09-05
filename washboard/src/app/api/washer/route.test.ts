import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Tests de la route de modification du profil laveur.
//
// Deuxième surface la plus sensible après la réservation : c'est elle qui
// décidait, sur la seule foi de ce que le navigateur envoyait, si un compte
// avait droit aux fonctionnalités Pro. L'audit du 2026-09-05 a relevé qu'un
// compte Essentiel activait les relances automatiques et le multi-laveurs par
// un simple appel — et consommait des SMS facturés à WashBoard.

type Reponse = { data?: unknown; error?: unknown }

let plan: {
  utilisateur: unknown
  washer: Reponse
  slugPris: Reponse
  updateError: unknown
}

const updates: Record<string, unknown>[] = []

function nouveauBuilder(table: string) {
  let estUpdate = false
  let charge: Record<string, unknown> | null = null
  const b: Record<string, unknown> = {}
  const self = () => b

  Object.assign(b, {
    select: self,
    eq: self,
    neq: self,
    update: (valeurs: Record<string, unknown>) => { estUpdate = true; charge = valeurs; return b },
    single: () => Promise.resolve(plan.washer),
    // `.neq(...).maybeSingle()` sert au contrôle d'unicité du lien public.
    maybeSingle: () => Promise.resolve(plan.slugPris),
    then: (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => {
      if (estUpdate) {
        if (charge) updates.push(charge)
        return Promise.resolve({ error: plan.updateError }).then(ok, ko)
      }
      return Promise.resolve(plan.washer ?? { data: null, error: null }).then(ok, ko)
    },
    _table: table,
  })
  return b
}

const fauxClient = {
  from: (table: string) => nouveauBuilder(table),
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))
vi.mock('@/lib/googleMaps', () => ({ getMapsApiKey: () => null }))

const { PATCH } = await import('./route')

function requete(body: Record<string, unknown>) {
  return new Request('https://www.washboard.fr/api/washer', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0]
}

async function patch(body: Record<string, unknown>) {
  const res = await PATCH(requete(body))
  return { res, body: await res.json() }
}

const ESSENTIEL = { data: { plan: 'essentiel', grandfathered: false, id: 'w1' }, error: null }
const PRO       = { data: { plan: 'pro', grandfathered: false, id: 'w1' }, error: null }

beforeEach(() => {
  updates.length = 0
  plan = {
    utilisateur: { id: 'user-1' },
    washer: ESSENTIEL,
    slugPris: { data: null, error: null },
    updateError: null,
  }
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.restoreAllMocks() })

describe('PATCH /api/washer — authentification', () => {
  it('refuse un appel sans session', async () => {
    plan.utilisateur = null
    const { res } = await patch({ name: 'Test' })
    expect(res.status).toBe(401)
    expect(updates).toHaveLength(0)
  })

  it('refuse quand le profil est illisible plutôt que d offrir le Pro', async () => {
    // Sans certitude sur le plan, débloquer reviendrait à offrir les options
    // payantes dès qu'une lecture échoue.
    plan.washer = { data: null, error: { message: 'RLS' } }
    const { res } = await patch({ followup_enabled: true })
    expect(res.status).toBe(404)
    expect(updates).toHaveLength(0)
  })
})

describe('PATCH /api/washer — options réservées au Pro (H6)', () => {
  it('refuse le multi-laveurs à un compte Essentiel', async () => {
    const { res, body } = await patch({ team_size: 4 })
    expect(res.status).toBe(403)
    expect(body.error).toMatch(/Pro/)
    expect(updates).toHaveLength(0)
  })

  it('refuse les relances automatiques à un compte Essentiel', async () => {
    const { res } = await patch({ followup_enabled: true })
    expect(res.status).toBe(403)
    expect(updates).toHaveLength(0)
  })

  it('refuse la demande d avis par SMS à un compte Essentiel', async () => {
    const { res } = await patch({ review_channel: 'sms' })
    expect(res.status).toBe(403)
    expect(updates).toHaveLength(0)
  })

  it('laisse un compte Essentiel DÉSACTIVER une option Pro', async () => {
    // Un laveur qui rétrograde doit pouvoir éteindre ce qu'il n'a plus.
    const { res } = await patch({ followup_enabled: false })
    expect(res.status).toBe(200)
    expect(updates[0].followup_enabled).toBe(false)
  })

  it('laisse un compte Essentiel rester à un seul laveur', async () => {
    const { res } = await patch({ team_size: 1 })
    expect(res.status).toBe(200)
  })

  it('autorise ces options pour un compte Pro', async () => {
    plan.washer = PRO
    expect((await patch({ team_size: 4 })).res.status).toBe(200)
    expect((await patch({ followup_enabled: true })).res.status).toBe(200)
    expect((await patch({ review_channel: 'sms' })).res.status).toBe(200)
  })
})

describe('PATCH /api/washer — lien public', () => {
  it('refuse un lien au format invalide', async () => {
    // Les majuscules, elles, sont acceptées puis abaissées (voir plus bas).
    for (const slug of ['ab', '-tiret-devant', 'tiret-derriere-', 'avec espace', 'accentué', 'a'.repeat(41)]) {
      const { res } = await patch({ slug })
      expect(res.status, slug).toBe(400)
    }
    expect(updates).toHaveLength(0)
  })

  it('refuse un lien déjà pris par un autre laveur', async () => {
    plan.slugPris = { data: { id: 'un-autre' }, error: null }
    const { res } = await patch({ slug: 'kooki-clean' })
    expect(res.status).toBe(409)
    expect(updates).toHaveLength(0)
  })

  it('accepte un lien valide et le normalise en minuscules', async () => {
    const { res } = await patch({ slug: '  Kooki-Clean  ' })
    expect(res.status).toBe(200)
    expect(updates[0].slug).toBe('kooki-clean')
  })
})

describe('PATCH /api/washer — téléphone', () => {
  it('normalise le numéro, pour que l unicité voie deux écritures identiques', async () => {
    // « +33612345678 » et « 06 12 34 56 78 » désignent le même numéro : sans
    // normalisation, la contrainte d'unicité laissait créer un second compte.
    await patch({ phone: '+33612345678' })
    expect(updates[0].phone).toBe('0612345678')
  })

  it('refuse un numéro invalide', async () => {
    const { res } = await patch({ phone: '12' })
    expect(res.status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('accepte un numéro vidé', async () => {
    const { res } = await patch({ phone: '' })
    expect(res.status).toBe(200)
    expect(updates[0].phone).toBeNull()
  })
})

describe('PATCH /api/washer — bornage des valeurs numériques', () => {
  it('borne la taille d équipe d un compte Pro', async () => {
    plan.washer = PRO
    await patch({ team_size: 9999 })
    expect(updates[0].team_size).toBe(50)
  })

  it('borne le délai de demande d avis à une semaine', async () => {
    await patch({ review_delay_hours: 100000 })
    expect(updates[0].review_delay_hours).toBe(168)
  })

  it('écarte les paliers de frais de déplacement incohérents', async () => {
    await patch({ travel_fee_tiers: [
      { max_minutes: 15, fee: 5 },
      { max_minutes: 0,  fee: 5 },   // durée nulle
      { max_minutes: 30, fee: -10 }, // frais négatif
    ] })
    expect(updates[0].travel_fee_tiers).toEqual([{ max_minutes: 15, fee: 5 }])
  })
})

describe('PATCH /api/washer — champs non modifiables', () => {
  it('ignore une tentative de s attribuer le plan Pro', async () => {
    // Le plan vient de Stripe, jamais du navigateur. La route ne recopie que
    // les champs qu'elle connaît : tout le reste tombe.
    const { res } = await patch({ plan: 'pro', grandfathered: true, name: 'Test' })
    expect(res.status).toBe(200)
    expect(updates[0]).not.toHaveProperty('plan')
    expect(updates[0]).not.toHaveProperty('grandfathered')
  })

  it('ignore une tentative de changer de propriétaire', async () => {
    await patch({ user_id: 'quelqu-un-d-autre', id: 'un-autre-laveur', name: 'Test' })
    expect(updates[0]).not.toHaveProperty('user_id')
    expect(updates[0]).not.toHaveProperty('id')
  })
})

describe('PATCH /api/washer — validation de base', () => {
  it('refuse un nom d entreprise vide', async () => {
    const { res } = await patch({ name: '   ' })
    expect(res.status).toBe(400)
    expect(updates).toHaveLength(0)
  })

  it('remonte une erreur d écriture', async () => {
    plan.updateError = { message: 'base indisponible' }
    const { res } = await patch({ name: 'Test' })
    expect(res.status).toBe(500)
  })
})
