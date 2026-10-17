'use client'

import { useEffect } from 'react'
import { cleStockageCarte } from '@/lib/fidelite'
import { formatPrice } from '@/lib/pricing'

/** La carte de fidélité telle que le serveur la renvoie après la réservation (`api/bookings`). */
export type FideliteDue = { jeton: string; remise: number; etat: { progression: number; requis: number; disponibles: number }; phrase: string }

// Sur l'écran de confirmation : la récompense appliquée s'il y en a eu une, où en est la
// carte, et le lien vers la page carte. Garde aussi le jeton sur l'appareil, pour le rappel
// de la prochaine visite (`RappelFidelite`).
export default function CarteApresReservation({ fidelite, washerId }: { fidelite: FideliteDue; washerId: string }) {
  useEffect(() => {
    try { window.localStorage.setItem(cleStockageCarte(washerId), fidelite.jeton) } catch { /* stockage refusé */ }
  }, [washerId, fidelite.jeton])

  return (
    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
      {fidelite.remise > 0 && <p className="font-semibold">Récompense fidélité appliquée : −{formatPrice(fidelite.remise)}</p>}
      <p className={fidelite.remise > 0 ? 'mt-1' : 'font-semibold'}>Carte de fidélité : {fidelite.etat.progression} / {fidelite.etat.requis}</p>
      <p className="mt-0.5 opacity-90">{fidelite.phrase}</p>
      <a href={`/fidelite/${fidelite.jeton}`} className="mt-2 inline-block font-semibold underline underline-offset-2">Voir ma carte</a>
    </div>
  )
}
