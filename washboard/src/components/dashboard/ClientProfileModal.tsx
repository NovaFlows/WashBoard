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
export default function ClientProfileModal({
  profile,
  onClose,
  entrepriseDuContact,
  entreprisesDisponibles,
  onOuvrirEntreprise,
  doublon,
  nomLaveur,
}: {
  profile: ClientProfile
  onClose: () => void
  /** Fiche entreprise (2026-09-28) : V1 n'y a pas accès, ces props sont ignorées côté site. */
  entrepriseDuContact?: { id: string; nom: string; role: string | null } | null
  entreprisesDisponibles?: { id: string; nom: string }[]
  onOuvrirEntreprise?: (id: string) => void
  doublon?: Doublon | null
  nomLaveur?: string
}) {
  const isPwa = usePwaStandalone()
  return isPwa
    ? (
      <ClientProfileModalV2
        profile={profile} onClose={onClose}
        entrepriseDuContact={entrepriseDuContact} entreprisesDisponibles={entreprisesDisponibles}
        onOuvrirEntreprise={onOuvrirEntreprise} doublon={doublon} nomLaveur={nomLaveur}
      />
    )
    : <ClientProfileModalV1 profile={profile} onClose={onClose} />
}
