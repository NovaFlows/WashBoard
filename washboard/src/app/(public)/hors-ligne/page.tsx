import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Hors ligne — WashBoard',
  robots: { index: false, follow: false },
}

// Affichée uniquement par le service worker, quand le téléphone n'a plus de
// réseau et que la page demandée n'a jamais été consultée. Volontairement
// sobre : elle doit fonctionner sans aucune requête.
export default function HorsLignePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-50 dark:bg-slate-950">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-slate-500 dark:text-slate-400">
            <path d="M1 1l22 22M16.7 16.7A6 6 0 007 8.3M5 12.5a7 7 0 011.5-2.2M2 8.8a11 11 0 013-2.3M8.5 5.3A11 11 0 0122 8.8M12 20h.01" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Pas de connexion
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Votre téléphone n&apos;a plus de réseau. Les pages déjà consultées restent
          accessibles ; celle-ci demande une connexion.
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 rounded-xl bg-[#1651E8] text-white text-sm font-semibold"
        >
          Revenir au tableau de bord
        </Link>
      </div>
    </main>
  )
}
