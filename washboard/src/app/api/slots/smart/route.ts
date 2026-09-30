import { NextRequest, NextResponse } from 'next/server'
import { getMapsApiKey } from '@/lib/googleMaps'
import { logger } from '@/lib/logger'
import { createAdminClient } from '@/lib/supabase/admin'
import { addonsDuration } from '@/lib/pricing'
import { refusSiQuotaMapsDepasse } from '@/lib/publicApiGuard'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'
import { derniereLocalisation } from '@/lib/slots'
import { dateStrParis } from '@/lib/dateUtils'

type DmResponse = {
  status: string
  rows: { elements: { status: string; duration: { value: number } }[] }[]
}

export async function GET(request: NextRequest) {
  // Chaque appel de cette route coûte de l'argent chez Google : plafond partagé, voir publicApiGuard.
  const refus = refusSiQuotaMapsDepasse(request)
  if (refus) return refus

  const { searchParams } = new URL(request.url)
  const washerId = searchParams.get('washer_id')
  const address  = searchParams.get('address')
  const date     = searchParams.get('date') // YYYY-MM-DD local date

  const empty = { smartWindows: [], bookingConstraints: [], discountType: 'fixed', discountValue: 0 }

  if (!washerId || !address || !date) return NextResponse.json(empty)

  // Appelée depuis la page de réservation publique, sans session : lecture
  // côté serveur, la table `washers` n'étant plus lisible par la clé publique.
  const supabase = createAdminClient()

  const { data: washer, error: errWasher } = await supabase
    .from('washers')
    .select('smart_slot_enabled, smart_slot_radius_minutes, smart_slot_discount_type, smart_slot_discount_value, reservation_jour_meme, base_address')
    .eq('id', washerId)
    .single()

  if (errWasher) logger.error('slots.smart.washer.read_failed', {}, errWasher)

  const config = {
    discountType:  (washer?.smart_slot_discount_type  ?? 'fixed')  as 'fixed' | 'percent',
    discountValue: (washer?.smart_slot_discount_value ?? 0)        as number,
  }

  // Réservations du même jour (plage UTC couvrant la journée locale France).
  // Lecture via le client admin : un visiteur anonyme n'a aucun droit RLS sur
  // `bookings` (seule la création y est publique), donc le client lié à sa
  // session ne verrait jamais ces lignes — ni créneaux optimisés, ni
  // contrainte de trajet ne se calculeraient, en silence.
  const admin = createAdminClient()
  // Page par page, comme toute lecture de réservations : l'API coupe à 1 000
  // lignes sans erreur (voir `toutesLesLignes`).
  const { data: bookings, error: errBookings } = await toutesLesLignes((debut, fin) => admin
    .from('bookings')
    .select('scheduled_at, address, vehicle_count, selected_addons, services(duration_minutes)')
    .eq('washer_id', washerId)
    .neq('status', 'cancelled')
    .gte('scheduled_at', new Date(`${date}T00:00:00`).toISOString())
    .lte('scheduled_at', new Date(`${date}T23:59:59`).toISOString())
    .order('scheduled_at')
    .order('id')
    .range(debut, fin))
  if (errBookings) logger.error('slots.smart.bookings.read_failed', {}, errBookings)

  const bookingsAujourdhui = bookings ?? []

  const dureeBooking = (b: { services: unknown; selected_addons: unknown; vehicle_count: number | null }) => {
    const svc    = b.services as unknown as { duration_minutes: number } | null
    const addons = (b.selected_addons as { duration_minutes?: number }[] | null) ?? []
    return ((svc?.duration_minutes ?? 60) + addonsDuration(addons)) * Math.max(1, (b.vehicle_count ?? 1))
  }

  // Réservation le jour même : le PREMIER créneau proposé ne vaut que si le
  // laveur peut matériellement l'atteindre depuis là où il se trouve — son
  // dernier rendez-vous déjà terminé aujourd'hui, ou son adresse de départ
  // s'il n'a encore rien fait. Calculé uniquement quand la date demandée est
  // aujourd'hui : un jour futur n'a jamais ce problème, et le vérifier pour
  // rien coûterait un appel Google de plus par visite.
  const origineJourMeme = (washer?.reservation_jour_meme && date === dateStrParis())
    ? derniereLocalisation(
        bookingsAujourdhui.map(b => ({ scheduled_at: b.scheduled_at, durationMin: dureeBooking(b), address: b.address })),
        Date.now(),
        washer.base_address ?? null,
      )
    : null

  // Rien à calculer : ni RDV ce jour, ni position de départ à vérifier.
  if (!bookingsAujourdhui.length && !origineJourMeme) return NextResponse.json({ ...empty, ...config })

  const apiKey = getMapsApiKey()
  if (!apiKey) {
    logger.error('slots.smart.no_api_key', {})
    return NextResponse.json({ ...empty, ...config })
  }

  // Adresses « origine » : les RDV du jour, puis — s'il y en a une — la
  // position de départ pour le jour même, toujours en DERNIER : son index
  // dans le lot (bookingsAujourdhui.length) sert à la retrouver après coup.
  const adressesOrigine = [
    ...bookingsAujourdhui.map(b => b.address),
    ...(origineJourMeme ? [origineJourMeme.address] : []),
  ]
  const bookingAddrs = adressesOrigine.map(encodeURIComponent).join('|')
  const newAddr      = encodeURIComponent(address)
  const base         = `https://maps.googleapis.com/maps/api/distancematrix/json?mode=driving&key=${apiKey}`

  // 2 appels en parallèle : bookings→client ET client→bookings
  let dmToNew: DmResponse, dmFromNew: DmResponse
  try {
    const [r1, r2] = await Promise.all([
      fetch(`${base}&origins=${bookingAddrs}&destinations=${newAddr}`),
      fetch(`${base}&origins=${newAddr}&destinations=${bookingAddrs}`),
    ])
    ;[dmToNew, dmFromNew] = await Promise.all([r1.json(), r2.json()])
  } catch (e) {
    // Sans distances, on renvoie « aucune contrainte » plutot que de bloquer
    // la reservation — mais la panne doit se voir.
    logger.error('slots.smart.distance_matrix_failed', {}, e)
    return NextResponse.json({ ...empty, ...config })
  }

  if (dmToNew.status !== 'OK' || dmFromNew.status !== 'OK') {
    // Statut Google non-OK (REQUEST_DENIED, INVALID_REQUEST, OVER_QUERY_LIMIT…) :
    // ce n'est pas une absence de résultat, c'est une panne — elle doit se voir.
    logger.error('slots.smart.google_status_not_ok', {
      statusToNew: dmToNew.status,
      statusFromNew: dmFromNew.status,
    })
    return NextResponse.json({ ...empty, ...config })
  }

  // Contraintes de trajet — toujours calculées (indépendant des smart slots)
  // La durée effective tient compte du vehicle_count (90 min × 2 véhicules = 180 min occupés)
  const bookingConstraints = bookingsAujourdhui.map((b, i) => {
    const durationMin = dureeBooking(b)
    const bStart       = new Date(b.scheduled_at).getTime()
    const bEnd         = bStart + durationMin * 60_000
    const toNew        = dmToNew.rows[i]?.elements[0]
    const fromNew      = dmFromNew.rows[0]?.elements[i]
    return {
      start:         new Date(bStart).toISOString(),
      end:           new Date(bEnd).toISOString(),
      travelToNew:   toNew?.status   === 'OK' ? toNew.duration.value   : 0, // secondes
      travelFromNew: fromNew?.status === 'OK' ? fromNew.duration.value : 0, // secondes
    }
  })

  // Contrainte synthétique de la position de départ pour le jour même : un
  // « rendez-vous » qui aurait commencé avant l'aube et durerait jusqu'à
  // maintenant. `start` volontairement très ancien (epoch) plutôt que de ne
  // poser qu'un `end` : ça rend la branche « RDV après » de `isSlotFeasible`
  // structurellement inatteignable pour cette contrainte, donc un horaire
  // déjà passé aujourd'hui reste rejeté — jamais validé par erreur au motif
  // qu'un trajet depuis le futur « rentrerait ».
  if (origineJourMeme) {
    const idx   = bookingsAujourdhui.length // dernier élément du lot, voir adressesOrigine
    const toNew = dmToNew.rows[idx]?.elements[0]
    if (toNew?.status === 'OK') {
      bookingConstraints.push({
        start: new Date(0).toISOString(),
        end:   new Date().toISOString(),
        travelToNew:   toNew.duration.value,
        travelFromNew: 0,
      })
    } else {
      logger.error('slots.smart.jour_meme.trajet_introuvable', { washerId, adresse: origineJourMeme.address })
    }
  }

  // Créneaux intelligents — uniquement si le laveur a activé la fonctionnalité
  const WINDOW_MIN = 90
  const smartWindows: { start: string; end: string }[] = []

  if (washer?.smart_slot_enabled) {
    const radiusSeconds = (washer.smart_slot_radius_minutes ?? 15) * 60
    for (let i = 0; i < bookingsAujourdhui.length; i++) {
      const toNew = dmToNew.rows[i]?.elements[0]
      if (toNew?.status !== 'OK' || toNew.duration.value > radiusSeconds) continue
      const durationMin = dureeBooking(bookingsAujourdhui[i])
      const bStart      = new Date(bookingsAujourdhui[i].scheduled_at).getTime()
      const bEnd        = bStart + durationMin * 60_000
      smartWindows.push({
        start: new Date(bStart - WINDOW_MIN * 60_000).toISOString(),
        end:   new Date(bEnd   + WINDOW_MIN * 60_000).toISOString(),
      })
    }
  }

  return NextResponse.json({
    smartWindows,
    bookingConstraints,
    discountType:  config.discountType,
    discountValue: config.discountValue,
  })
}
