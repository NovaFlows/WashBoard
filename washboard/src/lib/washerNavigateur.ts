import type { Washer } from '@/types'

/** Colonnes de `washers` qui ne doivent jamais atteindre le navigateur. */
export const COLONNES_SERVEUR = ['google_refresh_token', 'stripe_customer_id', 'stripe_subscription_id', 'cgv_acceptees_ip'] as const

export type WasherNavigateur = Omit<Washer, (typeof COLONNES_SERVEUR)[number]> & { google_agenda_connecte: boolean }

/** Fiche laveur à passer à un composant client : sans les colonnes serveur, avec l'état de connexion Google Agenda. */
export function pourLeNavigateur(washer: Washer & Record<string, unknown>): WasherNavigateur {
  const copie: Record<string, unknown> = { ...washer }
  for (const c of COLONNES_SERVEUR) delete copie[c]
  return { ...(copie as WasherNavigateur), google_agenda_connecte: !!washer.google_refresh_token }
}
