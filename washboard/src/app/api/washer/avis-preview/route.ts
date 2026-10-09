import { NextResponse } from 'next/server'
import { requireWasher } from '@/lib/requireWasher'
import { reviewsForWasher } from '@/lib/googleReviews'

// Aperçu de ce que « Avis Google » affichera réellement sur la page de
// réservation — demandé par Alexandre après avoir enregistré un identifiant
// invalide (le lien Maps complet collé à la place du Place ID, voir
// api/washer/route.ts) sans que rien ne le dise avant d'aller vérifier la
// page publique lui-même.
//
// Rejoue exactement ce que `reviewsForWasher` ferait pour un visiteur, mais
// réservé au laveur connecté sur SA PROPRE fiche (`requireWasher`) : ouvrir
// cet aperçu à n'importe quel identifiant donné en paramètre aurait fait de
// cette route un proxy gratuit vers l'API Google payante de n'importe qui.
//
// Pas de coût Google supplémentaire en pratique : `reviewsForWasher` met son
// résultat en cache 24 h (même cache que la page publique), donc ce bouton ne
// fait qu'un appel RÉEL par jour et par laveur, que ce soit lui ou un visiteur
// qui le déclenche en premier.

export async function GET() {
  const r = await requireWasher()
  if (!r.ok) return r.response
  const { supabase, washerId } = r.ctx

  const { data: washer, error } = await supabase
    .from('washers')
    .select('website_url, google_place_id')
    .eq('id', washerId)
    .single()

  if (error || !washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const aSource = !!(washer.website_url || washer.google_place_id)
  if (!aSource) return NextResponse.json({ aSource: false, aggregate: null })

  const { aggregate } = await reviewsForWasher({
    website_url: washer.website_url,
    google_place_id: washer.google_place_id,
  })

  return NextResponse.json({ aSource: true, aggregate: aggregate ?? null })
}
