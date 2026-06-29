import Link from 'next/link'

// Écran/encart affiché à la place d'une fonctionnalité verrouillée par le plan.
export function UpgradePrompt({ title, description, planLabel }: {
  title: string
  description: string
  planLabel: string
}) {
  return (
    <div className="max-w-md mx-auto text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
      </div>
      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 mb-3">
        Plan {planLabel}
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
}
