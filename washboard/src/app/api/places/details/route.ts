import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleMaps } from '@/lib/googleMaps'

type Reponse = {
  status?: string
  error_message?: string
  result?: { geometry?: { location?: { lat: number; lng: number } } }
}

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('placeId')
  if (!placeId) return NextResponse.json({ error: 'Missing placeId' }, { status: 400 })

  // Même jeton que l'autocomplétion : c'est ce qui clôt la session côté Google
  // et fait facturer la saisie entière comme une seule unité.
  const session = req.nextUrl.searchParams.get('session')

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}&fields=geometry` +
    (session ? `&sessiontoken=${encodeURIComponent(session)}` : '')

  const data = await fetchGoogleMaps<Reponse>(url, 'places.details')
  const loc = data?.result?.geometry?.location
  if (!loc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ lat: loc.lat, lng: loc.lng })
}
