// Arbre des parrainages pour l'équipe, et signaux à vérifier (pas de blocage : on regarde).

import { statutFilleul, type StatutFilleul } from '@/lib/parrainage'

type Laveur = {
  id: string
  name: string
  plan?: string | null
  grandfathered?: boolean | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  cgv_acceptees_ip?: string | null
  facture_siret?: string | null
}

export type LigneParrainage = {
  id: string
  cree_le: string
  ip_inscription: string | null
  recompense_le: string | null
  recompense_forme: string | null
  parrain: Laveur | null
  filleul: Laveur | null
}

export type Signal = 'meme_connexion' | 'meme_siret' | 'recompenses_rapprochees'

export type Noeud = {
  id: string
  nom: string
  statut: StatutFilleul
  plan: string | null
  /** Mois gagnés par ce laveur en tant que parrain. */
  moisGagnes: number
  filleuls: (Noeud & { inscritLe: string; recompenseLe: string | null; signaux: Signal[] })[]
}

export const SEUIL_RECOMPENSES_30_JOURS = 3

function siretNet(s?: string | null): string | null {
  const n = (s ?? '').replace(/\s/g, '')
  return n.length >= 9 ? n : null
}

/** Racines = laveurs qui parrainent sans avoir été parrainés. Chaque laveur n'a qu'un parrain,
 *  donc l'arbre n'a pas de cycle ; un garde-fou évite quand même de boucler sur une donnée abîmée. */
export function construireArbre(lignes: LigneParrainage[], now: Date = new Date()): { racines: Noeud[]; total: number; recompenses: number } {
  const valides = lignes.filter(l => l.parrain && l.filleul)
  const parParrain = new Map<string, LigneParrainage[]>()
  for (const l of valides) parParrain.set(l.parrain!.id, [...(parParrain.get(l.parrain!.id) ?? []), l])
  const filleuls = new Set(valides.map(l => l.filleul!.id))

  const recompensesRecentes = (parrainId: string, autour: string): number => {
    const t = new Date(autour).getTime()
    return (parParrain.get(parrainId) ?? []).filter(l => {
      if (!l.recompense_le || !l.recompense_forme || l.recompense_forme === 'aucune') return false
      return Math.abs(new Date(l.recompense_le).getTime() - t) <= 30 * 24 * 60 * 60 * 1000
    }).length
  }

  const noeud = (w: Laveur, vus: Set<string>): Noeud => {
    const enfants = vus.has(w.id) ? [] : (parParrain.get(w.id) ?? [])
    const suite = new Set(vus).add(w.id)
    return {
      id: w.id,
      nom: w.name,
      statut: statutFilleul(w, now),
      plan: w.plan ?? null,
      moisGagnes: enfants.filter(l => l.recompense_le && l.recompense_forme && l.recompense_forme !== 'aucune').length,
      filleuls: enfants.map(l => {
        const signaux: Signal[] = []
        if (l.ip_inscription && l.ip_inscription === w.cgv_acceptees_ip) signaux.push('meme_connexion')
        const a = siretNet(w.facture_siret), b = siretNet(l.filleul!.facture_siret)
        if (a && a === b) signaux.push('meme_siret')
        if (l.recompense_le && recompensesRecentes(w.id, l.recompense_le) > SEUIL_RECOMPENSES_30_JOURS) signaux.push('recompenses_rapprochees')
        return { ...noeud(l.filleul!, suite), inscritLe: l.cree_le, recompenseLe: l.recompense_le, signaux }
      }),
    }
  }

  const racines: Noeud[] = []
  const dejaRacine = new Set<string>()
  for (const l of valides) {
    const p = l.parrain!
    if (filleuls.has(p.id) || dejaRacine.has(p.id)) continue
    dejaRacine.add(p.id)
    racines.push(noeud(p, new Set()))
  }
  return {
    racines,
    total: valides.length,
    recompenses: valides.filter(l => l.recompense_le && l.recompense_forme !== 'aucune').length,
  }
}
