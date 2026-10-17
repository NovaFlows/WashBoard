import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fideliteActive, jetonValide, phraseCarte } from '@/lib/fidelite'
import { etatDuClient } from '@/lib/fideliteServeur'

// Où en est la carte de fidélité derrière ce jeton — pour le rappel affiché sur la page de
// réservation quand le client revient (`RappelFidelite`). Public : le jeton imprévisible
// tient lieu d'accès, et la réponse ne contient aucune donnée personnelle.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  if (!jetonValide(jeton)) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })
  const admin = createAdminClient()

  const { data: carte } = await admin.from('fidelite_cartes').select('washer_id, cle, ajustement').eq('jeton', jeton).maybeSingle()
  if (!carte) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })
  const { data: laveur } = await admin.from('washers').select('id, fidelite').eq('id', carte.washer_id).maybeSingle()
  const reglages = fideliteActive(laveur?.fidelite)
  if (!laveur || !reglages) return NextResponse.json({ active: false })

  const etat = await etatDuClient(admin, laveur.id, carte.cle as string, reglages.tampons, Number(carte.ajustement ?? 0))
  if (!etat) return NextResponse.json({ active: false })
  return NextResponse.json({ active: true, washerId: laveur.id, ...etat, phrase: phraseCarte(etat, reglages) })
}
