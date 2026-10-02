'use client'

import { useState, forwardRef } from 'react'

// Champ mot de passe avec un œil pour basculer sa visibilité (demande
// d'Alexandre, 2026-10-02) : sans lui, une faute de frappe dans un mot de
// passe se découvre seulement en échec de connexion, jamais avant.
//
// `style` plutôt qu'une classe Tailwind pour la marge réservée à l'œil : le
// champ reçoit la classe `wb-input` de l'appelant (CSS brut, globals.css),
// et une classe utilitaire n'aurait pas la priorité garantie sur elle selon
// l'ordre des feuilles de style — un style en ligne, lui, gagne toujours.
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className = '', style, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={className}
        style={{ ...style, paddingRight: '2.75rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        // Ne doit jamais voler le focus au Tab suivant (email → mot de passe
        // → connexion) : c'est un confort, pas une étape du formulaire.
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:text-white/30 dark:hover:text-white/70 transition-colors"
      >
        {visible ? (
          // Œil barré : le mot de passe est actuellement VISIBLE, cliquer le masque.
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c5 0 9.3 3.1 11 7.5a12 12 0 0 1-2.2 3.5M6.1 6.2A12 12 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.2 0 2.4-.2 3.4-.5" />
            <path d="M9.9 14.6a2.5 2.5 0 0 1 3.5-3.5" />
            <path d="M2 2l20 20" />
          </svg>
        ) : (
          // Œil ouvert : le mot de passe est actuellement MASQUÉ, cliquer l'affiche.
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5c-1.7 4.4-6 7.5-11 7.5S2.7 16.9 1 12.5z" />
            <circle cx="12" cy="12.5" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
})
