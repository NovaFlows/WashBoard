import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 3) return NextResponse.json({ suggestions: [] })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return NextResponse.json({ suggestions: [] })

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q.trim())}&language=fr&components=country:fr|country:be&key=${key}`

  try {
    const res  = await fetch(url)
    const data = await res.json()
    const suggestions = (data.predictions ?? []).map((p: { description: string; place_id: string }) => ({
      label:   p.description,
      placeId: p.place_id,
    }))
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
