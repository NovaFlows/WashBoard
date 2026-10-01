'use client'

import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'

// Même composant que ConfirmerCloture.tsx (mêmes props, même texte, même
// logique de décision — voir `doitDemanderConfirmation` dans `lib/cloture.ts`,
// inchangée), habillé avec les jetons v2 plutôt que les couleurs Tailwind
// slate/emerald/red codées en dur de la version v1 : réservé à
// CalendrierDashboardV2.tsx (voir « v1 sur le site, v2 seulement dans la PWA
// installée », .claude/agents/refonte.md). Dupliqué volontairement — c'est de
// la présentation, jamais du calcul, la même règle que ClientProfileModalV2
// vs V1 pour la définition des statuts.
const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

export default function ConfirmerClotureV2({
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
    ? 'Il passe en « Terminé ». Pour la facture, complétez d’abord vos informations de facturation dans les réglages.'
    : professionnel
      ? 'Il passe en « Terminé ». La facture est créée pour vous et envoyée par email à votre client professionnel.'
      : 'Il passe en « Terminé ». La facture est créée pour vous : vous la retrouvez dans Chiffres › Factures.'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloture-titre-v2"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] cursor-default"
      />

      <div
        ref={panneauRef}
        tabIndex={-1}
        style={{ outline: 'none' }}
        className={`relative w-full max-w-sm rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} p-5`}
      >
        <h2 id="cloture-titre-v2" className={`text-[17px] ${titre}`}>
          Avez-vous fait ce rendez-vous ?
        </h2>
        <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
          {clientName} · <span className="first-letter:uppercase inline-block">{quand}</span>
        </p>

        <div className="mt-4 space-y-2">
          <button
            onClick={onFait}
            className="w-full flex items-start gap-3 text-left p-3 rounded-[var(--v2-radius-carte)] border transition-colors"
            style={{ borderColor: 'var(--v2-color-vert)', background: 'rgba(18, 122, 75, 0.08)' }}
          >
            <span
              className="w-7 h-7 rounded-full text-white flex items-center justify-center shrink-0"
              style={{ background: 'var(--v2-color-vert)' }}
            >
              <Check size={16} strokeWidth={3} />
            </span>
            <span>
              <span className={`block text-[14px] ${corpsFort}`} style={{ color: 'var(--v2-color-vert)' }}>Oui, je l’ai fait</span>
              <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>{suiteFait}</span>
            </span>
          </button>

          <button
            onClick={onPasFait}
            className="w-full flex items-start gap-3 text-left p-3 rounded-[var(--v2-radius-carte)] border transition-colors"
            style={{ borderColor: 'var(--v2-color-rouge)', background: 'rgba(179, 38, 30, 0.08)' }}
          >
            <span
              className="w-7 h-7 rounded-full text-white flex items-center justify-center shrink-0"
              style={{ background: 'var(--v2-color-rouge)' }}
            >
              <X size={16} strokeWidth={3} />
            </span>
            <span>
              <span className={`block text-[14px] ${corpsFort}`} style={{ color: 'var(--v2-color-rouge)' }}>Non, il n’a pas eu lieu</span>
              <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>
                Il est annulé : aucune facture, il ne compte pas dans votre compta, et votre client ne reçoit aucun message.
              </span>
            </span>
          </button>
        </div>

        <button
          onClick={onClose}
          className={`w-full mt-3 py-2 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)] rounded-[var(--v2-radius-bouton)] transition-colors`}
        >
          Revenir
        </button>
      </div>
    </div>
  )
}
