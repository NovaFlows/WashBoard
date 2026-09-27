import Link from 'next/link'
import { jourSeul } from '@/lib/reservationsVerrouillees'

const BLEU = '#1651E8'

/** Une réservation au-delà du quota, à sa place dans la liste.
 *
 *  Le choix vient d'un test utilisateur : une carte À PART, dans un encadré
 *  dédié au-dessus de la liste, se lisait comme une publicité et se sautait
 *  comme une publicité. À sa place dans la liste, avec la même forme que ses
 *  voisines, elle se lit comme ce qu'elle est : un rendez-vous qui manque.
 *
 *  Ce qui reste LISIBLE : le nom et le jour. Assez pour savoir qu'un vrai
 *  client attend — donc pour avoir envie de le joindre — et trop peu pour le
 *  joindre ou pour se présenter au rendez-vous.
 *
 *  Le reste est une barre grise floutée, jamais une fausse valeur : une heure
 *  inventée sous un flou resterait une heure inventée le jour où quelqu'un
 *  retire le flou dans les outils du navigateur. Le flou n'est d'ailleurs
 *  qu'une décoration — la vraie serrure est en amont, où le téléphone,
 *  l'adresse, l'heure et le montant ne sont jamais chargés (voir
 *  `masquerVerrouillees`).
 */
export function CarteVerrouillee({ clientName, scheduledAt, offre }: {
  clientName: string | null
  scheduledAt: string
  /** Nom de l'offre qui débloque — « Starter », « Pro ». */
  offre: string
}) {
  const jour = jourSeul(scheduledAt)

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Le NOM, net. C'est lui qui rend la demande réelle : une ligne
            « Réservation bloquée » ne donne envie de rien. */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
            {clientName || 'Client'}
          </span>
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Masqué
          </span>
        </div>

        {/* Le JOUR, net. L'HEURE, jamais : elle suffirait à honorer le
            rendez-vous sans rien payer — il suffirait d'attendre sur place.
            Elle n'est d'ailleurs pas chargée, la barre grise n'en cache
            aucune. */}
        <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300 mb-1.5">
          <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span className="capitalize">{jour ?? 'Date inconnue'}</span>
          <span className="inline-block h-3 w-10 rounded bg-slate-200 dark:bg-slate-700 blur-[3px]" aria-hidden />
        </div>

        {/* Prestation et montant : des barres, pas des valeurs inventées. */}
        <div className="flex items-center gap-1.5 mb-3" aria-hidden>
          <span className="inline-block h-3 w-28 rounded bg-slate-200 dark:bg-slate-700 blur-[3px]" />
          <span className="inline-block h-3 w-10 rounded bg-slate-200 dark:bg-slate-700 blur-[3px]" />
        </div>

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
