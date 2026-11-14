'use client'

import { useTheme } from '@/components/ui/ThemeProvider'
import { IcLune, IcSoleil } from './Icones'
import { useT } from '@/components/i18n/I18nProvider'

// Les deux icônes sont rendues, le CSS affiche la bonne : le thème vient du
// cookie lu par le serveur, l'état React ne le connaît qu'après l'hydratation.
export default function BoutonTheme() {
  const { theme, setTheme } = useTheme()
  const t = useT()
  return (
    <button type="button" className="theme-btn" aria-label={t('Changer de thème')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      <IcLune />
      <IcSoleil />
    </button>
  )
}
