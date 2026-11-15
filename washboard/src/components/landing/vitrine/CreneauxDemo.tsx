'use client'

import { useState, type ReactNode } from 'react'
import CarteCreneaux from './CarteCreneaux'
import { useT } from '@/components/i18n/I18nProvider'

export default function CreneauxDemo({ etapes }: { etapes: ReactNode }) {
  const t = useT()
  const [avec, setAvec] = useState(false)
  return (
    <div className="cg">
      <CarteCreneaux avec={avec} />
      <div>
        <div className="segment" role="group" aria-label={t('Comparer')}>
          <button type="button" aria-pressed={!avec} onClick={() => setAvec(false)}>{t('Sans WashBoard')}</button>
          <button type="button" aria-pressed={avec} onClick={() => setAvec(true)}>{t('Avec les créneaux groupés')}</button>
        </div>
        {etapes}
      </div>
    </div>
  )
}
