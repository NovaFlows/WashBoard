import { useId } from 'react'
import type { ApplicationItineraire } from '@/lib/itineraire'

// Icônes des trois applications d'itinéraire, dessinées à la main en SVG (aucun
// fichier à charger, aucune dépendance) : ce sont des ressemblances simplifiées
// pour qu'on reconnaisse l'application d'un coup d'œil dans la feuille « Ouvrir
// avec », pas des reproductions exactes des marques. Chacune tient dans un
// carré arrondi de 40 × 40, comme une icône d'application.
//
// Les couleurs sont celles des marques (elles ne suivent volontairement pas
// les jetons `--v2-*` ni le mode sombre : une icône d'application doit rester
// reconnaissable telle quelle).

function Plans({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
      <defs>
        <clipPath id={id}><rect width="40" height="40" rx="9" /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="40" height="40" fill="#F1EFE7" />
        <path d="M40 21v19H23z" fill="#BDE4A8" />
        <path d="M0 0h15L0 15z" fill="#A4D3F5" />
        <path d="M-4 38 38 -4" stroke="#fff" strokeWidth="7" fill="none" />
        <path d="M-4 38 38 -4" stroke="#F5C64A" strokeWidth="1.5" fill="none" />
        <circle cx="21" cy="19" r="8.3" fill="#2F7BF5" />
        <path d="M21 13.4 26.2 24.6 21 21.7 15.8 24.6z" fill="#fff" />
      </g>
    </svg>
  )
}

function Waze({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
      <defs>
        <clipPath id={id}><rect width="40" height="40" rx="9" /></clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        <rect width="40" height="40" fill="#33CCFF" />
        <path d="M20 8.2c-7.1 0-12.6 5-12.6 11.3 0 2.9 1.2 5.6 3.2 7.6l-.9 4.1 4.2-1.7c1.9.9 4.1 1.4 6.1 1.4 7.1 0 12.6-5 12.6-11.4S27.1 8.2 20 8.2z" fill="#fff" />
        <circle cx="15.7" cy="17.6" r="1.5" fill="#2B3C4E" />
        <circle cx="24.3" cy="17.6" r="1.5" fill="#2B3C4E" />
        <path d="M15.4 21.6c1.2 2.2 3.1 3.2 4.6 3.2s3.4-1 4.6-3.2" stroke="#2B3C4E" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        <circle cx="14.6" cy="30.6" r="2.5" fill="#2B3C4E" stroke="#fff" strokeWidth="1.4" />
        <circle cx="25.4" cy="30.6" r="2.5" fill="#2B3C4E" stroke="#fff" strokeWidth="1.4" />
      </g>
    </svg>
  )
}

function Google({ id }: { id: string }) {
  const epingle = 'M20 6.4c-5.6 0-9.7 4.2-9.7 9.5 0 6.7 9.7 17.7 9.7 17.7s9.7-11 9.7-17.7c0-5.3-4.1-9.5-9.7-9.5z'
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden>
      <defs>
        <clipPath id={`${id}-carre`}><rect width="40" height="40" rx="9" /></clipPath>
        <clipPath id={`${id}-pin`}><path d={epingle} /></clipPath>
      </defs>
      <g clipPath={`url(#${id}-carre)`}>
        <rect width="40" height="40" fill="#fff" />
        <rect width="40" height="40" fill="none" stroke="#DADCE0" strokeWidth="2" rx="9" />
      </g>
      <g clipPath={`url(#${id}-pin)`}>
        <rect x="0" y="0" width="40" height="40" fill="#EA4335" />
        <path d="M0 0h20L8 24H0z" fill="#4285F4" />
        <path d="M0 22h13l7 16H0z" fill="#34A853" />
        <path d="M27 14h13v12H26z" fill="#FBBC04" />
        <path d="M20 40 31 25l9-2v17z" fill="#FBBC04" />
      </g>
      <circle cx="20" cy="15.9" r="3.7" fill="#fff" />
    </svg>
  )
}

/** Icône carrée de l'application d'itinéraire (à dimensionner par le parent). */
export function LogoApplication({ application }: { application: ApplicationItineraire['id'] }) {
  // Un identifiant par instance : deux SVG de même `clipPath` dans une page se
  // marcheraient dessus.
  const id = useId().replace(/:/g, '')
  if (application === 'plans') return <Plans id={id} />
  if (application === 'waze') return <Waze id={id} />
  return <Google id={id} />
}
