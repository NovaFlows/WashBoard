'use client'

// Error boundary du segment dashboard : capture les erreurs de rendu des pages
// de l'espace laveur sans casser toute l'app (le layout reste en place). Affiche
// le `digest` (corrélé aux logs serveur Vercel) pour le support.

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(JSON.stringify({
      level: 'error',
      event: 'react.dashboard_error',
      digest: error.digest,
      message: error.message,
    }))
  }, [error])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">Oups.</p>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Cette page a rencontré un problème</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          L&apos;incident a été enregistré. Réessayez, ou revenez au tableau de bord.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-slate-400 dark:text-slate-500 mb-6">Code : {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors"
          >
            Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  )
}
