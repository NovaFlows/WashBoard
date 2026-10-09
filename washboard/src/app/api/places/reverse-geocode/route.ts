import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { refusSiQuotaMapsDepasse } from '@/lib/publicApiGuard'

// « Utiliser ma position » sur la page de réservation publique : le navigateur
// donne des coordonnées (geolocation), cette route les retourne en adresse
// lisible pour remplir le champ. Même plafond PARTAGÉ que les quatre autres
// routes Maps publiques (autocomplétion, détail d'un lieu, zone, frais de
// déplacement, créneaux optimisés) — voir publicApiGuard : c'est le budget
// Maps qu'on protège, pas cette route en particulier.

type ReverseGeocodeResult = {
  status?: string
  error_message?: string
  results?: { formatted_address?: string }[]
}

export async function GET(req: NextRequest) {
  const refus = refusSiQuotaMapsDepasse(req)
  if (refus) return refus

  const lat = Number(req.nextUrl.searchParams.get('lat'))
  const lng = Number(req.nextUrl.searchParams.get('lng'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'Coordonnées invalides' }, { status: 400 })
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}&language=fr&result_type=street_address|route`

  const data = await fetchGoogleMaps<ReverseGeocodeResult>(url, 'places.reverse_geocode')
  const adresse = data?.results?.[0]?.formatted_address ?? null

  return NextResponse.json({ address: adresse })
}
