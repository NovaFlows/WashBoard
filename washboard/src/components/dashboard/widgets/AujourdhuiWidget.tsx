import Link from 'next/link'
import { formatHeure } from '@/lib/dateUtils'

// Aujourd'hui : ce qui reste à faire, en un coup d'œil.
//
// Distinct de la liste « À venir » (qui montre tout le futur, et peut
// s'allonger sur des semaines) : ce widget ne répond qu'à une question,
// « qu'est-ce qui m'attend aujourd'hui ? ». Il reprend donc uniquement les
// rendez-vous en attente ou confirmés du jour — pas ceux déjà clôturés, qui
// n'ont plus rien à demander au laveur.

export type RdvDuJour = {
  id: string
  client_name: string
  scheduled_at: string
  services: { name: string } | null
  status: string
}

const STATUT_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
}

export function AujourdhuiWidget({ bookings }: { bookings: RdvDuJour[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Aujourd’hui</h2>

      {bookings.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Rien de prévu aujourd’hui.</p>
      ) : (
        <ul className="space-y-1.5">
          {bookings.map(b => (
            <li key={b.id}>
              {/* Même adresse que la notification de nouvelle réservation :
                  ouvre directement la fiche dans le calendrier, plutôt que le
                  mois en cours à chercher dedans. */}
              <Link
                href={`/dashboard/calendrier?rdv=${b.id}`}
                className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUT_DOT[b.status] ?? 'bg-slate-300'}`} aria-hidden="true" />
                <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                  {formatHeure(new Date(b.scheduled_at))}
                </span>
                <span className="text-sm text-slate-800 dark:text-slate-200 truncate min-w-0">
                  {b.client_name}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate min-w-0 ml-auto">
                  {b.services?.name ?? 'Prestation'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
