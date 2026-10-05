'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import type { ClientProfile } from '@/lib/clientProfile'
import type { Doublon } from '@/lib/doublons'
import ClientProfileModalV1 from '@/components/dashboard/ClientProfileModalV1'
import ClientProfileModalV2 from '@/components/dashboard/ClientProfileModalV2'

// Point de branchement v1/v2 de la fiche client — décision d'Alexandre,
// 2026-09-22 : la refonte 2026 (feuille qui monte du bas, jetons v2, piège
// de focus, boutons Appeler/Message) ne s'applique QU'à la PWA installée en
// mode standalone. Le site (navigateur classique, mobile ou ordinateur)
// reste v1 (carte centrée classique) sans exception : ClientProfileModalV1.tsx
// est repris à l'identique du dernier commit avant le passage en v2
// (8a1efa6). Voir usePwaStandalone.ts pour pourquoi c'est un hook — la FORME
// change ici plus que pour n'importe quel autre écran de la refonte (carte
// vs feuille, piège de focus, retour de focus, animation d'entrée) — et non
// une simple classe CSS.
//
// Import unique et stable pour tout le reste du dashboard : ClientsView.tsx,
// CrmDashboard.tsx (l'ancien CRM, resté en v1 volontairement — voir la passe
// 5, qui fusionne CRM + Comptabilité dans un nouvel écran « Chiffres » plutôt
// que de forker cet écran-ci) et ChiffresClients.tsx (le nouvel onglet
// Clients de « Chiffres ») continuent d'importer ClientProfileModal sans
// rien savoir du branchement.
//
// `v2` (passe bureau, 2026-10-05) : permet à un appelant qui a DÉJÀ tranché v1/v2 pour toute la
// page (ClientsView.tsx, via `useDashboardV2` — PWA installée OU site sur grand écran avec
// `washers.beta_refonte`) de l'imposer ici plutôt que de le redemander avec le seul critère PWA.
// Sans ça, ouvrir cette fiche depuis l'écran Clients en mode « site, grand écran » rouvrirait la
// question ICI avec `usePwaStandalone()` seul, qui répondrait FAUX (on n'est pas dans la PWA) —
// la liste derrière se serait affichée en v2 pendant que sa fiche retomberait en v1. Omis
// (CrmDashboard.tsx, qui n'a jamais connu ce cas) : comportement d'avant, inchangé, PWA
// uniquement.
export default function ClientProfileModal({
  profile,
  onClose,
  entrepriseDuContact,
  entreprisesDisponibles,
  onOuvrirEntreprise,
  doublon,
  nomLaveur,
  v2,
  panneau,
}: {
  profile: ClientProfile
  onClose: () => void
  /** Fiche entreprise (2026-09-28) : V1 n'y a pas accès, ces props sont ignorées côté site. */
  entrepriseDuContact?: { id: string; nom: string; role: string | null } | null
  entreprisesDisponibles?: { id: string; nom: string }[]
  onOuvrirEntreprise?: (id: string) => void
  doublon?: Doublon | null
  nomLaveur?: string
  /** Impose la présentation v2 (voir plus haut) sans repasser par `usePwaStandalone()`. */
  v2?: boolean
  /** Panneau fixe à côté de la liste plutôt que feuille/carte qui se superpose — v2 bureau
   *  uniquement (voir ClientsViewV2.tsx, `ClientProfileModalV2.tsx`). Ignoré par V1 et par le
   *  cas PWA (qui reste une feuille/carte superposée, inchangé). */
  panneau?: boolean
}) {
  const isPwa = usePwaStandalone()
  const estV2 = v2 ?? isPwa
  return estV2
    ? (
      <ClientProfileModalV2
        profile={profile} onClose={onClose}
        entrepriseDuContact={entrepriseDuContact} entreprisesDisponibles={entreprisesDisponibles}
        onOuvrirEntreprise={onOuvrirEntreprise} doublon={doublon} nomLaveur={nomLaveur}
        panneau={panneau}
      />
    )
    : <ClientProfileModalV1 profile={profile} onClose={onClose} />
}
