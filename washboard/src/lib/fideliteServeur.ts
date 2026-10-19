import type { SupabaseClient } from '@supabase/supabase-js'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import { logger } from '@/lib/logger'
import { carteVisible, cleFidelite, etatCarte, fideliteActive, nouveauJeton, numeroStable, phraseCarte, recompenseCourte, tamponsPour, type EtatCarte, type ReglagesFidelite, type ReservationClient } from '@/lib/fidelite'
import { couleurCarte, numeroCarte, type ApparenceCarte } from '@/lib/carteFidelite'
import { hasFeature, SITE_URL_FALLBACK, type AbonnementInfo } from '@/lib/plan'
import { urlVersionnee } from '@/lib/themes'
import { sendTamponFidelite } from '@/lib/email'

// Lectures et écritures de la carte de fidélité (règles : lib/fidelite.ts). Toujours avec le
// client service_role : la carte est consultée depuis des pages publiques (réservation, page
// carte) où personne n'est connecté. Chaque requête porte le `washer_id`.
//
// Table absente (migration pas encore passée) : tout rend `null`, la réservation et les pages
// fonctionnent comme si le laveur n'avait pas de carte.

type Reservation = ReservationClient & { client_email: string | null; client_phone: string | null }

/** Les réservations d'un client chez un laveur, reconnues par `cleFidelite` (téléphone d'abord).
 *  Avant de MONTRER la carte au client, passer par `carteVisible` (lib/fidelite.ts). */
export async function reservationsDuClient(admin: SupabaseClient, washerId: string, cle: string): Promise<ReservationClient[] | null> {
  if (!cle) return []
  let requete = admin.from('bookings').select('id, status, fidelite_remise, vehicle_count, client_email, client_phone').eq('washer_id', washerId)
  // Filtrer en base au plus près, puis appliquer exactement la règle de `cleFidelite`. Un
  // numéro s'écrit avec ou sans espaces, points ou indicatif : on cherche ses 6 derniers
  // chiffres dans cet ordre, quoi qu'il y ait entre eux.
  requete = cle.startsWith('tel:')
    ? requete.ilike('client_phone', `%${cle.slice(-6).split('').join('%')}`)
    : requete.ilike('client_email', cle)
  const { data, error } = await requete.limit(2000)
  if (error) {
    if (!migrationEnAttente(error)) logger.error('fidelite.reservations.read_failed', { washerId }, error)
    return null
  }
  return ((data ?? []) as Reservation[]).filter(r => cleFidelite(r.client_email, r.client_phone) === cle)
}

/** La fiche client du CRM est rangée par `cleClient` (email d'abord) ; la carte, par
 *  téléphone. On retrouve le téléphone du client dans sa réservation la plus récente. */
export async function cleFideliteDepuisCrm(admin: SupabaseClient, washerId: string, cleCrm: string): Promise<string> {
  if (cleCrm.startsWith('tel:')) return cleFidelite(null, cleCrm.slice(4))
  const { data } = await admin.from('bookings').select('client_email, client_phone')
    .eq('washer_id', washerId).ilike('client_email', cleCrm)
    .order('created_at', { ascending: false }).limit(20)
  const avecTel = ((data ?? []) as { client_email: string | null; client_phone: string | null }[]).find(r => numeroStable(r.client_phone))
  return cleFidelite(cleCrm, avecTel?.client_phone ?? null)
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

export async function etatDuClient(admin: SupabaseClient, washerId: string, cle: string, requis: number, ajustement: number, parVehicule = false): Promise<EtatCarte | null> {
  const reservations = await reservationsDuClient(admin, washerId, cle)
  return reservations ? etatCarte(reservations, ajustement, requis, parVehicule) : null
}

export type { ApparenceCarte }

export type LaveurCarte = AbonnementInfo & { name: string; brand_color?: string | null; logo_url?: string | null; profile_updated_at?: string | null }

/** Le logo n'apparaît que si le laveur en a un et que son offre permet la page personnalisée
 *  (même règle que sur sa page de réservation) ; sans choix enregistré, on le prend s'il existe. */
export function logoCarte(laveur: LaveurCarte): string | null {
  return hasFeature(laveur, 'page_personnalisee') && laveur.logo_url ? urlVersionnee(laveur.logo_url, laveur.profile_updated_at) : null
}

export function apparenceCarte(laveur: LaveurCarte, reglages: ReglagesFidelite, jeton?: string | null): ApparenceCarte {
  const logo = logoCarte(laveur)
  const embleme = reglages.embleme ?? (logo ? 'logo' : 'initiale')
  return {
    couleur: couleurCarte(reglages.couleur, laveur.brand_color),
    finition: reglages.finition ?? 'holo',
    nom: laveur.name,
    logo: embleme === 'logo' ? logo : null,
    numero: numeroCarte(jeton),
    recompense: recompenseCourte(reglages),
  }
}

/** Le laveur vient de marquer une prestation terminée : le tampon compte. On prévient le client
 *  par email, avec le lien qui fait frapper le tampon sur sa carte (`/fidelite/<jeton>?tampon=N`,
 *  N tampons quand le laveur en donne un par véhicule).
 *  Email seulement : un SMS coûterait des crédits pris sur le quota du laveur (à trancher).
 *  Rend `true` si un message est parti. Ne lève jamais : la clôture du rendez-vous passe avant. */
export async function prevenirTampon(
  admin: SupabaseClient,
  laveur: LaveurCarte & { id: string; fidelite?: unknown },
  reservation: { id: string; client_email: string | null; client_phone: string | null; client_name: string | null; vehicle_count?: number | null },
): Promise<boolean> {
  const reglages = fideliteActive(laveur.fidelite)
  const email = reservation.client_email?.trim()
  const cle = cleFidelite(reservation.client_email, reservation.client_phone)
  if (!reglages || !email || !cle) return false
  try {
    // Créée au besoin : un client venu avant que le laveur lance sa carte a droit à la sienne.
    const carte = await assurerCarte(admin, laveur.id, cle)
    if (!carte) return false
    const reservations = await reservationsDuClient(admin, laveur.id, cle)
    if (!reservations) return false
    // Le lien de la carte part à l'email de CETTE réservation : seulement s'il est déjà connu
    // sur ce numéro (`carteVisible`), sans quoi on enverrait les tampons d'un autre.
    if (!carteVisible(reservations.filter(r => r.id !== reservation.id), email)) return false
    const etat = etatCarte(reservations, carte.ajustement, reglages.tampons, reglages.tampon_par_vehicule)
    const complete = etat.disponibles > 0
    const nouveaux = tamponsPour(reservation, reglages.tampon_par_vehicule)
    await sendTamponFidelite({
      to: email,
      clientName: reservation.client_name,
      washerName: laveur.name,
      url: `${SITE_URL_FALLBACK}/fidelite/${carte.jeton}?tampon=${nouveaux}`,
      nouveaux,
      tampons: complete ? etat.requis : etat.progression,
      requis: etat.requis,
      complete,
      phrase: phraseCarte(etat, reglages),
      couleur: couleurCarte(reglages.couleur, laveur.brand_color),
    })
    return true
  } catch (e) {
    logger.error('fidelite.tampon.email_failed', { washerId: laveur.id }, e)
    return false
  }
}
