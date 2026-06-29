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

// Provider léger (remplace next-themes) : le thème est stocké dans un cookie,
// lu côté serveur par le layout qui pose la classe `dark` sur <html>. Aucune
// balise <script> n'est rendue → plus d'avertissement React 19 en dev.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  // L'état initial reflète la classe déjà posée par le serveur (depuis le cookie).
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    document.cookie = `theme=${t};path=/;max-age=31536000;samesite=lax`
    document.documentElement.classList.toggle('dark', t === 'dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme: theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
