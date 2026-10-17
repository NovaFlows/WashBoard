import type { SupabaseClient } from '@supabase/supabase-js'
import { cleClient } from '@/lib/clientProfile'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import { logger } from '@/lib/logger'
import { etatCarte, nouveauJeton, type EtatCarte, type ReservationCarte } from '@/lib/fidelite'

// Lectures et écritures de la carte de fidélité (règles : lib/fidelite.ts). Toujours avec le
// client service_role : la carte est consultée depuis des pages publiques (réservation, page
// carte) où personne n'est connecté. Chaque requête porte le `washer_id`.
//
// Table absente (migration pas encore passée) : tout rend `null`, la réservation et les pages
// fonctionnent comme si le laveur n'avait pas de carte.

type Reservation = ReservationCarte & { client_email: string | null; client_phone: string | null }

/** Les réservations d'un client chez un laveur, reconnues comme dans le CRM (`cleClient`). */
export async function reservationsDuClient(admin: SupabaseClient, washerId: string, cle: string): Promise<ReservationCarte[] | null> {
  if (!cle) return []
  let requete = admin.from('bookings').select('status, fidelite_remise, client_email, client_phone').eq('washer_id', washerId)
  // Filtrer en base au plus près, puis appliquer exactement la même règle que le CRM.
  requete = cle.startsWith('tel:') ? requete.or('client_email.is.null,client_email.eq.') : requete.ilike('client_email', cle)
  const { data, error } = await requete.limit(2000)
  if (error) {
    if (!migrationEnAttente(error)) logger.error('fidelite.reservations.read_failed', { washerId }, error)
    return null
  }
  return ((data ?? []) as Reservation[]).filter(r => cleClient(r.client_email, r.client_phone) === cle)
}

export type Carte = { jeton: string; ajustement: number }

export async function lireCarte(admin: SupabaseClient, washerId: string, cle: string): Promise<Carte | null> {
  const { data, error } = await admin.from('fidelite_cartes').select('jeton, ajustement').eq('washer_id', washerId).eq('cle', cle).maybeSingle()
  if (error) {
    if (!migrationEnAttente(error)) logger.error('fidelite.carte.read_failed', { washerId }, error)
    return null
  }
  return data ? { jeton: data.jeton as string, ajustement: Number(data.ajustement ?? 0) } : null
}

/** La carte du client, créée au besoin (première réservation chez un laveur qui a une carte). */
export async function assurerCarte(admin: SupabaseClient, washerId: string, cle: string): Promise<Carte | null> {
  if (!cle) return null
  const existante = await lireCarte(admin, washerId, cle)
  if (existante) return existante
  const { error } = await admin.from('fidelite_cartes').upsert(
    { washer_id: washerId, cle, jeton: nouveauJeton(), ajustement: 0 },
    { onConflict: 'washer_id,cle', ignoreDuplicates: true },
  )
  if (error) {
    if (!migrationEnAttente(error)) logger.error('fidelite.carte.create_failed', { washerId }, error)
    return null
  }
  // Relue plutôt que reprise de l'insertion : deux réservations simultanées du même client
  // ne doivent pas repartir avec deux jetons différents.
  return lireCarte(admin, washerId, cle)
}

export async function etatDuClient(admin: SupabaseClient, washerId: string, cle: string, requis: number, ajustement: number): Promise<EtatCarte | null> {
  const reservations = await reservationsDuClient(admin, washerId, cle)
  return reservations ? etatCarte(reservations, ajustement, requis) : null
}
