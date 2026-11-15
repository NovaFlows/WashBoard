'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useT } from '@/components/i18n/I18nProvider'

// Les questions repliées restent dans le HTML (attribut hidden) : lisibles par les moteurs, comme le JSON-LD.
export default function FaqVoirPlus({ nombre, children }: { nombre: number; children: ReactNode }) {
  const t = useT()
  const [ouvert, setOuvert] = useState(false)
  const bouton = useRef<HTMLButtonElement>(null)

  function replier() {
    setOuvert(false)
    // Sans ça, le lecteur reste 1 500 px plus bas, au milieu de la section suivante.
    requestAnimationFrame(() => bouton.current?.scrollIntoView({ block: 'center' }))
  }

  return (
    <>
      <div id="faq-suite" hidden={!ouvert}>{children}</div>
      {ouvert ? (
        <button type="button" className="btn btn-ligne faq-plus" aria-controls="faq-suite" aria-expanded onClick={replier}>
          {t('Voir moins de questions')}
        </button>
      ) : (
        <button ref={bouton} type="button" className="btn btn-ligne faq-plus" aria-controls="faq-suite" aria-expanded={false} onClick={() => setOuvert(true)}>
          {t('Voir les {n} autres questions', { n: nombre })}
        </button>
      )}
    </>
  )
}
