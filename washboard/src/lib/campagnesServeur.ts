import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { migrationEnAttente } from '@/lib/migrationEnAttente'
import {
  bilansParCampagne, bilansParCreation, resteHorsCreations,
  type Campagne, type CampagneAffichee, type Creation, type Format, type Plateforme,
} from '@/lib/campagne'

// Lecture des campagnes publicitaires, partagée par les DEUX écrans qui les
// montrent : l'onglet Publicités du CRM sur le site (v1) et l'écran Publicités
// de l'application installée (v2).
//
// Partagée et pas recopiée : le jour où une règle de comptage se corrige — ce
// qui compte comme une visite, ce qu'on fait d'une réservation annulée — les
// deux écrans doivent bouger ensemble. Deux copies divergent en silence, et
// c'est le genre d'écart qu'on ne découvre qu'en voyant deux chiffres
// différents pour la même campagne.

/** Ce que l'onglet Publicités a besoin de lire.
 *
 *  Isolé dans sa propre fonction, et appelé seulement quand l'onglet est
 *  ouvert : sans cette séparation, afficher les statistiques de visite ferait
 *  aussi charger toutes les campagnes, et l'inverse — deux fois le travail pour
 *  un écran qui n'en montre qu'un. */
export async function chargerCampagnes(
  supabase: SupabaseClient,
  // `bookings` n'est plus lisible par `authenticated` : ses lectures passent
  // par l'admin, où le filtre `washer_id` est la seule barrière entre laveurs.
  admin: SupabaseClient,
  washerId: string,
) {
  let { data: campagnes, error: errCampagnes } = await supabase
    .from('campagnes')
    .select('id, nom, plateforme, budget, cle, debut, fin, budget_maj_le')
    .eq('washer_id', washerId)
    .order('debut', { ascending: false })

  // Colonne absente (migration 009) : on relit sans elle. L'écran perd le
  // « ce montant date de 47 jours », il ne perd pas les campagnes.
  if (errCampagnes && migrationEnAttente(errCampagnes)) {
    const sansDate = await supabase
      .from('campagnes')
      .select('id, nom, plateforme, budget, cle, debut, fin')
      .eq('washer_id', washerId)
      .order('debut', { ascending: false })
    if (!sansDate.error) {
      campagnes = (sansDate.data ?? []).map(c => ({ ...c, budget_maj_le: null }))
      errCampagnes = null
    }
  }

  // Table absente : la fonctionnalité n'est pas en service. On le remonte à
  // l'écran plutôt que d'afficher une liste vide — sinon le laveur remplit un
  // formulaire de campagne qui ne peut pas aboutir, et ne comprend l'échec
  // qu'après avoir tout saisi.
  if (errCampagnes && migrationEnAttente(errCampagnes)) {
    logger.warn('campagnes.migration_en_attente', { washerId })
    return { campagnes: [] as CampagneAffichee[], indisponible: true }
  }

  // Sans trace, une liste vide ne se distinguerait pas d'un laveur sans
  // campagne — et il croirait avoir perdu son travail.
  if (errCampagnes) logger.error('campagnes.list.read_failed', { washerId }, errCampagnes)

  const liste: Campagne[] = (campagnes ?? []).map(c => ({
    id: c.id as string,
    nom: c.nom as string,
    plateforme: c.plateforme as Plateforme,
    // `numeric` revient en chaîne depuis PostgREST : sans cette conversion, le
    // budget serait concaténé au lieu d'être divisé, et tous les retours
    // seraient faux.
    budget: Number(c.budget),
    cle: c.cle as string,
    debut: c.debut as string,
    fin: (c.fin as string | null) ?? null,
    budget_maj_le: (c.budget_maj_le as string | null | undefined) ?? null,
  }))

  if (liste.length === 0) return { campagnes: [] as CampagneAffichee[], indisponible: false }

  // Les créations, s'il y en a. Table absente = migration 008 non exécutée :
  // les campagnes s'affichent quand même, sans le détail par vidéo. Le code
  // peut ainsi partir avant la migration ou après, dans n'importe quel ordre.
  const { data: brutesCreations, error: errCreations } = await supabase
    .from('campagne_creations')
    .select('id, campagne_id, nom, format, cle, budget')
    .eq('washer_id', washerId)
    .order('created_at')

  if (errCreations) logger.warn('campagnes.creations.read_failed', { washerId }, errCreations)

  const creations: Creation[] = (brutesCreations ?? []).map(c => ({
    id: c.id as string,
    campagne_id: c.campagne_id as string,
    nom: c.nom as string,
    format: c.format as Format,
    cle: c.cle as string,
    budget: c.budget === null ? null : Number(c.budget),
  }))

  // On ne lit que ce qui porte une campagne, et jamais avant la plus ancienne
  // d'entre elles : inutile de parcourir un an de trafic organique pour
  // attribuer trois publicités.
  const depuis = liste.reduce((min, c) => (c.debut < min ? c.debut : min), liste[0].debut)

  // `utm_content` peut ne pas exister (migration 008) : on retente sans elle
  // plutôt que de perdre les bilans de campagne, qui eux fonctionnent déjà.
  const visites = await toutesLesLignes((d, f) => supabase
    .from('booking_funnel_events')
    .select('session_id, utm_campaign, utm_content, created_at')
    .eq('washer_id', washerId)
    .not('utm_campaign', 'is', null)
    .gte('created_at', `${depuis}T00:00:00Z`)
    .order('created_at').order('id').range(d, f))

  const visitesSures = visites.error
    ? await toutesLesLignes((d, f) => supabase
        .from('booking_funnel_events')
        .select('session_id, utm_campaign, created_at')
        .eq('washer_id', washerId)
        .not('utm_campaign', 'is', null)
        .gte('created_at', `${depuis}T00:00:00Z`)
        .order('created_at').order('id').range(d, f))
    : visites

  const reservations = await toutesLesLignes((d, f) => admin
    .from('bookings')
    .select('utm_campaign, utm_content, created_at, status, booked_price')
    .eq('washer_id', washerId)
    .not('utm_campaign', 'is', null)
    .gte('created_at', `${depuis}T00:00:00Z`)
    .order('created_at').order('id').range(d, f))

  const reservationsSures = reservations.error
    ? await toutesLesLignes((d, f) => admin
        .from('bookings')
        .select('utm_campaign, created_at, status, booked_price')
        .eq('washer_id', washerId)
        .not('utm_campaign', 'is', null)
        .gte('created_at', `${depuis}T00:00:00Z`)
        .order('created_at').order('id').range(d, f))
    : reservations

  if (visitesSures.error) logger.error('campagnes.visites.read_failed', { washerId }, visitesSures.error)
  if (reservationsSures.error) logger.error('campagnes.reservations.read_failed', { washerId }, reservationsSures.error)

  const lesVisites = visitesSures.data ?? []
  const lesReservations = reservationsSures.data ?? []
  const bilans = bilansParCampagne(liste, lesVisites, lesReservations)

  function assembler(c: Campagne): CampagneAffichee {
    // Un bilan à zéro plutôt qu'aucun : l'écran ne doit pas avoir à gérer le
    // cas d'une campagne qui n'a pas encore reçu une seule visite.
    const bilan = bilans.get(c.id) ?? {
      visites: 0, reservations: 0, tauxConversion: null,
      coutParReservation: null, chiffreAffaires: 0,
      retour: c.budget > 0 ? 0 : null,
    }
    const parCreation = bilansParCreation(c, creations, lesVisites, lesReservations)
    return { ...c, bilan, creations: parCreation, reste: resteHorsCreations(bilan, parCreation) }
  }

  return { campagnes: liste.map(assembler), indisponible: false }
}
