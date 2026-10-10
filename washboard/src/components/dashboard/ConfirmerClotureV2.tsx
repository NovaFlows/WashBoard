'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { lireMontant } from '@/lib/cloture'
import { CHAMP } from '@/components/dashboard/FeuilleV2'

// Même composant que ConfirmerCloture.tsx (mêmes props, même texte, même
// logique de décision — voir `doitDemanderConfirmation` dans `lib/cloture.ts`,
// inchangée), habillé avec les jetons v2 plutôt que les couleurs Tailwind
// slate/emerald/red codées en dur de la version v1 : réservé à
// CalendrierDashboardV2.tsx (voir « v1 sur le site, v2 seulement dans la PWA
// installée », .claude/agents/refonte.md). Dupliqué volontairement — c'est de
// la présentation, jamais du calcul, la même règle que ClientProfileModalV2
// vs V1 pour la définition des statuts.
//
// 2026-10-10 : la fenêtre porte aussi le MONTANT ENCAISSÉ, prérempli avec le prix prévu
// (le client ne paie pas toujours ce qui était réservé). Elle s'ouvre donc à chaque clôture
// depuis l'agenda v2 : pour un créneau à venir (`passe` faux), seule « Oui » est proposée —
// la question « a-t-il eu lieu ? » n'a de sens que pour un créneau passé.
const formater = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ',')
const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

export default function ConfirmerClotureV2({
  clientName,
  quand,
  professionnel,
  facturationPrete,
  montantPrevu,
  passe = true,
  onFait,
  onPasFait,
  onClose,
}: {
  clientName: string
  quand: string
  professionnel: boolean
  facturationPrete: boolean
  /** Ce que le client devait payer (`montantPrevu`, lib/cloture.ts) : la valeur de départ. */
  montantPrevu: number
  /** Créneau déjà passé : on demande s'il a eu lieu. À venir : on clôture, sans la question. */
  passe?: boolean
  /** `montant` : ce que le client a payé, déjà validé. */
  onFait: (montant: number) => void
  onPasFait: () => void
  onClose: () => void
}) {
  const panneauRef = useRef<HTMLDivElement>(null)
  const [saisie, setSaisie] = useState(() => formater(montantPrevu))
  const montant = lireMontant(saisie)

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
          {passe ? 'Avez-vous fait ce rendez-vous ?' : 'Clôturer ce rendez-vous'}
        </h2>
        <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
          {clientName} · <span className="first-letter:uppercase inline-block">{quand}</span>
        </p>

        <div className="mt-4">
          <label htmlFor="cloture-montant" className={`block text-[13px] ${corpsFort}`}>Montant encaissé</label>
          <div className="relative mt-1.5">
            <input
              id="cloture-montant"
              inputMode="decimal"
              autoComplete="off"
              value={saisie}
              onChange={e => setSaisie(e.target.value)}
              aria-invalid={montant === null}
              aria-describedby="cloture-montant-aide"
              className={`${CHAMP} pr-9 tabular-nums`}
            />
            <span aria-hidden className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[15px] ${corps} text-[color:var(--v2-color-gris)]`}>€</span>
          </div>
          <p id="cloture-montant-aide" className={`mt-1 text-[12px] ${corps}`} style={{ color: montant === null ? 'var(--v2-color-rouge)' : 'var(--v2-color-gris)' }}>
            {montant === null
              ? 'Indiquez un montant, par exemple 45 ou 45,50.'
              : montant === montantPrevu
                ? 'Le prix prévu. Changez-le si votre client a payé autre chose.'
                : `Prévu : ${formater(montantPrevu)} €. La facture et vos chiffres prendront ${formater(montant)} €.`}
          </p>
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={() => { if (montant !== null) onFait(montant) }}
            disabled={montant === null}
            className="w-full flex items-start gap-3 text-left p-3 rounded-[var(--v2-radius-carte)] border transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--v2-color-vert)', background: 'rgba(18, 122, 75, 0.08)' }}
          >
            <span
              className="w-7 h-7 rounded-full text-white flex items-center justify-center shrink-0"
              style={{ background: 'var(--v2-color-vert)' }}
            >
              <Check size={16} strokeWidth={3} />
            </span>
            <span>
              <span className={`block text-[14px] ${corpsFort}`} style={{ color: 'var(--v2-color-vert)' }}>{passe ? 'Oui, je l’ai fait' : 'Marquer terminé'}</span>
              <span className={`block text-[12px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>{suiteFait}</span>
            </span>
          </button>

          {passe && <button
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
          </button>}
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
