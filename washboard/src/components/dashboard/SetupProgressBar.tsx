import Link from 'next/link'
import type { SetupProgress } from '@/lib/setupProgress'

// Avancement de la configuration, en tête des réglages.
//
// Volontairement discret : une barre fine, un pourcentage, une phrase. Un
// grand encart de bienvenue serait vite du bruit pour quelqu'un qui vient
// simplement changer un tarif.
//
// Il disparaît une fois tout en place : un compte configuré n'a pas besoin
// qu'on lui rappelle chaque semaine qu'il est configuré.

export function SetupProgressBar({ progress }: { progress: SetupProgress }) {
  if (progress.complete) return null

  const bloquant = progress.missing.some(m => m.blocking)

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Configuration de votre compte
        </h3>
        <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
          {progress.percent}&nbsp;%
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            bloquant ? 'bg-amber-500' : 'bg-[#1651E8]'
          }`}
          style={{ width: `${Math.max(progress.percent, 3)}%` }}
        />
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
        {bloquant
          // Tant qu'un point bloquant manque, la page ne peut pas encaisser de
          // réservation : le dire franchement vaut mieux qu'un encouragement.
          ? 'Il manque encore de quoi permettre à vos clients de réserver.'
          : 'Un compte complet inspire confiance et évite les allers-retours avec vos clients.'}
      </p>

      <ul className="space-y-1.5">
        {progress.missing.map(item => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="group flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors"
            >
              <span
                aria-hidden
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  item.blocking ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
              {item.label}
              <svg
                className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
