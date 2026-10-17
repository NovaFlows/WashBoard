import { formatPrice } from '@/lib/pricing'

/** L'acompte tel que le serveur le renvoie après la réservation (`api/bookings`). */
export type AcompteDu = { montant: number; lien: string; echeance: string | null; conditions: string[] }

// L'acompte demandé par le laveur (lib/acompte.ts), dit au client à deux moments :
// - AVANT de réserver (`lien` absent) : montant et conditions, pour qu'il s'engage en
//   connaissance de cause (remboursement, délai) ;
// - APRÈS (`lien` présent) : le bouton qui ouvre le lien de paiement du laveur.
// Le paiement ne passe jamais par WashBoard : on ne sait pas s'il a eu lieu, c'est le
// laveur qui le confirme dans son tableau de bord.

export default function EncartAcompte({ montant, conditions, lien, accent = '#2563eb' }: {
  montant: number
  conditions: string[]
  lien?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
        {lien ? 'Acompte à régler maintenant' : 'Un acompte vous sera demandé'} : {formatPrice(montant)}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-zinc-500 dark:text-zinc-400">
        {conditions.map(c => <li key={c}>{c}</li>)}
      </ul>
      {lien && (
        <a
          href={lien}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold text-white"
          style={{ background: accent }}
        >
          Payer l’acompte
        </a>
      )}
    </div>
  )
}
