'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark'
type ThemeCtx = { theme: Theme; resolvedTheme: Theme; setTheme: (t: Theme) => void }

const ThemeContext = createContext<ThemeCtx>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

// Provider léger (remplace next-themes) : aucune balise <script> rendue côté
// client — le script anti-flash est injecté côté serveur dans le layout, donc
// React ne déclenche jamais l'avertissement "script tag while rendering".
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  // Synchronise l'état React avec ce que le script anti-flash a déjà appliqué.
  useEffect(() => {
    let stored: string | null = null
    try { stored = localStorage.getItem('theme') } catch { /* indisponible */ }
    if (stored === 'dark' || stored === 'light') setThemeState(stored)
    else setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem('theme', t) } catch { /* indisponible */ }
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
