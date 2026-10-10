'use client'

import { Trash2 } from 'lucide-react'

// La suppression « au glisser » (`useLigneGlissante`) ne répond qu'au doigt et au stylet : à la
// souris, sur la v2 ordinateur, cinq suppressions n'avaient aucun autre accès (client, entreprise,
// ligne « À relancer », frais ponctuel, conversation d'assistance — audit du 2026-10-10).
//
// Ce bouton est leur pendant pour la souris : une poubelle posée sur la ligne, qui apparaît au
// survol ou au clavier, et ouvre la MÊME confirmation que le bouton rouge révélé au glisser.
// Absent sur un appareil sans pointeur fin (téléphone), qui garde son geste.
//
// À poser dans le conteneur qui porte `group` et `relative` (le contenu glissant de la ligne).
// `placement` :
//   - `coin` (défaut) : en bas à droite, par-dessus la ligne — pour les lignes sur deux niveaux
//     dont le coin bas droit est libre (Clients, Assistance) ;
//   - `ligne` : à la suite du contenu, dans le flux — pour une ligne simple qui porte déjà un
//     montant à droite (Dépenses). La place est réservée sur ordinateur, sans quoi le montant
//     glisserait au survol.
export function BoutonSupprimerSurvol({ libelle, onClick, placement = 'coin' }: {
  libelle: string
  onClick: () => void
  placement?: 'coin' | 'ligne'
}) {
  const position = placement === 'coin' ? 'absolute bottom-2 right-3' : 'relative -my-1'
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick() }}
      aria-label={libelle}
      title={libelle}
      className={`${position} hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-gris)] opacity-0 shadow-[0_1px_3px_rgba(22,22,26,.08)] transition-opacity hover:text-[color:var(--v2-color-rouge)] focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none [@media(any-pointer:fine)]:flex`}
    >
      <Trash2 size={15} strokeWidth={2} aria-hidden />
    </button>
  )
}
