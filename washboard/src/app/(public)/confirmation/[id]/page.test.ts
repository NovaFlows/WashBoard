import { describe, it, expect, vi, beforeEach } from 'vitest'

// Page publique ouverte par l'id seul : le laveur voit cet id dans son tableau de bord, y compris
// pour une réservation au-delà du quota. Elle ne doit donc rien afficher d'une réservation verrouillée.

type Plan = {
  booking: Record<string, unknown> | null
  washer: Record<string, unknown> | null
  washerError: unknown
}
let plan: Plan

const fauxSupabase = {
  from: (table: string) => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self,
      eq: self,
      single: () => Promise.resolve(
        table === 'washers'
          ? { data: plan.washer, error: plan.washerError }
          : { data: plan.booking, error: null },
      ),
    })
    return b
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxSupabase }))
vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NEXT_NOT_FOUND') },
}))

vi.mock('@/lib/reservationsVerrouillees', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/reservationsVerrouillees')>()),
  seuilsVerrouillage: async () => [{
    debut: '2026-09-22T00:00:00.000Z', fin: '2026-10-22T00:00:00.000Z', seuil: '2026-09-25T10:00:00.000Z',
  }],
}))

const { default: ConfirmationPage } = await import('./page')

const params = Promise.resolve({ id: 'c' })

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  plan = {
    booking: {
      id: 'c0ffee00-0000-0000-0000-000000000000', washer_id: 'washer-1', status: 'pending',
      client_name: 'Nadia Costa', client_email: 'nadia@example.com', client_phone: '0633333333',
      address: '1 rue de la Paix', scheduled_at: '2026-10-03T14:30:00.000Z', booked_price: 40,
      created_at: '2026-09-28T09:00:00.000Z', saisie_par_laveur: false,
      services: { name: 'Lavage', duration_minutes: 30 },
      washers: { name: 'Kooki Clean', phone: null, logo_url: null },
    },
    washer: { id: 'washer-1', plan: 'decouverte', created_at: '2026-01-01T00:00:00.000Z' },
    washerError: null,
  }
})

describe('/confirmation/[id]', () => {
  it('refuse une réservation au-delà du quota', async () => {
    await expect(ConfirmationPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('refuse quand la fiche du laveur est illisible', async () => {
    plan.washer = null
    plan.washerError = { message: 'permission denied' }
    await expect(ConfirmationPage({ params })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('affiche une réservation dans le quota', async () => {
    plan.booking = { ...plan.booking, created_at: '2026-09-24T12:00:00.000Z' }
    await expect(ConfirmationPage({ params })).resolves.toBeTruthy()
  })
})
