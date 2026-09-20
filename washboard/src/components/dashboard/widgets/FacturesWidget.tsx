import Link from 'next/link'
import { formatPrice } from '@/lib/pricing'

// Ne compte que les factures ÉMISES par WashBoard ce mois-ci (bookings avec
// un facture_numero) — pas les factures d'achat importées, dont le montant
// n'est pas garanti fiable pour une somme (voir listeFactures.ts). Le lien
// mène à la page complète, qui les affiche toutes.

export function FacturesWidget({ nombre, montant }: { nombre: number; montant: number }) {
  return (
    <Link
      href="/dashboard/factures"
      className="block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100 hover:border-slate-300 dark:hover:border-slate-700"
    >
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Factures</h2>
      {nombre === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Aucune facture ce mois-ci.</p>
      ) : (
        <div className="flex items-end gap-4">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{nombre}</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">{nombre > 1 ? 'factures ce mois-ci' : 'facture ce mois-ci'}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatPrice(montant)}</p>
            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">facturés</p>
          </div>
        </div>
      )}
    </Link>
  )
}
