import Link from 'next/link'

// Écran affiché à la place d'une fonctionnalité que l'offre ne comprend pas.
//
// `apercu` : une maquette DÉCORATIVE, floutée derrière la carte. Un cadenas
// seul ne donne envie de rien — le laveur ne sait pas ce qu'il rate. En
// laissant deviner la forme de l'outil, il comprend ce qu'il achèterait.
//
// Ce qui passe par `apercu` est toujours inventé (voir ApercusVerrouilles) :
// un flou CSS se retire en deux clics dans les outils du navigateur, il ne
// protège donc rien. Les vrais chiffres ne sont pas seulement floutés, ils ne
// sont pas chargés du tout — le verrou est posé avant les lectures en base.
export function UpgradePrompt({ title, description, planLabel, apercu }: {
  title: string
  description: string
  planLabel: string
  apercu?: React.ReactNode
}) {
  const carte = (
    <div className="max-w-md w-full mx-auto text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
      </div>
      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 mb-3">
        Offre {planLabel}
      </span>
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{description}</p>
      <Link
        href="/dashboard/abonnement"
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
      >
        Voir les offres
      </Link>
    </div>
  )

  if (!apercu) return carte

  return (
    <div className="relative">
      {/* `inert` : la maquette ne se sélectionne pas, ne prend pas le focus au
          clavier et ne se lit pas au lecteur d'écran. Sans ça, un laveur
          naviguant au clavier traversait des chiffres inventés avant
          d'atteindre le bouton qui l'intéresse. */}
      <div inert className="blur-[5px] opacity-80 select-none">
        {apercu}
      </div>

      {/* Voile : éclaircit en clair, ASSOMBRIT en sombre. Un voile blanc en
          mode sombre ferait briller la zone verrouillée plus que le reste. */}
      <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/50" />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        {carte}
      </div>
    </div>
  )
}
