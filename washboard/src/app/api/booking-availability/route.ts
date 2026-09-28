import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { errorResponse } from '@/lib/apiError'
import { toutesLesLignes } from '@/lib/supabase/toutesLesLignes'

// Ce que la page de réservation lisait autrefois côté serveur, à chaque visite.
//
// Pourquoi l'avoir sorti du rendu : les rendez-vous à venir et les congés ne
// servent qu'à l'étape « choisir un créneau ». Or 93 % des visiteurs repartent
// avant (mesure Vercel du 2026-09-25 : 474 pages vues pour 429 visiteurs).
// Tout le monde payait donc la lecture de TOUS les rendez-vous à venir du
// laveur — une liste qui grandit à chaque réservation prise. Le formulaire
// appelle maintenant cette route dès que le visiteur touche la page, bien
// avant d'arriver à l'étape des créneaux : il n'attend pas, et celui qui ne
// touche à rien ne déclenche aucune lecture.
//
// Effet de bord souhaitable : les créneaux sont lus au moment du choix, pas au
// chargement de la page. Un onglet laissé ouvert une heure ne propose plus des
// disponibilités périmées.
//
// Publique et sans session, comme la page qui l'a précédée : la RLS interdit
// ces tables au visiteur (`anon`), la lecture passe donc par le service-role.
// Seules des données NON personnelles sortent d'ici — un horaire et une durée,
// jamais un nom, un email, un téléphone ou une adresse.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const washerId = new URL(request.url).searchParams.get('washer_id')
  if (!washerId || !UUID.test(washerId)) {
    return NextResponse.json({ error: 'Laveur inconnu' }, { status: 400 })
  }

  const admin = createAdminClient()

  const [reservations, conges] = await Promise.all([
    // Page par page : au-delà de 1 000 rendez-vous à venir, l'API couperait
    // sans erreur, et les créneaux des rendez-vous manquants s'afficheraient
    // libres — une double réservation. Voir `toutesLesLignes`.
    toutesLesLignes((debut, fin) => admin
      .from('bookings')
      .select('scheduled_at, vehicle_count, selected_addons, services(duration_minutes)')
      .eq('washer_id', washerId)
      .neq('status', 'cancelled')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .order('id')
      .range(debut, fin)),
    admin
      .from('unavailabilities')
      .select('id, start_date, end_date, team_members_off')
      .eq('washer_id', washerId),
  ])

  // Une lecture en échec ne doit JAMAIS ressortir en liste vide : le
  // formulaire afficherait alors tous les créneaux comme libres et les congés
  // comme travaillés — double réservation et rendez-vous pris pendant les
  // vacances, tous deux déjà vécus en production. On préfère une erreur nette,
  // que le formulaire transforme en « réessayer ».
  if (reservations.error) return errorResponse('booking_availability.bookings', reservations.error, { washerId })
  if (conges.error)       return errorResponse('booking_availability.unavailabilities', conges.error, { washerId })

  return NextResponse.json(
    { bookings: reservations.data, unavailabilities: conges.data ?? [] },
    // Jamais de cache, même une seconde : deux clients sur la même page au
    // même instant doivent voir le créneau disparaître dès qu'il est pris.
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
