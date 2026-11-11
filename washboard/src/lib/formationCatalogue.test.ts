import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { assemblerCatalogue, type LigneLecon, type LignePack } from './formationCatalogue'

const pack = (o: Partial<LignePack> = {}): LignePack => ({
  id: 'p1', slug: 'bases', titre: 'Les bases', accroche: null, description: null, niveau: 'debutant',
  prix_cents: 4900, statut: 'disponible', objectifs: null, publie: true, ordre: 0, ...o,
})
const lecon = (o: Partial<LigneLecon> = {}): LigneLecon => ({
  id: 'l1', pack_id: 'p1', module_titre: 'Démarrer', module_ordre: 0, ordre: 0, titre: 'Intro',
  type: 'video', duree_sec: 60, apercu_gratuit: false, video_path: null, ...o,
})

describe('assemblerCatalogue', () => {
  it('cache les brouillons aux laveurs, les montre aux administrateurs', () => {
    const lignes = [pack(), pack({ id: 'p2', slug: 'b', titre: 'Brouillon', publie: false })]
    expect(assemblerCatalogue(lignes, [], { admin: false }).map(p => p.slug)).toEqual(['bases'])
    const admin = assemblerCatalogue(lignes, [], { admin: true })
    expect(admin).toHaveLength(2)
    expect(admin.find(p => p.slug === 'b')?.brouillon).toBe(true)
  })

  it('groupe les leçons par module, dans l’ordre', () => {
    const [p] = assemblerCatalogue(pack() ? [pack()] : [], [
      lecon({ id: 'b', titre: 'B', module_titre: 'Suite', module_ordre: 1, ordre: 0 }),
      lecon({ id: 'a2', titre: 'A2', ordre: 2 }),
      lecon({ id: 'a1', titre: 'A1', ordre: 1 }),
    ], { admin: false })
    expect(p.modules.map(m => m.titre)).toEqual(['Démarrer', 'Suite'])
    expect(p.modules[0].lecons.map(l => l.id)).toEqual(['a1', 'a2'])
  })

  it('ne livre jamais le chemin de la vidéo, seulement qu’elle existe', () => {
    const [p] = assemblerCatalogue([pack()], [lecon({ video_path: 'l1/123.mp4' })], { admin: false })
    expect(p.modules[0].lecons[0].aVideo).toBe(true)
    expect(JSON.stringify(p)).not.toContain('123.mp4')
  })

  it('valeurs inconnues ramenées à des valeurs sûres', () => {
    const [p] = assemblerCatalogue([pack({ niveau: 'expert', statut: 'x', prix_cents: -5 })], [lecon({ type: 'zzz', duree_sec: null })], { admin: false })
    expect(p.niveau).toBe('debutant')
    expect(p.statut).toBe('bientot')
    expect(p.prixCents).toBe(0)
    expect(p.modules[0].lecons[0]).toMatchObject({ type: 'video', dureeSec: 0 })
  })
})
