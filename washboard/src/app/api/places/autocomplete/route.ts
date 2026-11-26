import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleMaps } from '@/lib/googleMaps'
import { refusSiQuotaMapsDepasse } from '@/lib/publicApiGuard'

type Prediction = { description: string; place_id: string }
type Reponse = { status?: string; error_message?: string; predictions?: Prediction[] }

export async function GET(req: NextRequest) {
  // Chaque appel de cette route coûte de l'argent chez Google : plafond partagé, voir publicApiGuard.
  const refus = refusSiQuotaMapsDepasse(req)
  if (refus) return refus

  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.trim().length < 3) return NextResponse.json({ suggestions: [] })

  // Jeton de session : Google facture alors la saisie entière + le détail final
  // comme UNE unité, au lieu de facturer chaque frappe séparément.
  const session = req.nextUrl.searchParams.get('session')

  // Google n'accepte que 5 pays au plus dans `components` (au-delà : INVALID_REQUEST, donc plus aucune
  // suggestion — panne vue en prod le 2026-11-16 avec 7 pays). Les 5 pays les plus courants d'abord ;
  // si rien n'en sort, un second appel pour les autres (Espagne, Canada) — une seule fois en pratique.
  const GROUPES = ['country:fr|country:be|country:ch|country:lu|country:de', 'country:es|country:ca']
  const appeler = (pays: string) =>
    fetchGoogleMaps<Reponse>(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(q.trim())}&language=fr&components=${pays}` +
        (session ? `&sessiontoken=${encodeURIComponent(session)}` : ''),
      'places.autocomplete',
    )

  let data = await appeler(GROUPES[0])
  if (!data?.predictions?.length) data = (await appeler(GROUPES[1])) ?? data
  const suggestions = (data?.predictions ?? []).map(p => ({
    label: p.description,
    placeId: p.place_id,
  }))

  return NextResponse.json({ suggestions })
}
