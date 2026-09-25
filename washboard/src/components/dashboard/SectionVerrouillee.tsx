import Link from 'next/link'

/** Enveloppe un réglage que l'offre du laveur ne comprend pas.
 *
 *  Le réglage reste VISIBLE, flouté. Il ne disparaît pas : un écran qui se vide
 *  selon l'offre laisse croire que la fonctionnalité n'existe pas, alors qu'on
 *  cherche justement à donner envie de l'avoir. On voit qu'il y a quelque
 *  chose, on ne peut pas s'en servir, et une pastille dit ce qu'il faut pour
 *  l'ouvrir.
 *
 *  Le flou plutôt qu'un simple grisé : un bloc à moitié transparent se lit
 *  encore, donc le laveur essaie de cliquer et se demande pourquoi rien ne
 *  répond. Flouté, il n'y a pas d'ambiguïté sur l'état.
 *
 *  Ce n'est qu'un habillage : le verrou qui compte est côté serveur, dans
 *  `PATCH /api/washer`. Ici on évite au laveur de remplir un formulaire qui
 *  finirait par un refus — et on ne floute JAMAIS une donnée qu'il n'aurait
 *  pas le droit de voir, puisqu'un flou CSS se retire en deux clics dans les
 *  outils du navigateur. Ce composant n'enveloppe que ses propres réglages. */
export function SectionVerrouillee({ verrouille, planLabel, children }: {
  verrouille: boolean
  planLabel: string
  children: React.ReactNode
}) {
  if (!verrouille) return <>{children}</>

  return (
    <div className="relative">
      {/* `inert` neutralise clic ET clavier, là où le flou seul laissait la
          section navigable au Tab — un laveur au clavier pouvait encore la
          remplir sans jamais voir ce qu'il tapait. Il la retire aussi des
          lecteurs d'écran, qui sinon lisaient un formulaire inutilisable. */}
      <div inert className="select-none blur-[3px] opacity-70">
        {children}
      </div>

      {/* Voile : sépare le flou du reste de la page. Il ÉCLAIRCIT en clair et
          ASSOMBRIT en sombre — un voile blanc en mode sombre ferait briller la
          zone verrouillée plus que le contenu autour, exactement l'inverse de
          ce qu'on veut. */}
      <div className="absolute inset-0 rounded-2xl bg-white/40 dark:bg-slate-950/50" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <Link
          href="/dashboard/abonnement"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 transition-colors"
        >
          <svg className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
          Inclus dans l’offre {planLabel}
        </Link>
      </div>
    </div>
  )
}
