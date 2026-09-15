import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reprendreApercu, annonceReprise, copieSans } from './repriseApercu'

// Fausse base en mémoire : juste ce que la reprise utilise (select, eq, is,
// order, insert, update, delete, single, comptage). La suppression d'un laveur
// emporte ses lignes, comme le `ON DELETE CASCADE` des tables réelles.

type Ligne = Record<string, unknown>
type Tables = Record<string, Ligne[]>

function fausseBase(tables: Tables, pannes: string[] = []) {
  let n = 0
  const from = (nom: string) => {
    const t = (tables[nom] ??= [])
    const conds: ((l: Ligne) => boolean)[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let valeurs: Ligne | Ligne[] = {}
    let compter = false
    let tri: string | null = null
    let unique = false

    const exec = () => {
      if (pannes.includes(`${op}:${nom}`)) return { data: null, count: null, error: { message: 'panne' } }
      if (op === 'insert') {
        const lignes = (Array.isArray(valeurs) ? valeurs : [valeurs])
          .map(v => ({ id: `${nom}-${++n}`, created_at: `2026-09-15T00:00:${String(n).padStart(2, '0')}Z`, ...v }))
        t.push(...lignes)
        return { data: unique ? lignes[0] : lignes, error: null }
      }
      const cibles = t.filter(l => conds.every(c => c(l)))
      if (op === 'update') { for (const l of cibles) Object.assign(l, valeurs); return { data: null, error: null } }
      if (op === 'delete') {
        for (const l of cibles) t.splice(t.indexOf(l), 1)
        if (nom === 'washers') {
          const ids = cibles.map(l => l.id)
          for (const autre of Object.keys(tables)) {
            if (autre !== 'washers') tables[autre] = tables[autre].filter(l => !ids.includes(l.washer_id))
          }
        }
        return { data: null, error: null }
      }
      const res = [...cibles]
      if (tri) { const k = tri; res.sort((a, b) => (String(a[k]) < String(b[k]) ? -1 : 1)) }
      return { data: compter ? null : res, count: res.length, error: null }
    }

    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (_c?: string, o?: { head?: boolean }) => { if (o?.head) compter = true; return b },
      eq: (k: string, v: unknown) => { conds.push(l => l[k] === v); return b },
      is: (k: string, v: unknown) => { conds.push(l => (l[k] ?? null) === v); return b },
      order: (k: string) => { tri = k; return b },
      insert: (v: Ligne | Ligne[]) => { op = 'insert'; valeurs = v; return b },
      update: (v: Ligne) => { op = 'update'; valeurs = v; return b },
      delete: () => { op = 'delete'; return b },
      single: () => { unique = true; return b },
      then: (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(exec()).then(ok, ko),
    })
    return b
  }
  return { from } as unknown as SupabaseClient
}

const NUMERO = '0611223344'
const COMPTE = { id: 'w-compte', phone: NUMERO }

function scene(): Tables {
  return {
    washers: [
      { id: 'w-compte', user_id: 'u-1', is_preview: false, name: 'Urhus', slug: 'urhus-ab12', phone: NUMERO, logo_url: null },
      {
        id: 'w-apercu', user_id: null, is_preview: true, name: 'URHUS AUTO', slug: 'urhus-auto',
        // Écrit comme dans la fiche du prospect, pas sous forme canonique.
        phone: '06 11 22 33 44',
        logo_url: 'https://exemple.supabase.co/storage/v1/object/public/logos/w-apercu/logo.png',
        brand_color: '#1d4ed8', welcome_message: 'Bienvenue', background_theme: null,
      },
    ],
    service_categories: [{ id: 'c1', washer_id: 'w-apercu', name: 'Voiture', types: ['citadine'], display_order: 0 }],
    services: [
      { id: 's1', washer_id: 'w-apercu', category_id: 'c1', name: 'Complet', price: 65, created_at: '2026-09-10T10:00:00Z' },
      { id: 's2', washer_id: 'w-apercu', category_id: 'c1', name: 'Extérieur', price: 40, created_at: '2026-09-10T09:00:00Z' },
    ],
    availabilities: [{ id: 'a1', washer_id: 'w-apercu', day_of_week: 1, start_time: '08:00', end_time: '18:00' }],
    booking_funnel_events: [{ id: 'f1', washer_id: 'w-apercu', step: 'prestation' }],
    bookings: [],
  }
}

const compte = (t: Tables) => t.washers.find(w => w.id === 'w-compte')!

