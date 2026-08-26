import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleMaps } from '@/lib/googleMaps'

type Prediction = { description: string; place_id: string }
type Reponse = { status?: string; error_message?: string; predictions?: Prediction[] }

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 3) return NextResponse.json({ suggestions: [] })

  // Jeton de session : Google facture alors la saisie entière + le détail final
  // comme UNE unité, au lieu de facturer chaque frappe séparément.
  const session = req.nextUrl.searchParams.get('session')

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
    `?input=${encodeURIComponent(q.trim())}&language=fr&components=country:fr|country:be` +
    (session ? `&sessiontoken=${encodeURIComponent(session)}` : '')

  const data = await fetchGoogleMaps<Reponse>(url, 'places.autocomplete')
  const suggestions = (data?.predictions ?? []).map(p => ({
    label: p.description,
    placeId: p.place_id,
  }))

  return NextResponse.json({ suggestions })
}
