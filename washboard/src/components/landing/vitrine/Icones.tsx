// Icônes de la page. Celles de l'app simulée vivent dans demo/.

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'aria-hidden': true } as const

export function IcLune() {
  return <svg {...base} className="ico-lune" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
}

export function IcSoleil() {
  return (
    <svg {...base} className="ico-soleil" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

export function IcPin() {
  return <svg {...base} strokeWidth="1.8"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
}

export function IcItineraire() {
  return <svg {...base} strokeWidth="2" strokeLinejoin="round"><path d="M21 3 3 10.5l7.5 3 3 7.5z" /></svg>
}

export function IcTel() {
  return <svg {...base} strokeWidth="1.8"><path d="M5 3h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 5.1 5.1l1.4-2.3L19 13.5V17a2 2 0 0 1-2 2C9.8 19 5 14.2 5 7V5a2 2 0 0 1 0-2z" /></svg>
}

export function IcOk() {
  return <svg {...base} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
}

export function IcFacture() {
  return <svg {...base} strokeWidth="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>
}

export function IcEtoile({ delai }: { delai: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ animationDelay: `${delai}s` }}>
      <path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
    </svg>
  )
}

export function IcRaz() {
  return <svg {...base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
}

export function IcFleche() {
  return <svg viewBox="0 0 52 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 7c14-3 28-2 42 5M41.7 7 45 12l-6 .3" /></svg>
}

/** Signal et batterie de la barre d'état d'un téléphone. */
export function Reseau() {
  return (
    <svg viewBox="0 0 42 12" aria-hidden>
      <g fill="currentColor">
        <rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" />
        <rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" />
        <rect x="23" y="1" width="16" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <rect x="25" y="3" width="11" height="6" rx="1.5" /><rect x="40" y="4" width="2" height="4" rx="1" />
      </g>
    </svg>
  )
}

export function Logo() {
  return <span className="logo" aria-hidden><b>W</b><i /></span>
}
