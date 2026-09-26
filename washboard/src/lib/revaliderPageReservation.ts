import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'

// La page de réservation publique est mise en cache (voir `revalidate` dans
// `app/(public)/book/[slug]/page.tsx`). Sans rien d'autre, un laveur qui change
// son prix attendrait la fin de la fenêtre avant de le voir en ligne — et
// croirait que l'enregistrement n'a pas marché.
//
// Chaque route qui modifie ce qu'affiche cette page appelle donc cette
// fonction : le laveur recharge son lien et voit sa modification tout de suite.
// La fenêtre de cache ne sert plus alors que de filet, pour ce qui change sans
// qu'aucune route ne soit appelée — l'expiration d'un abonnement, par exemple.

/** Vide le cache de la page de réservation d'un laveur.
 *
 *  Sans effet si le slug est inconnu : mieux vaut servir une page de quelques
 *  minutes que faire échouer l'enregistrement du laveur. La fenêtre de
 *  revalidation rattrape de toute façon.
 *
 *  @param contexte nom de l'appelant, pour retrouver l'origine dans les
 *                  journaux quand une page reste obstinément périmée. */
export function revaliderPageReservation(slug: string | null | undefined, contexte: string): void {
  if (!slug) {
    logger.warn('revalidation.slug_absent', { contexte })
    return
  }
  try {
    revalidatePath(`/book/${slug}`)
  } catch (e) {
    // `revalidatePath` exige un contexte de requête Next. Hors de ce contexte
    // (tests, script), il lève — et ce n'est jamais une raison de faire échouer
    // l'écriture qui vient d'aboutir.
    logger.warn('revalidation.echec', { contexte, slug }, e)
  }
}
