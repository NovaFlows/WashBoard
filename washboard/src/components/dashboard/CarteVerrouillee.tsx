import Link from 'next/link'
import { jourSeul } from '@/lib/reservationsVerrouillees'

const BLEU = '#1651E8'

/** Une réservation au-delà du quota, rendue comme les autres — mais floutée.
 *
 *  Le choix vient d'un test utilisateur : une carte À PART, dans un encadré
 *  dédié au-dessus de la liste, se lisait comme une publicité et se sautait
 *  comme une publicité. À sa place dans la liste, avec la même forme que ses
 *  voisines, elle se lit comme ce qu'elle est : un rendez-vous qui manque.
 *
 *  Ce qui est flouté l'est VISUELLEMENT, et c'est une décoration, pas une
 *  serrure. La vraie serrure est en amont : le téléphone, l'adresse, l'heure
 *  et le montant ne sont jamais chargés (voir `masquerVerrouillees`). Ce qui
 *  reste ici, c'est le nom et le jour — ce qu'on a décidé de montrer — plus des
 *  barres grises à la place du reste. Jamais de fausse valeur : une heure
 *  inventée sous un flou resterait une heure inventée.
 */
export function CarteVerrouillee({ clientName, scheduledAt, offre }: {
  clientName: string | null
  scheduledAt: string
  /** Nom de l'offre qui débloque — « Starter », « Pro ». */
  offre: string
}) {
  const jour = jourSeul(scheduledAt)

  return (
    <div className="relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* La carte, à la forme exacte de ses voisines. `pointer-events-none` et
          `select-none` : elle n'est ni cliquable ni copiable, sinon le flou
          passerait pour un défaut d'affichage sur un élément qui répond. */}
      <div className="p-4 blur-[4px] select-none pointer-events-none" aria-hidden>
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
            {clientName || 'Client'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Confirmé
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 mb-1">
          <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="capitalize">{jour ?? 'Date'}</span>
          {/* L'heure n'existe pas ici : une barre à sa place, pas un chiffre. */}
          <span className="inline-block h-3 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
          <span className="inline-block h-3 w-10 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>

      {/* Le cadenas et la sortie, nets par-dessus. Le voile blanc empêche le
          texte de se poser sur un fond flou qui le rendrait illisible. */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 px-4 bg-white/60 dark:bg-slate-900/65">
        <svg className="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <Link
          href="/dashboard/abonnement"
          className="text-xs font-bold hover:underline"
          style={{ color: BLEU }}
        >
          Débloquer avec le plan {offre}
        </Link>
      </div>
    </div>
  )
}
