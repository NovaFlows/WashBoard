// Appels de l'écran « Mon profil » (PWA) à `PATCH /api/washer` — la même route que l'ancien
// écran (`ParametresFormV1`, `FacturationCard`), avec les mêmes corps. Le contrat d'erreur est
// celui de `prestationsApi` : une phrase claire du serveur pour un refus, une simple référence
// (`errorId`) pour une panne, jamais « Failed to fetch ».
//
// Le changement d'adresse e-mail et de mot de passe ne passe PAS par ici : c'est Supabase Auth,
// appelé depuis la feuille elle-même (voir `FeuilleConnexionV2`).

import { appeler, type ResultatApi } from '@/lib/prestationsApi'

export type ChampsProfil = Partial<{
  name: string
  phone: string
  base_address: string
  team_size: number
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
