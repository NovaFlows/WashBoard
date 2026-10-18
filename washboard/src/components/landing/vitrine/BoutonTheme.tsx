'use client'

import { useTheme } from '@/components/ui/ThemeProvider'
import { IcLune, IcSoleil } from './Icones'

// Les deux icônes sont rendues, le CSS affiche la bonne : le thème vient du
// cookie lu par le serveur, l'état React ne le connaît qu'après l'hydratation.
export default function BoutonTheme() {
  const { theme, setTheme } = useTheme()
  return (
    <button type="button" className="theme-btn" aria-label="Changer de thème" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <IcLune />
      <IcSoleil />
    </button>
  )
}
