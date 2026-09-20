import Link from 'next/link'
import { formatHeure } from '@/lib/dateUtils'

// Ce qui arrive APRÈS aujourd'hui — distinct du widget Aujourd'hui, avec
// lequel il ferait sinon doublon. Trois rendez-vous suffisent : c'est un
// aperçu, pas un remplacement du calendrier ou de la liste « À venir » plus
// bas sur la page.

export type ProchainRdv = {
  id: string
  client_name: string
  scheduled_at: string
  services: { name: string } | null
}

export function ProchainsRdvWidget({ bookings }: { bookings: ProchainRdv[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Prochains rendez-vous</h2>

      {bookings.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Rien de prévu pour l’instant.</p>
      ) : (
        <ul className="space-y-1.5">
          {bookings.map(b => {
            const date = new Date(b.scheduled_at)
            return (
              <li key={b.id}>
                <Link
                  href={`/dashboard/calendrier?rdv=${b.id}`}
                  className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0 w-14">
                    {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                    {formatHeure(date)}
                  </span>
                  <span className="text-sm text-slate-800 dark:text-slate-200 truncate min-w-0">
                    {b.client_name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 truncate min-w-0 ml-auto">
                    {b.services?.name ?? 'Prestation'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
