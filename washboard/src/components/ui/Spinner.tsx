// Spinner de chargement partagé — garde une animation cohérente dans toute l'app.
// La couleur suit `currentColor` (hérite du texte du bouton), la taille se règle
// via `className` (ex. "w-4 h-4", défaut w-4 h-4).

type Props = {
  className?: string
}

export function Spinner({ className = 'w-4 h-4' }: Props) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
