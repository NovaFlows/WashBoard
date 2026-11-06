import { describe, it, expect, vi, beforeEach } from 'vitest'

// Fausse base : chaque table renvoie ses lignes, filtrées par `eq` / `in` et découpées par `range`.
type Ligne = Record<string, unknown>
const etat = {
  tables: {} as Record<string, Ligne[]>,
  erreurs: {} as Record<string, unknown>,
  users: [] as { id: string; email: string; last_sign_in_at: string | null }[],
  usersErreur: null as unknown,
  sessionUser: null as { id: string } | null,
}

function requete(table: string) {
  let lignes = [...(etat.tables[table] ?? [])]
  let tete = false
  const fin = (une: boolean) => etat.erreurs[table]
    ? { data: null, error: etat.erreurs[table], count: null }
    : tete ? { data: null, error: null, count: lignes.length } : { data: une ? lignes[0] ?? null : lignes, error: null }
  const q = {
    select: (_c?: string, o?: { head?: boolean }) => { if (o?.head) tete = true; return q },
    eq: (col: string, v: unknown) => { lignes = lignes.filter(l => l[col] === v); return q },
    in: (col: string, vs: unknown[]) => { lignes = lignes.filter(l => vs.includes(l[col])); return q },
    not: () => q, gte: () => q, order: () => q, limit: () => q,
    range: (de: number, a: number) => { lignes = lignes.slice(de, a + 1); return q },
    maybeSingle: () => Promise.resolve(fin(true)),
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(fin(false)).then(ok, ko),
  }
  return q
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: requete,
    auth: { admin: {
      getUserById: async (id: string) => ({ data: { user: etat.users.find(u => u.id === id) ?? null } }),
      listUsers: async ({ page }: { page: number }) => etat.usersErreur
        ? { data: null, error: etat.usersErreur }
        : { data: { users: page === 1 ? etat.users : [] }, error: null },
    } },
  }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: etat.sessionUser } }) }, from: requete }),
}))
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('REDIRECT ' + url) } }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

import { chargerAppels, chargerFicheLaveur, chargerResponsables, chargerResumeEquipe, chargerTousLesLaveurs, exigerEquipe } from './ficheLaveurDonnees'

const NOW = new Date('2026-11-06T12:00:00Z')
const washer = (id: string, w: Ligne = {}): Ligne => ({ id, user_id: 'u-' + id, name: 'Laveur ' + id, slug: 'laveur-' + id, is_preview: false, created_at: '2026-11-01T10:00:00Z', ...w })

beforeEach(() => {
  etat.tables = {}; etat.erreurs = {}; etat.users = []; etat.usersErreur = null; etat.sessionUser = null
  process.env.SUPPORT_ADMIN_USER_IDS = 'equipe-1'
})

describe('exigerEquipe', () => {
  it('sans session : vers la connexion', async () => {
    await expect(exigerEquipe()).rejects.toThrow('REDIRECT /login')
  })
  it('un laveur qui n’est pas de l’équipe : renvoyé au tableau de bord', async () => {
    etat.sessionUser = { id: 'laveur-9' }
    await expect(exigerEquipe()).rejects.toThrow('REDIRECT /dashboard')
  })
  it('l’équipe : sa session et sa fiche', async () => {
    etat.sessionUser = { id: 'equipe-1' }
    etat.tables.washers = [washer('w0', { user_id: 'equipe-1' })]
    const r = await exigerEquipe()
    expect(r.user.id).toBe('equipe-1')
    expect(r.washer?.id).toBe('w0')
  })
})

describe('chargerFicheLaveur', () => {
  it('assemble la fiche d’un seul laveur avec ses données liées', async () => {
    etat.tables.washers = [washer('w1'), washer('w2')]
    etat.tables.services = [{ washer_id: 'w1', name: 'Complet', price: 80, en_veille: false }, { washer_id: 'w2', name: 'Autre', price: 10, en_veille: false }]
    etat.tables.availabilities = [{ washer_id: 'w1', day_of_week: 1 }, { washer_id: 'w1', day_of_week: 3 }]
    etat.tables.bookings = [{ washer_id: 'w1', status: 'confirmed', created_at: '2026-11-05T10:00:00Z' }]
    etat.tables.booking_funnel_events = [{ washer_id: 'w1', session_id: 's1', step: 'prestation', referrer_host: null, created_at: '2026-11-05T10:00:00Z' }]
    etat.tables.push_subscriptions = [{ washer_id: 'w1' }, { washer_id: 'w1' }]
    etat.users = [{ id: 'u-w1', email: 'w1@exemple.fr', last_sign_in_at: '2026-11-04T08:00:00Z' }]
    const f = await chargerFicheLaveur('w1')
    expect(f).toMatchObject({ email: 'w1@exemple.fr', derniereConnexionAuth: '2026-11-04T08:00:00Z', joursOuverts: [1, 3], appareilsNotifies: 2 })
    expect(f?.prestations.map(p => p.name)).toEqual(['Complet'])
    expect(f?.reservations).toHaveLength(1)
    expect(f?.evenements).toHaveLength(1)
  })
  it('laveur inconnu : null ; sans compte utilisateur : pas d’email', async () => {
    expect(await chargerFicheLaveur('absent')).toBeNull()
    etat.tables.washers = [washer('w3', { user_id: null })]
    expect((await chargerFicheLaveur('w3'))?.email).toBeNull()
  })
  it('une lecture en échec fait échouer la fiche, plutôt que d’afficher « 0 réservation »', async () => {
    etat.tables.washers = [washer('w1')]
    etat.erreurs.bookings = { code: '500' }
    await expect(chargerFicheLaveur('w1')).rejects.toEqual({ code: '500' })
    etat.erreurs.washers = { code: '500' }
    await expect(chargerFicheLaveur('w1')).rejects.toEqual({ code: '500' })
  })
})

