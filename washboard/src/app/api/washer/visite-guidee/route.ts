import { NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { marquerUneFois } from '@/lib/marquerUneFois'

// Fin de la visite guidée du tableau de bord, au dernier arrêt (« Terminé »).
// Le laveur ne voit pas la réponse — la visite a déjà disparu de son écran :
// seul compte que l'échec soit tracé.
export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const r = await marquerUneFois(supabase, user.id, 'dashboard_tour_complete_at')
  if (r.ok) return NextResponse.json({ success: true })

  const evenement = r.cause === 'ecriture' ? 'washer.visite_guidee.db' : 'washer.visite_guidee.non_enregistre'
  return errorResponse(evenement, r.erreur, { userId: user.id })
}

// « Revoir le tuto » (Guide) : efface la date, pour que le prochain chargement
// de `/dashboard` la relance au lieu de la dire « déjà faite ». Pas de garde
// « une seule fois » ici (contrairement à `marquerUneFois`) : remettre NULL
// deux fois de suite ne fait rien de plus que la première.
export async function DELETE() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase
    .from('washers')
    .update({ dashboard_tour_complete_at: null })
    .eq('user_id', user.id)

  if (error) {
    logger.error('washer.visite_guidee.redemarrer.db', { userId: user.id }, error)
    return errorResponse('washer.visite_guidee.redemarrer.db', error, { userId: user.id })
  }
  return NextResponse.json({ success: true })
}
