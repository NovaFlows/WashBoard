import type { ReactElement } from 'react'

const trait = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const I: Record<string, ReactElement> = {
  maison: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  agenda: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  clients: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.7 2.7 2.4 3 5.2" /></svg>,
  chiffres: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M5 20V12M12 20V5M19 20v-5" /></svg>,
  plus3: <svg viewBox="0 0 24 24" aria-hidden fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  plus: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>,
  doc: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>,
  pin: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>,
  nav: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="2"><path d="M21 3 3 10.5l7.5 3 3 7.5z" /></svg>,
  tel: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M5 3h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 5.1 5.1l1.4-2.3L19 13.5V17a2 2 0 0 1-2 2C9.8 19 5 14.2 5 7V5a2 2 0 0 1 0-2z" /></svg>,
  chev: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="2"><path d="m9 6 6 6-6 6" /></svg>,
  gauche: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="2"><path d="m15 6-6 6 6 6" /></svg>,
  loupe: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  ok: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="2.6"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>,
  grille: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M9 9.5v11M15 9.5v11M3.5 15h17" /></svg>,
  facture: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></svg>,
  euro: <svg viewBox="0 0 24 24" aria-hidden {...trait} strokeWidth="1.8"><path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4 10h9M4 14h9" /></svg>,
  mobile: <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="3" /></svg>,
  ordi: <svg viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8" /></svg>,
}

/** Réseau et batterie de la barre d'état du téléphone. */
export const RESEAU = (
  <svg viewBox="0 0 42 12" aria-hidden>
    <g fill="currentColor">
      <rect x="0" y="7" width="3" height="5" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" />
      <rect x="23" y="1" width="16" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="1.4" /><rect x="25" y="3" width="11" height="6" rx="1.5" /><rect x="40" y="4" width="2" height="4" rx="1" />
    </g>
  </svg>
)
