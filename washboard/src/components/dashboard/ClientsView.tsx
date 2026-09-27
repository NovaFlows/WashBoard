'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import type { ClientBooking, ClientDocument } from '@/lib/clientProfile'
import ClientsViewV1 from '@/components/dashboard/ClientsViewV1'
import ClientsViewV2 from '@/components/dashboard/ClientsViewV2'

// Point de branchement v1/v2 de l'écran Clients — décision d'Alexandre,
// 2026-09-22 : la refonte 2026 (jetons v2, filtre Pros, avatars carrés pour
// les entreprises...) ne s'applique QU'à la PWA installée en mode standalone.
// Le site (navigateur classique, mobile ou ordinateur) reste v1 sans
// exception : ClientsViewV1.tsx est repris à l'identique du dernier commit
// avant le passage en v2 (8a1efa6). Voir usePwaStandalone.ts pour pourquoi
// c'est un hook (la FORME change : filtre Pros en plus, avatar carré/rond,
// badge PRO ↔ pastille de droite) et non une simple classe CSS.
//
// Import unique et stable pour tout le reste du dashboard : la page
// /dashboard/clients continue d'importer ClientsView sans rien savoir du
// branchement.
export default function ClientsView({ bookings, documents }: {
  bookings: ClientBooking[]
  /** Devis et factures écrits à la main. Ils n'existent que dans la PWA : le site garde sa
   *  liste tirée des seules réservations, donc V1 ne les reçoit pas. */
  documents?: ClientDocument[]
}) {
  const isPwa = usePwaStandalone()
  return isPwa
    ? <ClientsViewV2 bookings={bookings} documents={documents} />
    : <ClientsViewV1 bookings={bookings} />
}
