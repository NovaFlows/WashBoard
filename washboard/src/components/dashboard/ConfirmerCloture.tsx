'use client'

import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'

/** « Clôturer » un créneau passé sans savoir s'il a eu lieu : avant, le bouton
 *  valait « Terminé » d'office, et donc une facture émise pour un lavage qui
 *  n'a peut-être jamais été fait. On pose la question, et chaque réponse dit
 *  ce qu'elle va déclencher. */
export default function ConfirmerCloture({
  clientName,
  quand,
  professionnel,
  facturationPrete,
  onFait,
  onPasFait,
  onClose,
}: {
  clientName: string
  quand: string
  professionnel: boolean
  facturationPrete: boolean
  onFait: () => void
  onPasFait: () => void
  onClose: () => void
}) {
  const panneauRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panneauRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const suiteFait = !facturationPrete
    ? 'Il passe en « Terminé ». Pour la facture, complétez d’abord vos informations de facturation dans les Paramètres.'
    : professionnel
      ? 'Il passe en « Terminé ». La facture est créée pour vous et envoyée par email à votre client professionnel.'
      : 'Il passe en « Terminé ». La facture est créée pour vous : vous la retrouvez dans l’onglet Factures.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloture-titre"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm cursor-default"
      />

      <div
        ref={panneauRef}
        tabIndex={-1}
        // Le panneau prend le focus pour que le clavier entre dans la fenêtre ;
        // la règle globale *:focus-visible (hors couche Tailwind) lui dessinerait
        // un contour et des coins à 4px. Les boutons, eux, gardent le leur.
        style={{ outline: 'none', borderRadius: '1rem' }}
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-5"
      >
        <h2 id="cloture-titre" className="text-base font-bold text-slate-900 dark:text-white">
          Avez-vous fait ce rendez-vous ?
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {clientName} · <span className="first-letter:uppercase inline-block">{quand}</span>
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={onFait}
            className="w-full flex items-start gap-3 text-left p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <Check size={16} strokeWidth={3} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-emerald-800 dark:text-emerald-300">Oui, je l’ai fait</span>
              <span className="block text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">{suiteFait}</span>
            </span>
          </button>

          <button
            onClick={onPasFait}
            className="w-full flex items-start gap-3 text-left p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <span className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
              <X size={16} strokeWidth={3} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-red-700 dark:text-red-300">Non, il n’a pas eu lieu</span>
              <span className="block text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                Il est annulé : aucune facture, il ne compte pas dans votre compta, et votre client ne reçoit aucun message.
              </span>
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
        >
          Revenir
        </button>
      </div>
    </div>
  )
}
