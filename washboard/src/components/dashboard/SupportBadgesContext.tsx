'use client'

import { createContext, useContext } from 'react'

// Les trois signaux du canal d'assistance, interrogés UNE seule fois par page
// par DashboardShell (useEstEquipeSupport, useSupportUnreadBadge,
// useSupportUnreadTeamBadge) et redistribués à qui en a besoin sous lui.
//
// Pourquoi un contexte : dans la PWA en bêta (refonte 2026), l'en-tête et son
// bouton ☰ disparaissent, et avec eux le menu latéral qui portait ces trois
// signaux. Ils se retrouvent sur l'écran « Plus » (ParametresFormV2) — qui les
// lit ici plutôt que de relancer trois requêtes /api/support/* par-dessus
// celles du châssis. Hors du châssis (aucun fournisseur), la valeur par défaut
// dit « rien à afficher » : jamais d'entrée réservée à l'équipe par erreur.

export type SupportBadges = {
  /** Confirmé par le serveur uniquement (voir useEstEquipeSupport). */
  estEquipeSupport: boolean
  /** Réponses de l'équipe non lues par CE compte en tant que laveur. */
  unreadSupportCount: number | null
  /** Messages de laveurs non lus par l'équipe (compte membre de l'équipe). */
  unreadTeamCount: number | null
}

export const SupportBadgesContext = createContext<SupportBadges>({
  estEquipeSupport: false,
  unreadSupportCount: null,
  unreadTeamCount: null,
})

export function useSupportBadges(): SupportBadges {
  return useContext(SupportBadgesContext)
}
