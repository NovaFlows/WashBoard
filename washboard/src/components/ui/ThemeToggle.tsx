'use client'

import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

export function ThemeToggle({ large, nav }: { large?: boolean; nav?: boolean }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className={large ? 'w-12 h-12' : 'w-9 h-9'} />

  const isDark = theme === 'dark'
  const size = large ? 22 : 18
  const btnClass = nav
    ? 'w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors'
    : large
    ? 'w-12 h-12 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm'
    : 'w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'

  return (
    <button onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Changer le thème" className={btnClass}>
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      )}
    </button>
  )
}
