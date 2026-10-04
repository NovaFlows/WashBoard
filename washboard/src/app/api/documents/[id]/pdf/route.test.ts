import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le PDF d'un devis/facture écrit à la main — route publique, l'id du document fait le jeton
// (voir l'en-tête de route.ts). Jamais testée jusqu'ici : ajoutée en même temps que le garde-fou
// sur un id mal formé (voir lib/uuid.ts), trouvé en marge d'un diagnostic de logs Supabase le
// 2026-10-04 — même motif que bookings/[id]/pdf et bookings/[id]/source.

let document: Record<string, unknown> | null
const tablesLues: string[] = []

const fauxAdmin = {
  from: (table: string) => {
    tablesLues.push(table)
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: () => b,
      eq: () => b,
      maybeSingle: () => Promise.resolve({ data: document, error: null }),
    })
    return b
  },
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fauxAdmin }))
vi.mock('@/lib/pdfDocument', () => ({
  nomFichierDocument: () => 'devis-D-00001.pdf',
  rendreDocumentPdf: vi.fn(async () => Buffer.from('%PDF-test')),
}))

const { GET } = await import('./route')
const { rendreDocumentPdf } = await import('@/lib/pdfDocument')

const ID = '6f1c2a4e-1b2c-4d5e-8f90-123456789abc'

function telecharger(id = ID) {
  return GET(new Request(`https://www.washboard.fr/api/documents/${id}/pdf`), { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  vi.mocked(rendreDocumentPdf).mockClear()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  tablesLues.length = 0
  document = { genre: 'devis', numero: 'D-00001', contenu: {}, emis_le: '2026-10-01T00:00:00.000Z' }
})

describe('GET /api/documents/[id]/pdf', () => {
  it('sert le PDF pour un id valide', async () => {
    const res = await telecharger()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(rendreDocumentPdf).toHaveBeenCalledOnce()
  })

  it('404 pour un document inexistant', async () => {
    document = null
    const res = await telecharger()
    expect(res.status).toBe(404)
    expect(rendreDocumentPdf).not.toHaveBeenCalled()
  })

  // Vu en production le 2026-10-04 : un id mal formé (lien cassé, bot, ou
  // `undefined` interpolé côté client dans l'URL) atteignait Postgres tel
  // quel et y déclenchait une vraie erreur serveur (invalid input syntax for
  // type uuid) pour ce qui n'est jamais qu'un lien invalide. Voir lib/uuid.ts.
  it('renvoie 404 sans toucher la base pour un id mal formé, avant même Postgres', async () => {
    const res = await telecharger('undefined')
    expect(res.status).toBe(404)
    expect(tablesLues).toEqual([])
    expect(rendreDocumentPdf).not.toHaveBeenCalled()
  })
})
