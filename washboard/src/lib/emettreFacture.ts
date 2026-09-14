import type { createAdminClient } from '@/lib/supabase/admin'
import {
  construireFacture, infosFacturationManquantes,
  type ReservationFacturable, type VendeurFacturable,
} from '@/lib/facture'
import { logger } from '@/lib/logger'

export type ResultatEmission =
  | { ok: true; numero: string; nouvelle: boolean }
  | { ok: false; raison: 'infos_incompletes'; manques: string[] }
  | { ok: false; raison: 'erreur' }

// Chaîne écrite telle quelle, et non assemblée : le client Supabase analyse la
// sélection au niveau des types, et une chaîne calculée le fait échouer.
const COLONNES_VENDEUR =
  'name, phone, logo_url, brand_color, facture_statut, facture_nom_legal, facture_siret, facture_adresse, facture_forme_juridique, facture_capital, facture_immatriculation, facture_regime_tva, facture_taux_tva, facture_numero_tva'

/** Émet la facture d'une réservation terminée, une seule fois.
 *
 *  Le numéro est attribué en base par `emettre_facture`, qui verrouille la
 *  réservation puis la fiche du laveur : deux émissions simultanées ne peuvent
 *  ni consommer deux numéros pour la même réservation, ni laisser un trou dans
 *  la suite. Le contenu est construit ici et figé dans la même opération.
 *
 *  L'appelant a déjà vérifié que la réservation appartient au laveur : cette
 *  fonction passe par le client admin, seul autorisé à appeler la fonction SQL. */
export async function emettreFacture(
  admin: ReturnType<typeof createAdminClient>,
  bookingId: string,
): Promise<ResultatEmission> {
  const { data: reservation, error } = await admin
    .from('bookings')
    .select(`*, services(name), washers(${COLONNES_VENDEUR})`)
    .eq('id', bookingId)
    .single()

  if (error || !reservation) {
    logger.error('facture.reservation.read_failed', { bookingId }, error)
    return { ok: false, raison: 'erreur' }
  }
  if (reservation.facture_numero) {
    return { ok: true, numero: reservation.facture_numero, nouvelle: false }
  }

  const vendeur = reservation.washers as VendeurFacturable | null
  const manques = vendeur ? infosFacturationManquantes(vendeur) : ['vos informations de facturation']
  if (!vendeur || manques.length > 0) {
    logger.info('facture.non_emise.infos_incompletes', { bookingId, washerId: reservation.washer_id })
    return { ok: false, raison: 'infos_incompletes', manques }
  }

  const contenu = construireFacture(reservation as ReservationFacturable, vendeur)
  const { data, error: errEmission } = await admin.rpc('emettre_facture', {
    p_booking_id: bookingId,
    p_contenu: contenu,
  })
  if (errEmission) {
    logger.error('facture.emission_failed', { bookingId }, errEmission)
    return { ok: false, raison: 'erreur' }
  }

  const emise = (Array.isArray(data) ? data[0] : data) as { numero?: string } | null
  if (!emise?.numero) {
    logger.error('facture.emission_sans_numero', { bookingId })
    return { ok: false, raison: 'erreur' }
  }
  logger.info('facture.emise', { bookingId, numero: emise.numero })
  return { ok: true, numero: emise.numero, nouvelle: true }
}
