'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { useGrandEcran } from '@/hooks/useGrandEcran'

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
export function useDashboardV2(betaRefonte?: boolean | null): boolean {
  const pwa = usePwaStandalone()
  const grandEcran = useGrandEcran()
  return pwa || (grandEcran && !!betaRefonte)
}
