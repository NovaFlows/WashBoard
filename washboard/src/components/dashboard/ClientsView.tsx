'use client'

import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import type { ClientBooking, ClientDocument, ClientReglages } from '@/lib/clientProfile'
import type { ReglagesRelance } from '@/lib/clientsARelancer'
import type { EntrepriseListItem } from '@/lib/entrepriseProfile'
import ClientsViewV1, { type ClientBloque } from '@/components/dashboard/ClientsViewV1'
import ClientsViewV2 from '@/components/dashboard/ClientsViewV2'
import type { AutomatismesClients } from '@/components/dashboard/AutomatismesClientsV2'

// Point de branchement v1/v2 de l'écran Clients — décision d'Alexandre,
// 2026-09-22 : la refonte 2026 (jetons v2, filtre Pros, avatars carrés pour
// les entreprises...) ne s'applique QU'à la PWA installée en mode standalone.
// Le site (navigateur classique, mobile ou ordinateur) reste v1 sans
// exception : ClientsViewV1.tsx est repris à l'identique du dernier commit
// avant le passage en v2 (8a1efa6), tenu à jour depuis avec la LOGIQUE que
// master ajoute (le plafond de réservations par offre, fusionné le
// 2026-09-28). Voir usePwaStandalone.ts pour pourquoi c'est un hook (la FORME
// change : filtre Pros en plus, avatar carré/rond, badge PRO ↔ pastille de
// droite) et non une simple classe CSS.
//
// Import unique et stable pour tout le reste du dashboard : la page
// /dashboard/clients continue d'importer ClientsView sans rien savoir du
// branchement.
export default function ClientsView({
  bookings, bloques = [], offreDeblocage = 'Pro', montantBloque = 0,
  documents, reglages, reglagesMessages, entreprises, nomLaveur, automatismes,
}: {
  bookings: ClientBooking[]
  /** Clients masqués par le plafond de l'offre (2026-09-28) — voir `ClientsViewV1.tsx`,
   *  `ClientBloque`. Une carte floutée, en tête de la liste (V1 et V2). */
  bloques?: ClientBloque[]
  /** Nom de l'offre qui les débloque — « Starter », « Pro ». */
  offreDeblocage?: string
  /** Total en euros des lavages masqués. */
  montantBloque?: number
  /** Devis et factures écrits à la main. Ils n'existent que dans la PWA : le site garde sa
   *  liste tirée des seules réservations, donc V1 ne les reçoit pas. */
  documents?: ClientDocument[]
  /** « Ne plus contacter », écrit à la main (2026-09-28). Même raison de rester hors de V1 que
   *  les documents : c'est un réglage de la refonte, sans écran ni case dans l'ancien formulaire. */
  reglages?: ClientReglages[]
  /** Nécessaire à l'onglet « À relancer » de V2 (`clientsARelancer.ts`) ; V1 n'a pas cet onglet. */
  reglagesMessages?: ReglagesRelance
  /** Fiches entreprise (2026-09-28) : même raison de rester hors de V1 que les documents. */
  entreprises?: EntrepriseListItem[]
  /** Signature du message WhatsApp envoyé depuis une facture ouverte dans la Fiche entreprise. */
  nomLaveur?: string
  /** Avis Google, relance, créneaux intelligents : PWA seulement (2026-09-30). */
  automatismes?: AutomatismesClients
}) {
  const isPwa = usePwaStandalone()
  return isPwa
    ? (
      <ClientsViewV2
        bookings={bookings} bloques={bloques} offreDeblocage={offreDeblocage} montantBloque={montantBloque}
        documents={documents} reglages={reglages} reglagesMessages={reglagesMessages}
        entreprises={entreprises} nomLaveur={nomLaveur} automatismes={automatismes}
      />
    )
    : <ClientsViewV1 bookings={bookings} bloques={bloques} offreDeblocage={offreDeblocage} montantBloque={montantBloque} />
}
