'use client'

import { useDesignMobile } from '@/hooks/useDesignMobile'
import { useEcranRail } from '@/hooks/useEcranRail'

// Décide si le TABLEAU DE BORD (une page entière, pas un composant isolé — pour ça voir
// usePwaStandalone) doit s'afficher en v2. Passe « bureau » (Alexandre, 2026-10-03), qui rouvre
// pour ce seul cas la règle du 2026-09-22 (« le site reste v1 sans exception ») :
//
//   - PWA installée (n'importe quelle largeur) → v2, sans condition : inchangé depuis le
//     2026-10-01 (voir DashboardShell.tsx, qui a cessé de lire `beta_refonte` pour ce cas).
//   - Site (navigateur, pas installé) → v2 SEULEMENT sur grand écran ET avec
//     `washers.beta_refonte` actif. Le site sur téléphone n'est, par construction, jamais
//     « grand écran » (voir grandEcran.ts) : cette branche ne peut donc pas s'activer par
//     erreur sur un laveur mobile, même avec le drapeau posé en base.
//
// `beta_refonte` ici est un garde-fou TEMPORAIRE, pas un retour en arrière sur la décision du
// 2026-10-01 : il protège uniquement le cas bureau, le temps que les écrans suivants (Agenda,
// Chiffres, Plus...) rejoignent la refonte — sans lui, l'équipe basculerait d'un coup sur un
// tableau de bord moitié v2 (Clients) moitié v1 (tout le reste). Recommandation du README de la
// maquette bureau ; à retirer quand la dernière passe (Aujourd'hui) sera livrée.
/** `NEXT_PUBLIC_DEV_BUREAU=1` — fait comme si `washers.beta_refonte` etait actif, pour
 *  pouvoir essayer la v2 bureau en local sans toucher a la vraie base (ce depot n'a pas de
 *  base de test separee, voir e2e/helpers.ts). Jamais en production, meme sur une
 *  previsualisation Vercel : meme motif que `NEXT_PUBLIC_DEV_OFFRE` (lib/plan.ts).
 *
 *  Exportée (passe Chiffres bureau, 2026-10-06) : les garde-fous des destinations neuves
 *  (`Chiffres.tsx`, `Depenses.tsx`) décident une seule fois, au montage, hors du hook — voir
 *  leur en-tête — et ont donc besoin de ce même interrupteur sans passer par `useDashboardV2`. */
export function bureauForceEnDev(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.NEXT_PUBLIC_DEV_BUREAU === '1'
}

export function useDashboardV2(betaRefonte?: boolean | null): boolean {
  const pwa = useDesignMobile()
  const ecranRail = useEcranRail()
  return pwa || (ecranRail && (!!betaRefonte || bureauForceEnDev()))
}
