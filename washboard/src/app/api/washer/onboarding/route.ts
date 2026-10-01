import { NextRequest, NextResponse } from 'next/server'
import { AppError, errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { estSourceAcquisition } from '@/lib/onboarding'

// Dernière étape de l'onboarding : la source d'acquisition, et l'onboarding
// marqué terminé. Posé une seule fois — un double clic ou un retour arrière ne
// réécrit ni la date ni la réponse.
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  const source = corps?.acquisition_source
  if (!estSourceAcquisition(source)) {
    return NextResponse.json({ error: 'Choisis une réponse dans la liste.' }, { status: 400 })
  }

  const { data: misesAJour, error } = await supabase
    .from('washers')
    .update({ acquisition_source: source, onboarding_complete_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('onboarding_complete_at', null)
    .select('id')

  if (error) return errorResponse('washer.onboarding.db', error, { userId: user.id })

  // Aucune ligne touchée : soit l'onboarding était déjà terminé (double envoi),
  // soit l'écriture a été écartée sans erreur — une policy RLS filtre les lignes
  // au lieu de refuser. Dans ce second cas, l'onboarding reviendrait à chaque
  // connexion sans que rien ne le signale.
  if (!misesAJour?.length) {
    const { data: fiche, error: erreurLecture } = await supabase
      .from('washers')
      .select('onboarding_complete_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (erreurLecture || !fiche?.onboarding_complete_at) {
      return errorResponse(
        'washer.onboarding.non_enregistre',
        new AppError(erreurLecture?.message ?? 'aucune ligne mise à jour', {
          status: 500,
          publicMessage: 'Ta réponse n’a pas pu être enregistrée. Réessaie dans un instant.',
        }),
        { userId: user.id },
      )
    }
  }

  return NextResponse.json({ success: true })
}
