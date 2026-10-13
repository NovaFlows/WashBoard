import { NextRequest, NextResponse } from 'next/server'
import { AppError, errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { estSourceAcquisition, nettoyerProfilActivite } from '@/lib/onboarding'
import { logger } from '@/lib/logger'
import { migrationEnAttente } from '@/lib/migrationEnAttente'

// Dernière étape de l'onboarding : la source d'acquisition (facultative), et l'onboarding
// marqué terminé. Posé une seule fois — un double clic ou un retour arrière ne
// réécrit ni la date ni la réponse.
//
// Depuis le 2026-10-13, le même envoi porte aussi les réponses sur l'activité
// (`profil_activite`, étapes 4 et 5). Enregistrées APRÈS, dans une écriture à part :
// un échec (colonne pas encore créée, panne passagère) est tracé mais ne bloque
// jamais l'accès au tableau de bord.
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const corps = await request.json().catch(() => null)
  // Facultative depuis le 2026-10-13 (étape 5) : absente, on termine sans elle ; présente,
  // elle doit rester une réponse de la liste.
  if (!corps || typeof corps !== 'object') {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })
  }
  const source = corps.acquisition_source ?? null
  if (source !== null && !estSourceAcquisition(source)) {
    return NextResponse.json({ error: 'Choisis une réponse dans la liste.' }, { status: 400 })
  }

  const { data: misesAJour, error } = await supabase
    .from('washers')
    .update({
      ...(source ? { acquisition_source: source } : {}),
      onboarding_complete_at: new Date().toISOString(),
    })
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

  const profil = nettoyerProfilActivite(corps?.profil_activite)
  if (Object.keys(profil).length > 0) {
    const { error: erreurProfil } = await supabase
      .from('washers')
      .update({ profil_activite: profil, profil_activite_le: new Date().toISOString() })
      .eq('user_id', user.id)
    if (erreurProfil) {
      if (migrationEnAttente(erreurProfil)) logger.warn('washer.onboarding.profil.migration_en_attente', { userId: user.id })
      else logger.error('washer.onboarding.profil.write_failed', { userId: user.id }, erreurProfil)
    }
  }

  return NextResponse.json({ success: true })
}
