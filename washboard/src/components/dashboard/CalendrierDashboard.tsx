'use client'

import { useDashboardV2 } from '@/hooks/useDashboardV2'
import CalendrierDashboardV1, { type CalendrierProps } from '@/components/dashboard/CalendrierDashboardV1'
import CalendrierDashboardV2 from '@/components/dashboard/CalendrierDashboardV2'
import { JoursClientsMasques } from '@/components/dashboard/JoursClientsMasques'

// Point de branchement v1/v2 de l'écran Agenda (calendrier) — passe 7 de la
// refonte 2026, même schéma que ClientsView.tsx / ClientProfileModal.tsx /
// ParametresForm.tsx : même URL (`/dashboard/calendrier`) qu'avant, mais une
// FORME de contenu totalement différente entre v1 (grille mois/semaine/jour)
// et v2 (agenda du jour, bandeau de 7 jours, temps de route entre deux
// jobs) — vérifié en comparant le JSX des deux avant d'écrire quoi que ce
// soit, pas supposé.
//
// RÉOUVERT le 2026-10-06 (passe bureau), pour le SITE sur grand écran uniquement — même
// changement que ClientsView.tsx/Accueil.tsx le 2026-10-03 : `useDashboardV2()` remplace ici
// l'ancien `usePwaStandalone()` nu. PWA installée : comportement inchangé (v2 sans condition).
// Site sur téléphone : inchangé (jamais « grand écran », voir `grandEcran.ts`). Site sur
// ordinateur : voit désormais v2 lui aussi, sous le garde-fou temporaire `washer.beta_refonte`
// (voir `useDashboardV2.ts`) — c'est `CalendrierDashboardV2.tsx` qui décide ensuite, via
// `useGrandEcran()`, s'il a la place pour la grille de semaine et le panneau de fiche à côté.
//
// Import unique et stable pour tout le reste du dashboard :
// `/dashboard/calendrier/page.tsx` continue d'importer CalendrierDashboard
// sans rien savoir du branchement.
export default function CalendrierDashboard({ betaRefonte, ...props }: CalendrierProps & {
  /** `washer.beta_refonte` — garde-fou temporaire du cas « site, grand écran » (voir
   *  `useDashboardV2.ts`). Sans effet dans la PWA, où v2 s'affiche sans condition. */
  betaRefonte?: boolean | null
}) {
  const estV2 = useDashboardV2(betaRefonte)
  if (estV2) return <CalendrierDashboardV2 {...props} />
  // Sur le site, le bandeau des clients masqués garde sa place au-dessus de la grille ; dans la
  // PWA il est rendu DANS l'agenda v2 (sinon le conteneur v2, qui remonte de 24 px, le rogne).
  return (
    <>
      <JoursClientsMasques dates={props.joursMasques ?? []} />
      <CalendrierDashboardV1 {...props} />
    </>
  )
}
