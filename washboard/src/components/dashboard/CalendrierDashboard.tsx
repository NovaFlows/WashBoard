'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import CalendrierDashboardV1, { type CalendrierProps } from '@/components/dashboard/CalendrierDashboardV1'
import CalendrierDashboardV2 from '@/components/dashboard/CalendrierDashboardV2'

// Point de branchement v1/v2 de l'écran Agenda (calendrier) — passe 7 de la
// refonte 2026, même schéma que ClientsView.tsx / ClientProfileModal.tsx /
// ParametresForm.tsx : même URL (`/dashboard/calendrier`) qu'avant, mais une
// FORME de contenu totalement différente entre v1 (grille mois/semaine/jour)
// et v2 (agenda du jour, bandeau de 7 jours, temps de route entre deux
// jobs) — vérifié en comparant le JSX des deux avant d'écrire quoi que ce
// soit, pas supposé. `usePwaStandalone()` plutôt que la classe CSS `wb-pwa` :
// voir `.claude/agents/refonte.md`, « v1 sur le site, v2 seulement dans la
// PWA installée ».
//
// Import unique et stable pour tout le reste du dashboard :
// `/dashboard/calendrier/page.tsx` continue d'importer CalendrierDashboard
// sans rien savoir du branchement.
export default function CalendrierDashboard(props: CalendrierProps) {
  const isPwa = usePwaStandalone()
  return isPwa ? <CalendrierDashboardV2 {...props} /> : <CalendrierDashboardV1 {...props} />
}
