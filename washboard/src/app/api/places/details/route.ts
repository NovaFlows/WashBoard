import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('placeId')
  if (!placeId) return NextResponse.json({ error: 'Missing placeId' }, { status: 400 })

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return NextResponse.json({ error: 'No API key' }, { status: 500 })

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${key}`

  try {
    const res  = await fetch(url)
    const data = await res.json()
    const loc  = data.result?.geometry?.location
    if (!loc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ lat: loc.lat as number, lng: loc.lng as number })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
