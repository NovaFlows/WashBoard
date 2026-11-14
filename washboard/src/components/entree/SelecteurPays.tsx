'use client'

import { useEffect, useRef, useState } from 'react'
import { PAYS_TELEPHONE, type PaysTelephone } from '@/lib/phone'

// Liste du pays du téléphone, à l'inscription (2026-11-14). Les drapeaux sont dessinés ici en
// SVG : les drapeaux emoji ne s'affichent pas sous Windows (ils sortent en « FR », « CH »).

/** Un drapeau de 24 × 16, au contour discret pour que le blanc reste lisible sur fond clair. */
export function Drapeau({ pays, className = '' }: { pays: PaysTelephone; className?: string }) {
  return (
    <svg viewBox="0 0 24 16" width="24" height="16" aria-hidden className={`shrink-0 rounded-[3px] ${className}`}>
      {pays === 'FR' && <><rect width="8" height="16" fill="#0055A4" /><rect x="8" width="8" height="16" fill="#FFFFFF" /><rect x="16" width="8" height="16" fill="#EF4135" /></>}
      {pays === 'BE' && <><rect width="8" height="16" fill="#000000" /><rect x="8" width="8" height="16" fill="#FAE042" /><rect x="16" width="8" height="16" fill="#ED2939" /></>}
      {pays === 'CH' && <><rect width="24" height="16" fill="#DA291C" /><rect x="10" y="3" width="4" height="10" fill="#FFFFFF" /><rect x="7" y="6" width="10" height="4" fill="#FFFFFF" /></>}
      <rect x="0.25" y="0.25" width="23.5" height="15.5" rx="2.75" fill="none" stroke="rgba(0,0,0,.14)" strokeWidth="0.5" />
    </svg>
  )
}

export default function SelecteurPays({ valeur, onChange }: { valeur: PaysTelephone; onChange: (pays: PaysTelephone) => void }) {
  const [ouvert, setOuvert] = useState(false)
  // S'ouvre vers le haut quand il manque de la place en dessous : sur téléphone, la barre d'action
  // fixe du bas de l'écran recouvrirait la liste.
  const [versLeHaut, setVersLeHaut] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)
  const courant = PAYS_TELEPHONE.find(p => p.code === valeur) ?? PAYS_TELEPHONE[0]

  // Se ferme au clic ailleurs et à Échap.
  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => { if (!conteneur.current?.contains(e.target as Node)) setOuvert(false) }
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', touche)
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', touche) }
  }, [ouvert])

  // Les flèches changent de pays sans ouvrir la liste, comme une liste native.
  function fleches(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = PAYS_TELEPHONE.findIndex(p => p.code === valeur)
    const suivant = PAYS_TELEPHONE[(i + (e.key === 'ArrowDown' ? 1 : PAYS_TELEPHONE.length - 1)) % PAYS_TELEPHONE.length]
    onChange(suivant.code)
  }

  return (
    <div ref={conteneur} className="relative shrink-0">
      <button
        type="button"
        aria-label="Pays du téléphone"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={e => {
          if (!ouvert) setVersLeHaut(window.innerHeight - e.currentTarget.getBoundingClientRect().bottom < 330)
          setOuvert(o => !o)
        }}
        onKeyDown={fleches}
        className="flex min-h-[32px] items-center gap-1.5 rounded-[10px] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] py-1 pl-2 pr-1.5 text-[15px] font-semibold text-[color:var(--v2-color-encre)] transition-colors hover:border-[color:var(--v2-color-gris)]"
      >
        <Drapeau pays={courant.code} />
        <span className="tabular-nums">{courant.indicatif}</span>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className={`text-[color:var(--v2-color-gris)] transition-transform ${ouvert ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {ouvert && (
        <ul
          role="listbox"
          aria-label="Pays du téléphone"
          className={`absolute left-0 z-30 min-w-[210px] ${versLeHaut ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'} overflow-hidden rounded-[14px] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-1 shadow-[0_12px_32px_rgba(0,0,0,.16)]`}
        >
          {PAYS_TELEPHONE.map(p => (
            <li key={p.code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={p.code === valeur}
                onClick={() => { onChange(p.code); setOuvert(false) }}
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[color:var(--v2-filet)] ${p.code === valeur ? 'font-semibold' : 'font-medium'} text-[color:var(--v2-color-encre)]`}
              >
                <Drapeau pays={p.code} />
                <span className="flex-1">{p.libelle}</span>
                <span className="tabular-nums text-[color:var(--v2-color-gris)]">{p.indicatif}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
