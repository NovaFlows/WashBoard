import { describe, it, expect, vi, beforeEach } from 'vitest'
import { construireDocument, saisieNeuve } from '@/lib/documents'
import type { VendeurFacturable } from '@/lib/facture'

// Envoi d'un devis ou d'une facture par email.
//
// Ce qui se vérifie ici : le PDF part bien EN PIÈCE JOINTE (Alexandre, 2026-09-27 — un client
// veut recevoir son devis, pas un lien à aller chercher), et le statut ne passe à « envoyé »
// que si l'envoi a réussi. Afficher « envoyé » sur un échec ferait attendre au laveur une
// réponse qui ne viendra jamais.

type Reponse = { data?: unknown; error?: unknown }

const WASHER = { id: 'washer-1', name: 'AutoNettoyage' }

const CONTENU = construireDocument({
  ...saisieNeuve('devis', '2026-09-27'),
  clientNom: 'Madame Leroy',
  clientEmail: 'leroy@exemple.fr',
  clientTelephone: '0612345678',
  clientAdresse: '3 allée des Roses, 95000 Cergy',
  lieu: '3 allée des Roses, 95000 Cergy',
  lignes: [{ designation: 'Nettoyage 3 tapis', quantite: 1, prixUnitaireTtc: 90 }],
}, {
  name: 'AutoNettoyage', phone: null, facture_statut: 'ei', facture_nom_legal: 'Jean Dupont',
  facture_siret: '73282932000074', facture_adresse: '8 rue des Lilas, 95560 Maffliers',
  facture_regime_tva: 'franchise',
} as unknown as VendeurFacturable)

let plan: { utilisateur: unknown; washer: Reponse; document: Reponse; envoi: unknown }
const envois: Record<string, unknown>[] = []
const majs: Record<string, unknown>[] = []

const fauxClient = {
  from: (table: string) => {
    const b: Record<string, unknown> = {}
    const self = () => b
    Object.assign(b, {
      select: self, eq: self,
      single: () => Promise.resolve(plan.washer),
      maybeSingle: () => Promise.resolve(plan.document),
      update: (v: Record<string, unknown>) => { majs.push(v); return b },
    })
    if (table === 'documents') {
      // `update(...).eq(...)` doit se résoudre, contrairement à `select(...).eq(...)`.
      b.update = (v: Record<string, unknown>) => {
        majs.push(v)
        return { eq: () => Promise.resolve({ error: null }) }
      }
    }
    return b
  },
  auth: { getUser: async () => ({ data: { user: plan.utilisateur } }) },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fauxClient }))
vi.mock('@/lib/email', () => ({
  sendDocument: async (p: Record<string, unknown>) => {
    envois.push(p)
    return plan.envoi
  },
}))

const { POST } = await import('./route')

const appel = () => POST(
  new Request('https://www.washboard.fr/api/documents/d1/envoyer', { method: 'POST' }) as never,
  { params: Promise.resolve({ id: 'd1' }) },
)

beforeEach(() => {
  envois.length = 0
  majs.length = 0
  plan = {
    utilisateur: { id: 'user-1', email: 'laveur@exemple.fr' },
    washer: { data: WASHER, error: null },
    document: {
      data: {
        id: 'd1', genre: 'devis', statut: 'emis', numero: 'D-00005',
        contenu: CONTENU, emis_le: '2026-09-27T10:00:00.000Z',
      },
      error: null,
    },
    envoi: { error: null },
  }
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

describe('POST /api/documents/[id]/envoyer', () => {
  it('joint le PDF au message, sous le nom que le client verra', async () => {
    const res = await appel()
    expect(res.status).toBe(200)

    const piece = envois[0].piece as { nom: string; contenu: Buffer }
    expect(piece.nom).toBe('devis-D-00005.pdf')
    expect(piece.contenu.subarray(0, 5).toString()).toBe('%PDF-')
    expect(piece.contenu.length).toBeGreaterThan(2000)
  }, 30_000)

  it('écrit au client, et laisse le laveur recevoir la réponse', async () => {
    await appel()
    expect(envois[0]).toMatchObject({
      to: 'leroy@exemple.fr',
      clientName: 'Madame Leroy',
      washerName: 'AutoNettoyage',
      washerEmail: 'laveur@exemple.fr',
      genre: 'devis',
      numero: 'D-00005',
      montantTtc: 90,
    })
  }, 30_000)

  it('marque « envoyé » seulement après un envoi accepté', async () => {
    await appel()
    expect(majs[0]).toMatchObject({ statut: 'envoye' })
  }, 30_000)

  it('un envoi refusé ne marque rien et le dit', async () => {
    plan.envoi = { error: { message: 'adresse invalide' } }
    const res = await appel()
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/n’est pas parti/)
    expect(majs).toHaveLength(0)
  }, 30_000)

  it('refuse d’envoyer un document sans adresse email', async () => {
    plan.document = {
      data: {
        id: 'd1', genre: 'devis', statut: 'emis', numero: 'D-00005',
        contenu: { ...CONTENU, client: { ...CONTENU.client, email: '' } },
        emis_le: '2026-09-27T10:00:00.000Z',
      },
      error: null,
    }
    const res = await appel()
    expect(res.status).toBe(400)
    expect(envois).toHaveLength(0)
  })

  it('un devis déjà accepté ne repasse pas « en attente » parce qu’on le renvoie', async () => {
    plan.document = {
      data: {
        id: 'd1', genre: 'devis', statut: 'accepte', numero: 'D-00005',
        contenu: CONTENU, emis_le: '2026-09-27T10:00:00.000Z',
      },
      error: null,
    }
    await appel()
    expect(majs[0]).not.toHaveProperty('statut')
  }, 30_000)
})
