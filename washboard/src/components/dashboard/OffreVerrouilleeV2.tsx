'use client'

import Link from 'next/link'
import { Check, Lock } from 'lucide-react'
import {
  PLAN_CARDS, PLAN_LABELS, PLAN_PRICES, PLAN_COULEURS, requiredPlan,
  lienRendezVousBusiness, rendezVousExterne, LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, type Feature,
} from '@/lib/plan'

// « Cette fonctionnalité fait partie d'une offre supérieure », version v2 —
// l'équivalent de `UpgradePrompt.tsx` (site) pour les écrans de la refonte.
//
// Pourquoi une seconde version plutôt qu'un habillage conditionnel : la carte
// du site pose ses propres blancs, ses ombres et son bleu #1651E8. Posée telle
// quelle au milieu d'un écran v2, elle se lisait comme une pièce rapportée —
// exactement ce qu'Alexandre a signalé le 2026-09-29 (« ça n'a rien à voir »).
// Le fond des données reste commun : `PLAN_CARDS`, `requiredPlan` et les prix
// viennent de `lib/plan.ts`, jamais d'un texte recopié ici.
//
// Ce qu'elle garde de la version site, parce que ça vend et pas seulement
// refuse : le PRIX (sans quoi le laveur doit aller le chercher ailleurs, et
// n'y va pas), CE QUE CONTIENT le palier (on ne vend pas une case, on vend une
// offre) et un bouton qui dit où il mène.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

export function OffreVerrouilleeV2({ titre: intitule, description, feature, rassurance }: {
  titre: string
  description: string
  feature: Feature
  /** Une ligne sur ce qui se passe PENDANT l'attente : les données s'accumulent
   *  déjà, seul l'affichage est fermé. Sans elle, le laveur croit qu'attendre
   *  lui coûte son historique. */
  rassurance?: string
}) {
  const offre = requiredPlan(feature)
  const carte = PLAN_CARDS.find(c => c.key === offre)
  const prix = PLAN_PRICES[offre]
  const label = PLAN_LABELS[offre]
  const rdvBusiness = lienRendezVousBusiness()
  // Trois arguments : au-delà, on ne lit plus une proposition, on parcourt une
  // grille tarifaire — et il y en a une, à un tap.
  const avantages = (carte?.features ?? []).slice(0, 3)

  return (
    <div className={`rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-5 ${police}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--v2-color-gris)]">
          <Lock size={13} strokeWidth={2.5} aria-hidden />
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: PLAN_COULEURS[offre] }}
              aria-hidden
            />
            Offre {label}
          </span>
        </span>
        <span className={`shrink-0 text-[18px] leading-none ${hero}`}>
          {carte?.surDevis ? (
            <span className={`text-[14px] ${corpsFort}`}>{LIBELLE_CONTACT}</span>
          ) : (
            <>
              {carte?.from && <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>dès </span>}
              {prix} €<span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>/mois</span>
            </>
          )}
        </span>
      </div>

      <h2 className={`mt-4 text-[19px] leading-tight ${titre}`}>{intitule}</h2>
      <p className={`mt-1.5 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{description}</p>

      {rassurance && (
        <p className={`mt-3 text-[13px] leading-snug ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>
          {rassurance}
        </p>
      )}

      {avantages.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-[color:var(--v2-filet)] pt-4">
          {avantages.map(a => (
            <li key={a} className={`flex items-start gap-2 text-[13.5px] leading-snug ${corps}`}>
              <Check size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" style={{ color: 'var(--v2-color-vert)' }} aria-hidden />
              {a}
            </li>
          ))}
        </ul>
      )}

      {carte?.surDevis ? (
        <a
          href={rdvBusiness}
          {...(rendezVousExterne(rdvBusiness) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={`mt-5 flex h-11 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] text-[15px] text-white ${corpsFort} transition-transform active:scale-[.98]`}
          style={{ background: 'var(--v2-color-accent)' }}
        >
          {LIBELLE_RDV_BUSINESS}
        </a>
      ) : (
        <Link
          href="/dashboard/abonnement"
          className={`mt-5 flex h-11 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] text-[15px] text-white ${corpsFort} transition-transform active:scale-[.98]`}
          style={{ background: 'var(--v2-color-accent)' }}
        >
          Passer à {label} — {prix} €/mois
        </Link>
      )}

      <Link
        href="/dashboard/abonnement"
        className={`mt-2.5 block text-center text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}
      >
        Comparer toutes les offres
      </Link>
    </div>
  )
}
