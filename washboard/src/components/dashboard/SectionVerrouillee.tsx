import Link from 'next/link'

/** Enveloppe un réglage que l'offre du laveur ne comprend pas.
 *
 *  Le réglage reste VISIBLE et grisé, il ne disparaît pas. Un écran qui se
 *  vide selon l'offre laisse le laveur croire que la fonctionnalité n'existe
 *  pas, alors qu'on cherche justement à lui donner envie de l'avoir. Il reste
 *  lisible, il ne répond plus, et une ligne dit ce qu'il faut pour l'ouvrir.
 *
 *  Ce n'est qu'un habillage : le verrou qui compte est côté serveur, dans
 *  `PATCH /api/washer`. Ici on évite au laveur de remplir un formulaire qui
 *  finirait par un refus. */
export function SectionVerrouillee({ verrouille, planLabel, children }: {
  verrouille: boolean
  planLabel: string
  children: React.ReactNode
}) {
  if (!verrouille) return <>{children}</>

  return (
    <div className="relative">
      {/* `inert` neutralise clic ET clavier, là où `pointer-events-none` seul
          laissait la section navigable au Tab — un laveur au clavier pouvait
          encore la remplir. */}
      <div inert className="opacity-50 select-none">
        {children}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center">
        <Link
          href="/dashboard/abonnement"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
          Inclus dans l’offre {planLabel}
        </Link>
      </div>
    </div>
  )
}
