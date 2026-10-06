'use client'

import { useDashboardV2 } from '@/hooks/useDashboardV2'
import AbonnementPanel from '@/components/dashboard/AbonnementPanel'
import AbonnementV2 from '@/components/dashboard/AbonnementV2'
import type { Plan } from '@/lib/plan'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Point de branchement v1/v2 de l'écran d'abonnement — même règle que
// ClientsView.tsx, ParametresForm.tsx ou Accueil.tsx : la refonte 2026 ne
// s'applique QU'à la PWA installée en mode standalone, le site reste v1 sans
// exception (décision d'Alexandre, 2026-09-22). `usePwaStandalone()` plutôt
// que la classe CSS `wb-pwa` : ce n'est pas un changement de couleurs, c'est
// une mise en page différente (grille à deux colonnes contre pile d'offres).
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau, second lot ») pour le SITE sur grand écran,
// comme `ParametresForm.tsx` : `usePwaStandalone()` nu est remplacé par
// `useDashboardV2(betaRefonte)`, qui couvre en plus ce cas (voir ce hook). PWA installée :
// comportement inchangé, quelle que soit sa largeur. Site sur téléphone : inchangé (jamais
// « grand écran »).
//
// Les deux versions reçoivent EXACTEMENT les mêmes props, calculées une seule
// fois par `dashboard/abonnement/page.tsx` : aucun risque qu'un montant, un
// plafond ou une date diverge d'une version à l'autre.
export type PropsAbonnement = {
  subscriptionStatus: string
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  plan: Plan
  grandfathered: boolean
  /** `null` : l'offre n'a pas de plafond, ou le comptage n'a pas pu être lu. */
  plafondReservations: number | null
  reservationsCeMois: number | null
  plafondPrestations: number | null
  prestationsAuCatalogue: number | null
  /** Date à laquelle le compteur repart, déjà écrite (« 22 octobre »). */
  remiseAZero: string
  /** Essai terminé sans formule choisie : le compte tourne sur Découverte. */
  doitChoisir: boolean
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`) —
   *  ignorée côté v1 et sur téléphone, où cet écran reste plein écran. */
  liste: ReglagesListeProps
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». Sans effet
   *  dans la PWA, où v2 s'affiche sans condition. Ignoré côté v1 (jamais lu par ce composant). */
  betaRefonte?: boolean | null
}

export default function Abonnement({ betaRefonte, ...props }: PropsAbonnement) {
  const estV2 = useDashboardV2(betaRefonte)
  return estV2 ? <AbonnementV2 {...props} /> : <AbonnementPanel {...props} />
}

/** En-tête de la page — même motif que `EnteteParametres` : le site garde son
 *  titre, l'application n'en affiche pas ici car `AbonnementV2` porte le sien
 *  (« Mon offre ») en tête de son propre écran. Même garde que `Abonnement` ci-dessus
 *  (`useDashboardV2`), pour que le site sur grand écran masque lui aussi ce titre v1 : sans ça,
 *  « Abonnement » s'affichait deux fois au-dessus du panneau v2 (celui-ci, puis « Mon offre »). */
export function EnteteAbonnement({ betaRefonte }: { betaRefonte?: boolean | null } = {}) {
  const estV2 = useDashboardV2(betaRefonte)
  if (estV2) return null
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Abonnement</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gérez votre abonnement WashBoard</p>
    </div>
  )
}
