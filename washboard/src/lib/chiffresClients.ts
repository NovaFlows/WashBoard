// Onglet « Clients » de Chiffres : qui a rapporté quoi sur la période choisie,
// pour tous les clients, les particuliers ou les professionnels.
//
// DÉFINITION DU CHIFFRE D'AFFAIRES — celle du CRM (`crmStats.ts`,
// `clientProfile.ts`) : rendez-vous `confirmed` + `done`, au prix
// `booked_price ?? services.price`. Le prévisionnel accepté compte, la remise
// « créneau optimisé » n'est pas déduite. C'est DIFFÉRENT de l'onglet Argent
// (terminé seulement, net de remise, `chiffresArgent.ts`) : les deux onglets
// n'ont pas à donner le même total, et l'écran le dit (voir ChiffresClients).
//
// Le filtre porte sur `is_professional` de chaque RÉSERVATION, comme l'ancien
// CRM (`CrmDashboard.tsx`) — pas sur la dernière valeur connue du client,
// comme le fait la liste Clients. Une réservation passée en tant que
// particulier reste dans « Particuliers » même si le client s'est déclaré pro
// depuis.

import { listeClients, type ResumeClient } from './listeClients'
import type { ClientBooking } from './clientProfile'
import { comptePourLeCA, effectivePrice } from './crmStats'
import { bornesInstants, type PeriodeChiffres } from './chiffresPeriode'

export type FiltreClients = 'tous' | 'particuliers' | 'pros'

export type StatsClients = {
  /** Réservations de la période, tous types confondus. */
  nbReservations: number
  /** Clients ayant au moins un rendez-vous honoré dans la période (filtre appliqué). */
  actifs: ResumeClient[]
  totalCA: number
  valeurMoyenne: number
  meilleurs: ResumeClient[]
  /** Part des clients pros dans le CA et dans les rendez-vous de la période,
   *  filtre ignoré (il n'aurait pas de sens : 100 % ou 0 %). */
  partCaPro: number
  partRdvPro: number
}

const arrondiPct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0)

export function reservationsDeLaPeriode(bookings: ClientBooking[], p: PeriodeChiffres): ClientBooking[] {
  const { debut, fin } = bornesInstants(p)
  return bookings.filter(b => {
    const t = new Date(b.scheduled_at).getTime()
    return Number.isFinite(t) && t >= debut.getTime() && t < fin.getTime()
  })
}

export function statsClients(
  bookings: ClientBooking[], p: PeriodeChiffres, filtre: FiltreClients, maintenant: Date,
): StatsClients {
  const dansLaPeriode = reservationsDeLaPeriode(bookings, p)

  const filtrees = filtre === 'tous'
    ? dansLaPeriode
    : dansLaPeriode.filter(b => (filtre === 'pros') === !!b.is_professional)

  const clients = listeClients(filtrees, maintenant)
  const actifs = clients.filter(c => c.honoredCount > 0)
  const totalCA = actifs.reduce((s, c) => s + c.totalRevenue, 0)
  const meilleurs = [...actifs].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5)

  const comptees = dansLaPeriode.filter(comptePourLeCA)
  const caTotal = comptees.reduce((s, b) => s + effectivePrice(b), 0)
  const pros = comptees.filter(b => b.is_professional)
  const caPro = pros.reduce((s, b) => s + effectivePrice(b), 0)

  return {
    nbReservations: dansLaPeriode.length,
    actifs,
    totalCA,
    valeurMoyenne: actifs.length ? totalCA / actifs.length : 0,
    meilleurs,
    partCaPro: arrondiPct(caPro, caTotal),
    partRdvPro: arrondiPct(pros.length, comptees.length),
  }
}
