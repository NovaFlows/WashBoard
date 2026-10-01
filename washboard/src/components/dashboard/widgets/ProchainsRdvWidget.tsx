import Link from 'next/link'
import { formatHeure } from '@/lib/dateUtils'

// Ce qui arrive APRÈS aujourd'hui — distinct du widget Aujourd'hui, avec
// lequel il ferait sinon doublon. Trois rendez-vous suffisent : c'est un
// aperçu, pas un remplacement du calendrier ou de la liste « À venir » plus
// bas sur la page.

export type ProchainRdv = {
  id: string
  /** `null` sur une réservation verrouillée : `masquerVerrouillees` l'a déjà retiré. */
  client_name: string | null
  scheduled_at: string
  /** Réservation au-delà du quota : le jour seulement. */
  verrouillee?: boolean
  services: { name: string } | null
}

export function ProchainsRdvWidget({ bookings }: { bookings: ProchainRdv[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        Prochains rendez-vous
      </h2>

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
                    {/* Verrouillee : un cadenas a la place de l'heure. Le JOUR est deja
                      donne ailleurs — colonne de gauche ici, titre du bloc
                      pour « Aujourd'hui » — donc le repeter en toutes lettres
                      dedoublait l'information ET poussait le nom du client hors
                      du cadre. L'heure, elle, permettrait d'honorer le
                      rendez-vous sans jamais payer : il suffirait d'attendre
                      sur place. */}
                  {b.verrouillee
                    ? <span title="Heure masquée — changez d’offre pour la voir" aria-label="Heure masquée">🔒</span>
                    : formatHeure(date)}
                  </span>
                  {b.verrouillee ? (
                    <span className="min-w-0">
                      <span className="sr-only">Client masqué</span>
                      <span className="block h-3 w-20 rounded bg-slate-200 dark:bg-slate-700 blur-[3px]" aria-hidden />
                    </span>
                  ) : (
                    <span className="text-sm text-slate-800 dark:text-slate-200 truncate min-w-0">
                      {b.client_name}
                    </span>
                  )}
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
