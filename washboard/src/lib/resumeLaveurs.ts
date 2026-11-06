import { analyserLaveur, type DonneesLaveur } from '@/lib/ficheLaveur'
import { estAppel, relancePrevue, type Appel } from '@/lib/suiviAppels'
import { COMPTES_INTERNES_EXCLUS_DIFFUSION } from '@/lib/plan'

// Résumé d'un laveur pour la liste et le tableau de bord de l'espace équipe :
// calculé côté serveur, seul ce qui s'affiche part au navigateur.

export type LaveurResume = {
  id: string
  name: string
  slug: string
  phone: string | null
  creeLe: string
  statut: string
  /** « Encore 3 jours (jusqu'au 8 nov.) », « Offre gratuite »… */
  statutDetail: string | null
  ton: 'ok' | 'attention' | 'alerte' | 'neutre'
  priorite: 1 | 2 | 3
  pagePrete: boolean
  enEssai: boolean
  /** Abonnement payé, ou client historique (accès complet sans abonnement). */
  payant: boolean
  source: string | null
  visites30: number
  reservations30: number
  chiffre30: number
  /** Réservations créées dans les dernières 24 h (annulées exclues), dont celles prises en ligne. */
  reservations24h: number
  reservations24hEnLigne: number
  derniereConnexion: string | null
  /** Relance prévue (due ou à venir) : la liste « À rappeler » la range par jour. */
  relance: { le: string; action: string | null } | null
  /** Membre de l'équipe qui suit ce laveur (voir lib/responsables.ts). */
  responsable: string | null
  dernierAppel: { le: string; resultat: string } | null
}

/** `exclure` : la fiche laveur du compte de l'équipe elle-même (AutoNett), qui n'est pas un client.
 *  `responsables` : washer_id → prénom du membre qui le suit. */
export function resumerLaveurs(tous: DonneesLaveur[], appels: Appel[], { now = new Date(), exclure, responsables = {} }: { now?: Date; exclure?: string | null; responsables?: Record<string, string> } = {}): LaveurResume[] {
  const parLaveur = new Map<string, Appel[]>()
  for (const a of appels) parLaveur.set(a.washer_id, [...(parLaveur.get(a.washer_id) ?? []), a])

  return tous
    .filter(d => !COMPTES_INTERNES_EXCLUS_DIFFUSION.includes(d.washer.slug) && d.washer.id !== exclure)
    .map(d => {
      const topo = analyserLaveur(d, now)
      const siens = parLaveur.get(d.washer.id) ?? []
      const prevue = relancePrevue(siens)
      const dernierAppel = siens.find(estAppel)
      const resa24h = d.reservations.filter(r => r.status !== 'cancelled' && now.getTime() - Date.parse(r.created_at) < 864e5)
      return {
        id: d.washer.id, name: d.washer.name, slug: d.washer.slug, phone: d.washer.phone, creeLe: d.washer.created_at,
        statut: topo.statut.libelle, statutDetail: topo.statut.detail, ton: topo.statut.ton, priorite: topo.priorite, pagePrete: topo.pagePrete,
        enEssai: topo.statut.libelle.startsWith('En essai'),
        payant: topo.statut.libelle.startsWith('Payant') || topo.statut.libelle === 'Client historique',
        source: topo.source,
        visites30: topo.activite.visites30, reservations30: topo.activite.reservations30, chiffre30: topo.activite.chiffre30,
        reservations24h: resa24h.length, reservations24hEnLigne: resa24h.filter(r => !r.saisie_par_laveur).length,
        derniereConnexion: topo.activite.derniereConnexion,
        responsable: responsables[d.washer.id] ?? null,
        relance: prevue ? { le: prevue.relancer_le!, action: prevue.prochaine_action } : null,
        dernierAppel: dernierAppel ? { le: dernierAppel.appele_le, resultat: dernierAppel.resultat } : null,
      }
    })
}

/** Inscriptions par semaine (lundi → dimanche, heure de Paris), les `n` dernières, la plus ancienne d'abord. */
export function inscriptionsParSemaine(laveurs: Pick<LaveurResume, 'creeLe'>[], now: Date, n = 8): { debut: string; nombre: number }[] {
  const jourParis = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const auj = new Date(`${jourParis(now)}T12:00:00Z`)
  const lundi = new Date(auj.getTime() - ((auj.getUTCDay() + 6) % 7) * 864e5)
  const semaines = Array.from({ length: n }, (_, i) => {
    const debut = new Date(lundi.getTime() - (n - 1 - i) * 7 * 864e5)
    return { debut: debut.toISOString().slice(0, 10), nombre: 0 }
  })
  // Une inscription plus ancienne que la première semaine ne tombe dans aucune case.
  for (const l of laveurs) {
    const jour = jourParis(new Date(l.creeLe))
    const semaine = semaines.findLast(s => jour >= s.debut)
    if (semaine) semaine.nombre++
  }
  return semaines
}
