// Reconnaître « la migration n'a pas encore tourné » parmi les erreurs de base.
//
// Pourquoi ce fichier existe : quand une table ou une colonne manque, PostgREST
// renvoie une erreur comme une autre, et `errorResponse` la traite comme une
// panne — « Une erreur interne est survenue. », avec un errorId à chercher dans
// les journaux. Le message est faux dans son intention : rien n'est cassé, la
// fonctionnalité n'est simplement pas encore en service.
//
// L'écart coûte cher des deux côtés. Le laveur croit à un bug et écrit au
// support ; l'équipe cherche un défaut là où il n'y en a pas. Une cause connue
// mérite d'être nommée.
//
// Ce qu'on ne fait PAS ici : élargir aux erreurs de droits (RLS, GRANT). Une
// requête refusée ressemble de loin à une table absente, mais c'est une vraie
// anomalie, qui doit rester bruyante.

/** Codes d'erreur qui signifient « ça n'existe pas encore ».
 *
 *  Les `PGRST*` viennent de PostgREST (cache de schéma), les numériques de
 *  PostgreSQL lui-même. Les deux arrivent, selon qu'on lit ou qu'on écrit. */
const CODES = new Set([
  'PGRST204', // colonne absente du cache de schéma (rencontré sur INSERT/UPDATE)
  'PGRST205', // table absente du cache de schéma (rencontré sur SELECT)
  '42P01',    // undefined_table
  '42703',    // undefined_column
])

/** Vrai quand l'erreur dit qu'une table ou une colonne n'existe pas.
 *
 *  Le code d'abord, le message ensuite : un code est stable, un message est
 *  traduit et reformulé au fil des versions. Le repli sur le texte n'est là que
 *  pour les cas où l'erreur remonte sans code exploitable — ce qui arrive. */
export function migrationEnAttente(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown }

  if (typeof e.code === 'string' && CODES.has(e.code)) return true

  if (typeof e.message === 'string') {
    const m = e.message.toLowerCase()
    return /could not find the (table|column)/.test(m)
      || /relation ".*" does not exist/.test(m)
      || /column .* does not exist/.test(m)
  }
  return false
}

/** Ce qu'on dit au laveur, et pas au développeur.
 *
 *  Il ne peut rien faire de « migration 006 non exécutée », et ce n'est pas son
 *  problème. Ce qu'il doit savoir tient en deux points : ce n'est pas cassé, et
 *  ce n'est pas lui. */
export const MESSAGE_EN_ATTENTE =
  'Le suivi des publicités n’est pas encore activé sur votre compte. Rien n’est cassé de votre côté : cette partie attend une dernière mise en service.'
