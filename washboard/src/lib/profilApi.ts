// Appels de l'écran « Mon profil » (PWA) à `PATCH /api/washer` — la même route que l'ancien
// écran (`ParametresFormV1`, `FacturationCard`), avec les mêmes corps. Le contrat d'erreur est
// celui de `prestationsApi` : une phrase claire du serveur pour un refus, une simple référence
// (`errorId`) pour une panne, jamais « Failed to fetch ».
//
// Le changement d'adresse e-mail et de mot de passe ne passe PAS par ici : c'est Supabase Auth,
// appelé depuis la feuille elle-même (voir `FeuilleConnexionV2`).

import { appeler, type ResultatApi } from '@/lib/prestationsApi'
import type { ReglagesCentreAuto } from '@/lib/centreAuto'

export type ChampsProfil = Partial<{
  name: string
  base_address: string
  team_size: number
  reservation_jour_meme: boolean
  silhouettes_vehicules: boolean
  demander_type_vehicule: boolean
  travel_fee_tiers: { max_minutes?: number; max_km?: number; fee: number }[]
  travel_fee_mode: 'base' | 'previous'
  sms_sender: string
  facture_statut: 'ei' | 'societe'
  facture_nom_legal: string
  facture_siret: string
  facture_adresse: string
  facture_forme_juridique: string
  facture_capital: string
  facture_immatriculation: string
  facture_regime_tva: 'franchise' | 'assujetti'
  facture_taux_tva: number
  facture_numero_tva: string
  facture_prochain_numero: number
}>

/** N'envoie QUE les champs passés : la route est partagée avec le site, tout ce qui n'est pas
 *  nommé reste tel quel en base. */
export async function enregistrerProfil(champs: ChampsProfil): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PATCH', '/api/washer', champs)
  return r.ok ? { ok: true, data: null } : r
}

/** Réglages « centre auto » (`PUT /api/washer/centre-auto`, colonne à part de la fiche). */
export async function enregistrerCentreAuto(reglages: ReglagesCentreAuto): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'PUT', '/api/washer/centre-auto', reglages)
  return r.ok ? { ok: true, data: null } : r
}

/** Actions sur le compte (`POST /api/account`) : suspendre, réactiver / annuler la suppression,
 *  programmer la suppression (30 jours, le nom exact de l'entreprise est exigé). */
export async function actionCompte(
  action: 'deactivate' | 'reactivate' | 'delete', confirmName?: string,
): Promise<ResultatApi<null>> {
  const r = await appeler('enregistrer', 'POST', '/api/account', { action, confirm_name: confirmName })
  return r.ok ? { ok: true, data: null } : r
}

/** SMS test envoyé sur le téléphone du laveur (`POST /api/test-sms`, plan Pro). */
export async function envoyerSmsTest(): Promise<ResultatApi<null>> {
  const r = await appeler('envoyer', 'POST', '/api/test-sms')
  return r.ok ? { ok: true, data: null } : r
}
