import Link from 'next/link'

/** Enveloppe un réglage que l'offre du laveur ne comprend pas.
 *
 *  Le titre et l'explication restent NETS ; seuls les champs — saisies,
 *  interrupteurs, boutons, vignettes — sont flous. Sans ça, le bloc entier
 *  devenait une tache grise : le laveur voyait qu'il lui manquait quelque
 *  chose, mais pas quoi, donc sans jamais avoir envie de l'acheter. Il lit
 *  maintenant « Avis Google — envoyez automatiquement un email à vos clients
 *  après un lavage terminé », ce qui est exactement l'argument de vente.
 *
 *  Le tri se fait par TYPE D'ÉLÉMENT plutôt que par une liste de textes à
 *  passer en paramètre : chaque section aurait dû répéter son propre titre, et
 *  les deux copies auraient divergé au premier changement de formulation.
 *
 *  Ce n'est pas une barrière — un flou CSS se retire en deux clics dans les
 *  outils du navigateur. Ce composant n'enveloppe que les propres réglages du
 *  laveur, jamais une donnée qu'il n'aurait pas le droit de voir. */
export function SectionVerrouillee({ verrouille, planLabel, children }: {
  verrouille: boolean
  planLabel: string
  children: React.ReactNode
}) {
  if (!verrouille) return <>{children}</>

  return (
    <div className="relative">
      {/* `inert` neutralise clic ET clavier : sans lui, la section restait
          navigable au Tab et le laveur pouvait la remplir sans voir ce qu'il
          tapait. Il la retire aussi des lecteurs d'écran. */}
      <div
        inert
        className={
          'select-none '
          // Les champs deviennent illisibles, les textes qui les expliquent
          // restent nets.
          + '[&_input]:blur-[4px] [&_textarea]:blur-[4px] [&_select]:blur-[4px] '
          + '[&_button]:blur-[4px] [&_img]:blur-[4px] [&_svg]:opacity-40'
        }
      >
        {children}
      </div>

      {/* Voile léger : dit « inactif » sans empêcher de lire. Il éclaircit en
          clair et ASSOMBRIT en sombre — un voile blanc en mode sombre ferait
          briller la zone verrouillée plus que le contenu autour. */}
      <div className="absolute inset-0 rounded-2xl bg-white/25 dark:bg-slate-950/35" />

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
