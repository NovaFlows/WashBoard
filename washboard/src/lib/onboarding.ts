// Onboarding des nouveaux inscrits (`/onboarding`) : personnaliser le lien de
// réservation, puis « Comment as-tu connu WashBoard ? ».
//
// `washers.onboarding_complete_at` décide s'il faut le montrer. Les comptes
// antérieurs à sa mise en place ont été remplis à leur date de création : seul
// un compte créé depuis peut avoir NULL.

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'
import { migrationEnAttente } from './migrationEnAttente'

export const SOURCES_ACQUISITION = [
  { valeur: 'instagram', libelle: 'Instagram' },
  { valeur: 'tiktok', libelle: 'TikTok' },
  { valeur: 'google', libelle: 'Google' },
  { valeur: 'recommandation', libelle: 'Recommandation' },
  { valeur: 'autre', libelle: 'Autre' },
] as const

export type SourceAcquisition = (typeof SOURCES_ACQUISITION)[number]['valeur']

export function estSourceAcquisition(v: unknown): v is SourceAcquisition {
  return SOURCES_ACQUISITION.some(s => s.valeur === v)
}

export type Destination = '/onboarding' | '/dashboard'

/** Sans fiche, le tableau de bord sait quoi faire (session orpheline → déconnexion) :
 *  l'onboarding n'aurait rien à personnaliser. */
export function destinationSelonFiche(fiche: { onboarding_complete_at?: string | null } | null): Destination {
  if (!fiche) return '/dashboard'
  return fiche.onboarding_complete_at ? '/dashboard' : '/onboarding'
}

export type EtatOnboarding = { destination: Destination; slug: string | null }

/** Où envoyer un laveur qui vient de se connecter, et son lien actuel.
 *
 *  Une lecture ratée mène au tableau de bord : l'onboarding n'ouvre aucun droit,
 *  et bloquer l'accès au compte pour une question marketing serait pire que de
 *  la sauter. L'erreur est tracée — avant l'exécution du SQL, la colonne manque
 *  et chaque connexion passe ici : averti, pas alerte. */
export async function etatOnboarding(db: SupabaseClient, userId: string): Promise<EtatOnboarding> {
  const { data, error } = await db
    .from('washers')
    .select('slug, onboarding_complete_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    if (migrationEnAttente(error)) logger.warn('onboarding.gate.migration_en_attente', { userId })
    else logger.error('onboarding.gate.read_failed', { userId }, error)
    return { destination: '/dashboard', slug: null }
  }
  return { destination: destinationSelonFiche(data), slug: data?.slug ?? null }
}
