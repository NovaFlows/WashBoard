// Le lien public de réservation (`washers.slug`) : sa fabrication à partir d'un
// nom, son format accepté et son unicité. Une seule définition, partagée par
// l'inscription, la modification du profil (`PATCH /api/washer`), l'écran
// « Mes liens » et l'onboarding — sans quoi les règles finiraient par diverger.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Nom d'entreprise → base de lien (« Kooki Clean » → « kooki-clean »). */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

/** 3 à 40 caractères, minuscules, chiffres et tirets, jamais de tiret au début ni à la fin. */
const FORMAT_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/

export const PHRASE_SLUG_INVALIDE =
  '3 à 40 caractères : minuscules, chiffres et tirets (pas au début ni à la fin).'

export function slugValide(slug: string): boolean {
  return FORMAT_SLUG.test(slug)
}

export type DisponibiliteSlug = { ok: true; libre: boolean } | { ok: false; erreur: unknown }

/** Le lien est-il libre pour ce compte ? Un lien qui lui appartient déjà l'est.
 *
 *  `db` doit voir toutes les fiches (client admin) : sous la session du laveur,
 *  la RLS ne montre que la sienne et tout lien paraîtrait libre.
 *
 *  Le propriétaire est comparé ici plutôt qu'avec un `.neq()` : une fiche sans
 *  `user_id` (les toutes premières, créées à la main, et les aperçus prospects)
 *  ne serait jamais renvoyée par un `<>` SQL, NULL ne se comparant à rien. */
export async function slugLibre(db: SupabaseClient, slug: string, userId: string): Promise<DisponibiliteSlug> {
  const { data, error } = await db.from('washers').select('id, user_id').eq('slug', slug).maybeSingle()
  if (error) return { ok: false, erreur: error }
  return { ok: true, libre: !data || data.user_id === userId }
}
