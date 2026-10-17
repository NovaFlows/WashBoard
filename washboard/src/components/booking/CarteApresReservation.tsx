'use client'

import { formatPrice } from '@/lib/pricing'
import CarteFidelite3D from '@/components/fidelite/CarteFidelite3D'
import type { ApparenceCarte } from '@/lib/carteFidelite'

/** La carte de fidélité telle que le serveur la renvoie après la réservation (`api/bookings`). */
export type FideliteDue = {
  jeton: string
  remise: number
  etat: { progression: number; requis: number; disponibles: number }
  phrase: string
  /** Absente d'une réponse antérieure à la carte en 3D : on retombe alors sur l'encart texte. */
  carte?: ApparenceCarte
}

// Sur l'écran de confirmation : la récompense appliquée s'il y en a eu une, puis la carte qui
// apparaît, se retourne et dessine un tampon EN ATTENTE (option C retenue par Alexandre le
// 2026-10-18 : le vrai tampon arrive quand le laveur marque la prestation terminée, avec
// l'email « Votre tampon est arrivé »).
export default function CarteApresReservation({ fidelite }: { fidelite: FideliteDue; washerId?: string }) {
  const { etat, carte } = fidelite
  const complete = etat.disponibles > 0
  const surLaCarte = complete ? etat.requis : etat.progression
  const lien = `/fidelite/${fidelite.jeton}`

  if (!carte) {
    return (
      <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm leading-relaxed text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
        {fidelite.remise > 0 && <p className="font-semibold">Récompense fidélité appliquée : −{formatPrice(fidelite.remise)}</p>}
        <p className={fidelite.remise > 0 ? 'mt-1' : 'font-semibold'}>Carte de fidélité : {etat.progression} / {etat.requis}</p>
        <p className="mt-0.5 opacity-90">{fidelite.phrase}</p>
        <a href={lien} className="mt-2 inline-block font-semibold underline underline-offset-2">Voir ma carte</a>
      </div>
    )
  }

  return (
    <div className="mb-5">
      {fidelite.remise > 0 && (
        <p className="mx-auto w-fit rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
          Récompense fidélité appliquée : −{formatPrice(fidelite.remise)}
        </p>
      )}
      <div className="-mx-2">
        <CarteFidelite3D
          {...carte}
          requis={etat.requis}
          tampons={surLaCarte}
          scenario="reservation"
          largeur={340}
          legende={complete ? 'Votre récompense vous attend pour la prochaine réservation' : '+1 tampon dès que la prestation sera terminée'}
        />
      </div>
      <p className="mt-1 text-[13px] leading-snug text-slate-500 dark:text-slate-400">{fidelite.phrase}</p>
      <a href={lien} className="mt-1.5 inline-block text-[13.5px] font-semibold text-slate-900 underline underline-offset-4 dark:text-slate-100">Voir ma carte</a>
    </div>
  )
}
