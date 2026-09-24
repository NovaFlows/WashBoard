// Onglet « Argent » de Chiffres : encaissé, dépensé et résultat d'une période,
// et le détail créneau par créneau qui nourrit le graphique.
//
// DÉFINITION DU CHIFFRE D'AFFAIRES — celle de la Comptabilité, pas celle du
// CRM. Deux définitions coexistent dans le produit et ne doivent pas se
// mélanger sur un même écran :
//   - Comptabilité (`/api/compta/revenue`, ici) : `status = 'done'` seulement,
//     au prix réellement encaissé net de la remise « créneau optimisé »
//     (`revenuNet` de `pricing.ts`) ;
//   - CRM (`crmStats.ts`, onglet Clients) : `confirmed` + `done`, au prix
//     `booked_price ?? services.price` — le prévisionnel accepté compte.
// L'encaissé affiché ET chaque barre du graphique passent par `revenuNet` :
// la somme des barres est, par construction, le chiffre « Encaissé ».
//
// Écart assumé avec `/api/compta/revenue` : la route borne la période sur
// `scheduled_at` avec `start + 'T00:00:00'` sans fuseau, donc en UTC — un
// rendez-vous entre minuit et 2 h à Paris (1 h l'hiver) compte dans le jour
// PRÉCÉDENT. Ici les jours se découpent à l'heure de Paris, comme le reste de
// l'application (`dateUtils.FUSEAU`). Les deux ne diffèrent que pour un
// rendez-vous de nuit, à une frontière de période.

import { revenuNet } from './pricing'
import {
  creneauDe, cleCreneauDuJour, creneauxDe, jourParisDe, plageDe, rognerHeures,
  type Creneau, type PeriodeChiffres,
} from './chiffresPeriode'

export type ReservationArgent = {
  status: string
  scheduled_at: string
  booked_price: number | null
  smart_discount?: number | null
  is_smart_slot?: boolean | null
}

/** Une dépense, telle que `/api/expenses` la renvoie (le montant peut arriver
 *  en chaîne selon le type de la colonne). */
export type FraisArgent = { date: string; amount: number | string }

export type PointArgent = Creneau & {
  encaisse: number
  depense: number
  /** `encaisse − depense` du créneau. En vue « jour », les frais n'ont pas
   *  d'heure : ils ne sont rangés dans aucune barre, et `resultat` vaut
   *  l'encaissé de l'heure. */
  resultat: number
  /** Créneau qui n'a pas encore eu lieu (période en cours). */
  futur: boolean
  /** Créneau en cours (période en cours). */
  courant: boolean
}

export type SerieArgent = {
  points: PointArgent[]
  encaisse: number
  depense: number
  resultat: number
  /** Rendez-vous terminés comptés dans la période. */
  nbTermines: number
  /** Les frais sont-ils répartis dans les barres ? Faux en vue « jour ». */
  fraisParCreneau: boolean
  /** Ni encaissé ni frais : rien à dessiner. */
  vide: boolean
}

const estTermine = (b: ReservationArgent) => b.status === 'done'

/** Net d'une réservation terminée : `revenuNet` (celui de la route Compta)
 *  appliqué à cette seule ligne. */
const netDe = (b: ReservationArgent): number => revenuNet([{
  booked_price: b.booked_price,
  smart_discount: b.smart_discount ?? null,
  is_smart_slot: b.is_smart_slot ?? null,
}])

const montant = (f: FraisArgent): number => {
  const n = Number(f.amount)
  return Number.isFinite(n) ? n : 0
}

/** Totaux seuls, sans créneaux — sert à la période précédente, pour l'écart. */
export function totauxArgent(
  p: PeriodeChiffres, reservations: ReservationArgent[], frais: FraisArgent[],
): { encaisse: number; depense: number; resultat: number } {
  const { debut, fin } = plageDe(p)
  let encaisse = 0
  for (const b of reservations) {
    if (!estTermine(b)) continue
    const jour = jourParisDe(b.scheduled_at)
    if (jour && jour >= debut && jour <= fin) encaisse += netDe(b)
  }
  const depense = frais.reduce((s, f) => (f.date >= debut && f.date <= fin ? s + montant(f) : s), 0)
  return { encaisse, depense, resultat: encaisse - depense }
}

/** Le détail d'une période, créneau par créneau.
 *
 *  `maintenant` marque le créneau en cours et les créneaux à venir : sur le
 *  mois en cours, les jours qui restent n'ont pas de barre, pas une barre à
 *  zéro qui laisserait croire à une journée sans recette. */
export function serieArgent(
  p: PeriodeChiffres,
  reservations: ReservationArgent[],
  frais: FraisArgent[],
  maintenant: number,
): SerieArgent {
  const creneaux = creneauxDe(p)
  const parCle = new Map(creneaux.map(c => [c.cle, { encaisse: 0, depense: 0 }]))
  const { debut, fin } = plageDe(p)
  let nbTermines = 0

  for (const b of reservations) {
    if (!estTermine(b)) continue
    const c = creneauDe(p, b.scheduled_at)
    if (!c || c.jour < debut || c.jour > fin) continue
    const case_ = parCle.get(c.cle)
    if (!case_) continue
    case_.encaisse += netDe(b)
    nbTermines++
  }

  let depenseTotale = 0
  for (const f of frais) {
    if (f.date < debut || f.date > fin) continue
    depenseTotale += montant(f)
    const cle = cleCreneauDuJour(p, f.date)
    const case_ = cle ? parCle.get(cle) : undefined
    if (case_) case_.depense += montant(f)
  }

  const now = creneauDe(p, maintenant)
  const enCours = !!now && now.jour >= debut && now.jour <= fin

  let points: PointArgent[] = creneaux.map(c => {
    const v = parCle.get(c.cle)!
    return {
      ...c,
      encaisse: v.encaisse,
      depense: v.depense,
      resultat: v.encaisse - v.depense,
      // « À venir » seulement s'il n'y a rien : un rendez-vous clôturé avant
      // son heure (ou une date de test dans le futur) est bel et bien compté
      // dans « Encaissé », sa barre doit donc rester visible — sinon la somme
      // des barres ne ferait plus le total. Constaté sur le compte de test :
      // un rendez-vous terminé le dimanche 27 alors qu'on est le 24.
      futur: enCours && c.cle > now!.cle && v.encaisse === 0 && v.depense === 0,
      courant: enCours && c.cle === now!.cle,
    }
  })

  if (p.type === 'jour') {
    points = rognerHeures(points, x => x.encaisse !== 0 || x.courant)
  }

  const encaisse = points.reduce((s, x) => s + x.encaisse, 0)
  return {
    points,
    encaisse,
    depense: depenseTotale,
    resultat: encaisse - depenseTotale,
    nbTermines,
    fraisParCreneau: p.type !== 'jour',
    vide: nbTermines === 0 && depenseTotale === 0,
  }
}

/** Premier jour (`AAAA-MM-JJ`, à Paris) où le laveur a un rendez-vous, tous
 *  statuts confondus. Sert à dire « pas de données avant… » plutôt que de
 *  montrer un graphique vide qui laisserait croire à des mois à zéro. */
export function premierJourDeDonnee(reservations: { scheduled_at: string }[]): string | null {
  let premier: string | null = null
  for (const b of reservations) {
    const jour = jourParisDe(b.scheduled_at)
    if (jour && (!premier || jour < premier)) premier = jour
  }
  return premier
}

/** La période entière précède-t-elle `jour` ? */
export function finitAvant(p: PeriodeChiffres, jour: string | null): boolean {
  return !!jour && plageDe(p).fin < jour
}
