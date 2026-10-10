// « Les relances qui marchent » (Chiffres › Clients) : combien de relances sont parties sur la
// période, et combien de ces clients ont repris rendez-vous ensuite.
//
// Ce que la base ne dit PAS, et que ce calcul reconstitue : `followup_sent_at` marque une relance
// TRAITÉE — envoyée, ou close sans envoi parce que le client était déjà revenu (voir
// `lib/relances.ts`). Une relance est donc comptée comme envoyée seulement si, au moment où elle a
// été traitée, le client n'avait aucun rendez-vous plus récent déjà pris : c'est exactement le cas
// où le cron envoie. Restent indiscernables (rares) : les clients « ne plus contacter » et ceux
// sans moyen de contact pour le canal choisi, clos sans envoi eux aussi.
//
// Le canal (SMS ou email) n'est pas conservé par relance : on ne compare donc pas les canaux.

import { cleClient } from '@/lib/clientProfile'
import { bornesInstants, type PeriodeChiffres } from '@/lib/chiffresPeriode'

export type ReservationRelance = {
  id: string
  status: string
  scheduled_at: string
  created_at?: string | null
  followup_sent_at?: string | null
  client_email?: string | null
  client_phone?: string | null
}

export type StatsRelances = {
  /** Relances parties pendant la période. */
  envoyees: number
  /** Parmi elles, clients qui ont pris un nouveau rendez-vous (non annulé) après la relance. */
  revenus: number
}

const temps = (iso?: string | null) => {
  const t = iso ? new Date(iso).getTime() : NaN
  return Number.isFinite(t) ? t : null
}

export function statsRelances(bookings: ReservationRelance[], p: PeriodeChiffres): StatsRelances {
  const { debut, fin } = bornesInstants(p)

  const parClient = new Map<string, ReservationRelance[]>()
  for (const b of bookings) {
    const k = cleClient(b.client_email, b.client_phone)
    if (!k) continue
    const liste = parClient.get(k)
    if (liste) liste.push(b)
    else parClient.set(k, [b])
  }

  let envoyees = 0
  let revenus = 0
  for (const siens of parClient.values()) {
    for (const b of siens) {
      const relance = temps(b.followup_sent_at)
      if (relance === null || relance < debut.getTime() || relance >= fin.getTime()) continue
      const rdv = temps(b.scheduled_at) ?? 0

      const autres = siens.filter(o => o.id !== b.id && o.status !== 'cancelled')
      // Un rendez-vous plus récent déjà pris au moment de la relance : elle a été close, pas envoyée.
      // Date de création inconnue : on ne peut pas affirmer qu'elle est partie, on ne la compte pas.
      const close = autres.some(o => (temps(o.scheduled_at) ?? 0) > rdv && (temps(o.created_at) ?? -Infinity) < relance)
      if (close) continue

      envoyees++
      if (autres.some(o => (temps(o.created_at) ?? -Infinity) >= relance)) revenus++
    }
  }
  return { envoyees, revenus }
}
