import { createAdminClient } from '@/lib/supabase/admin'
import { CATALOGUE_DEMO, type Lecon, type NiveauFormation, type PackFormation, type TypeLecon } from '@/lib/formation'

// Catalogue de la formation LU EN BASE (branche feat/formation, 2026-11-11), tables
// `formation_packs` et `formation_lecons` (voir docs/FORMATION.md). Les deux tables ne sont lisibles
// que par la clé service_role : jamais d'accès direct depuis le navigateur, tout passe par le
// serveur, qui décide qui voit quoi.
//
// Repli sur le catalogue d'EXEMPLE tant que les tables n'existent pas (ou sont vides) : l'écran
// reste visible avant que le SQL ait été lancé.

export type LignePack = {
  id: string
  slug: string
  titre: string
  accroche: string | null
  description: string | null
  niveau: string | null
  prix_cents: number | null
  statut: string | null
  objectifs: string[] | null
  publie: boolean | null
  ordre: number | null
}

export type LigneLecon = {
  id: string
  pack_id: string
  module_titre: string | null
  module_ordre: number | null
  ordre: number | null
  titre: string
  type: string | null
  duree_sec: number | null
  apercu_gratuit: boolean | null
  video_path: string | null
}

const NIVEAUX: NiveauFormation[] = ['debutant', 'intermediaire', 'avance']
const TYPES: TypeLecon[] = ['video', 'lecture', 'quiz']

/** Assemble les lignes de base en packs → modules → leçons, dans l'ordre. Pur, donc testable. */
export function assemblerCatalogue(packs: LignePack[], lecons: LigneLecon[], { admin }: { admin: boolean }): PackFormation[] {
  return packs
    .filter(p => admin || p.publie)
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0) || a.titre.localeCompare(b.titre, 'fr'))
    .map(p => {
      const siennes = lecons
        .filter(l => l.pack_id === p.id)
        .sort((a, b) => (a.module_ordre ?? 0) - (b.module_ordre ?? 0) || (a.ordre ?? 0) - (b.ordre ?? 0))
      const modules: PackFormation['modules'] = []
      for (const l of siennes) {
        const titreModule = l.module_titre?.trim() || 'Leçons'
        let mod = modules.find(m => m.titre === titreModule)
        if (!mod) {
          mod = { id: `${p.id}:${modules.length}`, titre: titreModule, lecons: [] }
          modules.push(mod)
        }
        const lecon: Lecon = {
          id: l.id,
          titre: l.titre,
          type: TYPES.includes(l.type as TypeLecon) ? (l.type as TypeLecon) : 'video',
          dureeSec: Math.max(0, l.duree_sec ?? 0),
          apercuGratuit: !!l.apercu_gratuit,
          aVideo: !!l.video_path,
        }
        mod.lecons.push(lecon)
      }
      return {
        id: p.id,
        slug: p.slug,
        titre: p.titre,
        accroche: p.accroche ?? '',
        description: p.description ?? '',
        niveau: NIVEAUX.includes(p.niveau as NiveauFormation) ? (p.niveau as NiveauFormation) : 'debutant',
        prixCents: Math.max(0, p.prix_cents ?? 0),
        statut: p.statut === 'disponible' ? 'disponible' : 'bientot',
        objectifs: p.objectifs ?? [],
        modules,
        brouillon: !p.publie,
      } satisfies PackFormation
    })
}

/** Le catalogue vu par ce compte : les administrateurs voient aussi les brouillons. */
export async function chargerCatalogue({ admin }: { admin: boolean }): Promise<{ packs: PackFormation[]; demo: boolean }> {
  try {
    const db = createAdminClient()
    const [p, l] = await Promise.all([
      db.from('formation_packs').select('id, slug, titre, accroche, description, niveau, prix_cents, statut, objectifs, publie, ordre'),
      db.from('formation_lecons').select('id, pack_id, module_titre, module_ordre, ordre, titre, type, duree_sec, apercu_gratuit, video_path'),
    ])
    // Tables absentes (SQL pas encore lancé) : on montre l'exemple, jamais un écran cassé.
    if (p.error || l.error) return { packs: CATALOGUE_DEMO, demo: true }
    // Tables vides : l'administrateur voit une page vide à remplir, les autres l'exemple.
    if (!p.data || p.data.length === 0) return { packs: admin ? [] : CATALOGUE_DEMO, demo: !admin }
    return { packs: assemblerCatalogue(p.data as LignePack[], (l.data ?? []) as LigneLecon[], { admin }), demo: false }
  } catch {
    return { packs: CATALOGUE_DEMO, demo: true }
  }
}

/** Le fichier vidéo d'une leçon (serveur seulement) : jamais renvoyé tel quel au navigateur. */
export async function cheminVideoDeLecon(leconId: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient().from('formation_lecons').select('video_path').eq('id', leconId).maybeSingle()
    return data?.video_path ?? null
  } catch {
    return null
  }
}
