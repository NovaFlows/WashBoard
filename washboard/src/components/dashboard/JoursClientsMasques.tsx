import Link from 'next/link'
import { jourSeul } from '@/lib/reservationsVerrouillees'

const BLEU = '#1651E8'

/** Les journées où des clients sont masqués, au-dessus de l'agenda.
 *
 *  Les réservations verrouillées ne peuvent pas entrer dans la grille horaire :
 *  l'y poser donnerait l'heure, et l'heure est précisément ce qu'on ne donne
 *  pas — il suffirait d'attendre sur place pour honorer le rendez-vous sans
 *  jamais payer.
 *
 *  Mais les sortir complètement de l'agenda a un coût : là où le laveur
 *  organise sa semaine, il ne voit plus rien. Ce bandeau remet l'information à
 *  l'endroit exact où il regarde, sans jamais descendre sous le jour.
 *
 *  Une journée, un compte. Pas de nom ici : la page Clients les montre déjà,
 *  floutés, et répéter la même chose à deux endroits l'affaiblit. */
export function JoursClientsMasques({ dates }: { dates: string[] }) {
  if (dates.length === 0) return null

  // Regroupées par jour, dans l'ordre chronologique. Une `Map` retient l'ordre
  // d'insertion : il suffit de trier les dates en amont.
  const parJour = new Map<string, number>()
  for (const d of [...dates].sort()) {
    const jour = jourSeul(d)
    if (!jour) continue
    parJour.set(jour, (parJour.get(jour) ?? 0) + 1)
  }
  if (parJour.size === 0) return null

  const total = [...parJour.values()].reduce((a, b) => a + b, 0)

  // Six journées, pas quarante. Au-delà, la liste cesse d'être lisible d'un
  // coup d'œil et pousse l'agenda sous la ligne de flottaison — c'est le
  // nombre, dans la pastille, qui porte le poids.
  const JOURS_MONTRES = 6
  const entrees = [...parJour.entries()]
  const montres = entrees.slice(0, JOURS_MONTRES)
  const resteJours = entrees.length - montres.length

  return (
    <div className="mb-4 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black"
          style={{ backgroundColor: BLEU }}
        >
          {total}
        </span>
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {total > 1 ? 'clients absents de cet agenda' : 'client absent de cet agenda'}
        </p>
      </div>

      <ul className="flex flex-wrap gap-1.5 mb-2">
        {montres.map(([jour, n]) => (
          <li
            key={jour}
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300"
          >
            {jour}
            {n > 1 && <span className="font-bold"> · {n}</span>}
          </li>
        ))}
        {resteJours > 0 && (
          <li className="px-2.5 py-1 text-xs text-slate-400 dark:text-slate-500">
            et {resteJours} autre{resteJours > 1 ? 's' : ''} jour{resteJours > 1 ? 's' : ''}
          </li>
        )}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
          Leur heure reste masquée par votre offre.
        </p>
        <Link
          href="/dashboard/abonnement"
          className="shrink-0 text-[11px] font-black uppercase tracking-[0.18em] hover:underline"
          style={{ color: BLEU }}
        >
          Les voir →
        </Link>
      </div>
    </div>
  )
}