describe('chargerTousLesLaveurs', () => {
  it('écarte les aperçus et rattache l’email de chaque laveur', async () => {
    etat.tables.washers = [washer('w1'), washer('w2', { is_preview: true }), washer('w3')]
    etat.users = [{ id: 'u-w1', email: 'w1@exemple.fr', last_sign_in_at: null }]
    const tous = await chargerTousLesLaveurs()
    expect(tous.map(d => d.washer.id)).toEqual(['w1', 'w3'])
    expect(tous.map(d => d.email)).toEqual(['w1@exemple.fr', null])
  })
  it('aucun laveur réel : liste vide ; utilisateurs illisibles : erreur', async () => {
    etat.tables.washers = [washer('w2', { is_preview: true })]
    expect(await chargerTousLesLaveurs()).toEqual([])
    etat.tables.washers = [washer('w1')]
    etat.usersErreur = { message: 'auth' }
    await expect(chargerTousLesLaveurs()).rejects.toEqual({ message: 'auth' })
  })
})

describe('chargerResponsables et chargerAppels', () => {
  it('lisent le suivi, filtré par laveur', async () => {
    etat.tables.suivi_laveurs = [{ washer_id: 'w1', responsable: 'Alexandre' }, { washer_id: 'w2', responsable: null }, { washer_id: 'w3', responsable: 'Ryan' }]
    expect(await chargerResponsables(['w1', 'w2'])).toEqual({ parLaveur: { w1: 'Alexandre' }, actif: true })
    etat.tables.suivi_appels = [{ id: 'a1', washer_id: 'w1' }, { id: 'a2', washer_id: 'w2' }]
    expect((await chargerAppels(['w2'])).appels.map(a => a.id)).toEqual(['a2'])
  })
  it('table pas encore créée : inactif, sans erreur ; autre panne : erreur', async () => {
    etat.erreurs.suivi_laveurs = { code: '42P01' }
    etat.erreurs.suivi_appels = { code: 'PGRST205' }
    expect(await chargerResponsables()).toEqual({ parLaveur: {}, actif: false })
    expect(await chargerAppels()).toEqual({ appels: [], actif: false })
    etat.erreurs.suivi_laveurs = { code: '500' }
    etat.erreurs.suivi_appels = { code: '500' }
    await expect(chargerResponsables()).rejects.toEqual({ code: '500' })
    await expect(chargerAppels()).rejects.toEqual({ code: '500' })
  })
})

describe('chargerResumeEquipe', () => {
  it('compte les laveurs, les expéditeurs en attente et les relances dues', async () => {
    etat.tables.washers = [
      washer('w1', { sms_sender: 'MonLavage', sms_sender_statut: 'en_attente' }),
      washer('w2', { sms_sender: null, sms_sender_statut: 'en_attente' }),
      washer('w3', { sms_sender_statut: 'approuve' }),
    ]
    etat.tables.suivi_appels = [
      { id: 'a1', washer_id: 'w1', appele_le: '2026-11-04T10:00:00Z', resultat: 'Rappeler', relancer_le: '2026-11-05' },
      { id: 'a2', washer_id: 'w2', appele_le: '2026-11-04T10:00:00Z', resultat: 'Rappeler', relancer_le: '2026-11-20' },
    ]
    const r = await chargerResumeEquipe(NOW)
    expect(r).toEqual({ nouveaux: 3, total: 3, expediteursEnAttente: 2, aRelancer: 1 })
  })
  it('lecture en échec : chiffre inconnu plutôt que faux', async () => {
    etat.erreurs.washers = { code: '500' }
    etat.erreurs.suivi_appels = { code: '42P01' }
    expect(await chargerResumeEquipe(NOW)).toEqual({ nouveaux: null, total: null, expediteursEnAttente: null, aRelancer: null })
  })
})