describe('reprendreApercu', () => {
  it('reprend la page entière dans le compte, puis son lien', async () => {
    const t = scene()
    const r = await reprendreApercu(fausseBase(t), COMPTE)

    expect(r).toEqual({ statut: 'reprise', apercu: { name: 'URHUS AUTO', slug: 'urhus-auto' } })
    // Présentation reprise ; nom et téléphone restent ceux de l'inscription.
    expect(compte(t)).toMatchObject({
      slug: 'urhus-auto', name: 'Urhus', phone: NUMERO,
      logo_url: expect.stringContaining('/logos/w-apercu/'), brand_color: '#1d4ed8', welcome_message: 'Bienvenue',
    })
    // Prestations dans l'ordre d'affichage, rattachées à la NOUVELLE catégorie.
    const services = t.services.filter(s => s.washer_id === 'w-compte')
    expect(services.map(s => s.name)).toEqual(['Extérieur', 'Complet'])
    const categorie = t.service_categories.find(c => c.washer_id === 'w-compte')!
    expect(categorie).toMatchObject({ name: 'Voiture', types: ['citadine'] })
    expect(services.every(s => s.category_id === categorie.id)).toBe(true)
    expect(t.availabilities.filter(h => h.washer_id === 'w-compte')).toHaveLength(1)
    // L'aperçu a disparu, avec tout ce qui lui était rattaché.
    expect(t.washers.some(w => w.id === 'w-apercu')).toBe(false)
    expect(Object.values(t).flat().some(l => l.washer_id === 'w-apercu')).toBe(false)
  })

  it('numéro sans aperçu : rien ne bouge', async () => {
    const t = scene()
    const r = await reprendreApercu(fausseBase(t), { id: 'w-compte', phone: '0700000000' })
    expect(r).toEqual({ statut: 'aucun' })
    expect(compte(t).slug).toBe('urhus-ab12')
    expect(t.washers).toHaveLength(2)
  })

  it('ne prend jamais un vrai compte au même numéro pour un aperçu', async () => {
    const t = scene()
    t.washers[1] = { ...t.washers[1], is_preview: false, user_id: 'u-autre' }
    expect(await reprendreApercu(fausseBase(t), COMPTE)).toEqual({ statut: 'aucun' })
    expect(t.services.filter(s => s.washer_id === 'w-compte')).toHaveLength(0)
  })

  it('deux aperçus au même numéro : rien repris, l’équipe tranche', async () => {
    const t = scene()
    t.washers.push({ id: 'w-apercu-2', user_id: null, is_preview: true, name: 'Urhus Bis', slug: 'urhus-bis', phone: '+33611223344' })
    const r = await reprendreApercu(fausseBase(t), COMPTE)
    expect(r).toEqual({ statut: 'ambigu', apercus: ['URHUS AUTO', 'Urhus Bis'] })
    expect(compte(t).slug).toBe('urhus-ab12')
  })

  it('refuse un aperçu qui porte des réservations', async () => {
    const t = scene()
    t.bookings.push({ id: 'b1', washer_id: 'w-apercu' })
    const r = await reprendreApercu(fausseBase(t), COMPTE)
    expect(r).toMatchObject({ statut: 'refuse', raison: expect.stringMatching(/1 réservation/) })
    expect(t.washers.some(w => w.id === 'w-apercu')).toBe(true)
  })

  it('échec en route : dit où, ce qui est fait, et laisse l’aperçu intact', async () => {
    const t = scene()
    const r = await reprendreApercu(fausseBase(t, ['insert:services']), COMPTE)
    expect(r).toEqual({
      statut: 'echec', apercu: { name: 'URHUS AUTO', slug: 'urhus-auto' },
      etape: 'prestations', fait: ['présentation', '1 catégorie(s)'],
    })
    expect(t.washers.some(w => w.id === 'w-apercu')).toBe(true)
    expect(compte(t).slug).toBe('urhus-ab12')
  })

  it('lecture impossible : échec décrit, sans lever', async () => {
    const r = await reprendreApercu(fausseBase(scene(), ['select:washers']), COMPTE)
    expect(r).toMatchObject({ statut: 'echec', etape: 'lecture des aperçus' })
  })
})

describe('copieSans', () => {
  it('garde toute colonne, sauf celles qui rattachent à l’aperçu', () => {
    expect(copieSans({ id: 1, washer_id: 2, created_at: 3, name: 'a', nouvelle_colonne: true }, ['id', 'washer_id', 'created_at']))
      .toEqual({ name: 'a', nouvelle_colonne: true })
  })
})

describe('annonceReprise', () => {
  it('inscription ordinaire : la notification habituelle', () => {
    expect(annonceReprise({ statut: 'aucun' })).toEqual({ titre: '🎉 Nouveau client WashBoard', lignes: [] })
  })

  it('reprise : annoncée, avec l’invitation à vérifier', () => {
    const a = annonceReprise({ statut: 'reprise', apercu: { name: 'URHUS AUTO', slug: 'urhus-auto' } })
    expect(a.titre).toMatch(/aperçu repris/)
    expect(a.lignes.join('\n')).toMatch(/URHUS AUTO[\s\S]*vérifiez/)
  })

  it('échec : l’étape et ce qui reste à finir', () => {
    const a = annonceReprise({ statut: 'echec', apercu: { name: 'X', slug: 'x' }, etape: 'horaires', fait: ['présentation'] })
    expect(a.titre).toMatch(/échouée/)
    expect(a.lignes.join('\n')).toMatch(/horaires[\s\S]*présentation/)
  })
})
