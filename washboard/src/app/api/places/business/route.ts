import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { createClient } from '@/lib/supabase/server'

// Recherche de l'établissement Google d'un laveur, pour relier sa fiche et
// afficher ses avis sur sa page de réservation.
//
// Distincte de `places/autocomplete`, qui cherche des ADRESSES : ici on veut
// des commerces, avec leur note et leur nombre d'avis pour que le laveur
// reconnaisse sa fiche sans hésiter — plusieurs établissements peuvent porter
// un nom voisin à la même adresse.

type Result = {
  place_id?: string
  name?: string
  formatted_address?: string
  rating?: number
  user_ratings_total?: number
}
type Reponse = { status?: string; error_message?: string; results?: Result[] }

export async function GET(req: NextRequest) {
  // Route réservée aux laveurs connectés : elle consomme du quota Google
  // facturé, elle n'a pas à être appelable par n'importe qui.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Mode vérification : confirme qu'une fiche déjà reliée répond bien et
  // combien d'avis elle expose. Sans cela, l'écran affichait « Fiche Google
  // reliée » pour un identifiant invalide, et le laveur croyait ses avis
  // publiés alors que la page retombait en silence sur son site.
  const verifier = req.nextUrl.searchParams.get('verify')
  if (verifier) {
    const { fetchGooglePlaceReviews } = await import('@/lib/googleReviews')
    const r = await fetchGooglePlaceReviews(verifier)
    return NextResponse.json({
      ok: r.reviews.length > 0 || !!r.aggregate,
      reviewCount: r.reviews.length,
      aggregate: r.aggregate ?? null,
    })
  }

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 3) return NextResponse.json({ results: [] })

  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json' +
    `?query=${encodeURIComponent(q.trim())}` +
    '&region=fr&language=fr'

  const data = await fetchGoogleMaps<Reponse>(url, 'places.business_search')

  const results = (data?.results ?? []).slice(0, 6).map(r => ({
    placeId: r.place_id ?? '',
    name: r.name ?? '',
    address: r.formatted_address ?? '',
    rating: typeof r.rating === 'number' ? r.rating : null,
    reviewCount: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
  })).filter(r => r.placeId)

  return NextResponse.json({ results })
}
