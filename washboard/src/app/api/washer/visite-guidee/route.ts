import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { marquerUneFois } from '@/lib/marquerUneFois'

// Fin de la visite guidée du tableau de bord (« Passer » ou « Terminé »). Le
// laveur ne voit pas la réponse — la visite a déjà disparu de son écran : seul
// compte que l'échec soit tracé.
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const r = await marquerUneFois(supabase, user.id, 'dashboard_tour_complete_at')
  if (r.ok) return NextResponse.json({ success: true })

  const evenement = r.cause === 'ecriture' ? 'washer.visite_guidee.db' : 'washer.visite_guidee.non_enregistre'
  return errorResponse(evenement, r.erreur, { userId: user.id })
}
