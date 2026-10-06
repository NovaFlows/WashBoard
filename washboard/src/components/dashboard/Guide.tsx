'use client'

import { useDashboardV2 } from '@/hooks/useDashboardV2'
import GuideV2 from '@/components/dashboard/GuideV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Point de branchement v1/v2 du guide — même schéma que `ClientsView.tsx` : la refonte 2026
// ne s'applique QU'À la PWA installée (décision d'Alexandre, 2026-09-22), le site garde son
// écran mot pour mot. D'où le v1 passé en enfant plutôt que réécrit ici : il reste ce qu'il
// était, rendu par la page.
//
// RÉOUVERT le 2026-10-06 (passe « Plus bureau, second lot ») pour le SITE sur grand écran,
// comme `ParametresForm.tsx` : `usePwaStandalone()` nu est remplacé par
// `useDashboardV2(betaRefonte)`.
//
// Le CONTENU, lui, est le même des deux côtés (`lib/guide.ts`) : seule la façon de le lire
// change — questions repliées, liens traduits vers les écrans v2 (voir `GuideV2`).
export default function Guide({ v1, liste, betaRefonte }: {
  v1: React.ReactNode
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`). Ignorée
   *  côté v1 et sur téléphone. */
  liste: ReglagesListeProps
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran ». */
  betaRefonte?: boolean | null
}) {
  const estV2 = useDashboardV2(betaRefonte)
  return estV2 ? <GuideV2 liste={liste} /> : <>{v1}</>
}
