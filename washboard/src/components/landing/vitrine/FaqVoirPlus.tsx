'use client'

import { useState, type ReactNode } from 'react'

// Les questions repliées restent dans le HTML (attribut hidden) : lisibles par les moteurs, comme le JSON-LD.
export default function FaqVoirPlus({ nombre, children }: { nombre: number; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <div id="faq-suite" hidden={!ouvert}>{children}</div>
      {!ouvert && (
        <button type="button" className="btn btn-ligne faq-plus" aria-controls="faq-suite" aria-expanded={false} onClick={() => setOuvert(true)}>
          Voir les {nombre} autres questions
        </button>
      )}
    </>
  )
}
