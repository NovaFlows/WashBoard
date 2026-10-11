import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { marquerUneFois } from '@/lib/marquerUneFois'
import { COLONNE_TUTO, estAppareil } from '@/lib/visiteGuidee'

// Fin d'un tuto — au dernier arrêt (« Terminé ») ou à n'importe quel arrêt (« Passer »,
// depuis le 2026-10-10 : les deux ferment le tuto pour de bon, il ne doit pas se
// redéclencher tout seul en revenant sur « Aujourd'hui »). Un tuto par design
// (`?appareil=mobile|ordinateur`, 2026-10-11) : finir l'un ne touche pas l'autre.
// Le laveur ne voit pas la réponse — le tuto a déjà disparu de son écran : seul compte
// que l'échec soit tracé.
function appareilDe(request: NextRequest) {
  const appareil = request.nextUrl.searchParams.get('appareil')
  return estAppareil(appareil) ? appareil : null
}

export async function POST(request: NextRequest) {
  const appareil = appareilDe(request)
  if (!appareil) return NextResponse.json({ error: 'Appareil inconnu' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const r = await marquerUneFois(supabase, user.id, COLONNE_TUTO[appareil])
  if (r.ok) return NextResponse.json({ success: true })

  const evenement = r.cause === 'ecriture' ? 'washer.visite_guidee.db' : 'washer.visite_guidee.non_enregistre'
  return errorResponse(evenement, r.erreur, { userId: user.id, appareil })
}

// « Revoir le tuto » (Guide) : efface la date du tuto de CET appareil, pour que le
// prochain chargement de `/dashboard` le relance. Remettre NULL deux fois de suite ne
// fait rien de plus que la première.
export async function DELETE(request: NextRequest) {
  const appareil = appareilDe(request)
  if (!appareil) return NextResponse.json({ error: 'Appareil inconnu' }, { status: 400 })

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase
    .from('washers')
    .update({ [COLONNE_TUTO[appareil]]: null })
    .eq('user_id', user.id)

  if (error) {
    logger.error('washer.visite_guidee.redemarrer.db', { userId: user.id, appareil }, error)
    return errorResponse('washer.visite_guidee.redemarrer.db', error, { userId: user.id, appareil })
  }
  return NextResponse.json({ success: true })
}
