// « Paiement reçu » confirmé par l'équipe (api/support/laveurs/[id]/paiement) : règles pures.

import { ajouterMois, type Plan } from '@/lib/plan'

const OFFRES_PAYANTES: Plan[] = ['starter', 'pro', 'business']

export type SaisiePaiement = { offre: Plan; dureeMois: 1 | 12 }

export function validerPaiement(corps: unknown): SaisiePaiement | { erreur: string } {
  const c = (corps ?? {}) as { offre?: unknown; dureeMois?: unknown }
  if (typeof c.offre !== 'string' || !OFFRES_PAYANTES.includes(c.offre as Plan)) return { erreur: 'Choisissez une offre payante.' }
  if (c.dureeMois !== 1 && c.dureeMois !== 12) return { erreur: 'La durée payée est d’un mois ou d’un an.' }
  return { offre: c.offre as Plan, dureeMois: c.dureeMois }
}

/** Fin de la période payée. Elle part de la fin de ce qui couvre déjà le laveur :
 *  un renouvellement s'ajoute à la période en cours, un filleul qui paie pendant son
 *  essai garde ses jours gratuits. Sinon, elle part d'aujourd'hui. */
export function payeJusquAu(
  w: { subscription_status?: string | null; trial_ends_at?: string | null; subscription_ends_at?: string | null },
  dureeMois: number,
  now: Date = new Date(),
): string {
  const futur = (iso?: string | null) => {
    const d = iso ? new Date(iso) : null
    return d && d.getTime() > now.getTime() ? d : null
  }
  const depart =
    (w.subscription_status === 'active' || w.subscription_status === 'past_due' ? futur(w.subscription_ends_at) : null)
    ?? (w.subscription_status === 'trial' ? futur(w.trial_ends_at) : null)
    ?? now
  return ajouterMois(depart, dureeMois).toISOString()
}
