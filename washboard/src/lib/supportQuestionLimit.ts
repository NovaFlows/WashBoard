// Plafond de fils NON RÉSOLUS ouverts simultanément par laveur, sur
// `POST /api/support/questions`.
//
// Sans lui, chaque création déclenche `notifierEquipe` (voir push.ts) : un
// compte laveur compromis, ou simplement quelqu'un d'agacé, peut noyer le
// téléphone de l'équipe et remplir la base sans qu'aucune autre protection ne
// s'y oppose (relevé par cyber avant mise en ligne).
//
// Pourquoi un compte en base plutôt que `lib/rateLimit.ts` : ce module borne
// des CRÉATIONS dans une fenêtre de temps glissante, et redescend tout seul
// une fois la fenêtre passée — même si le laveur n'a toujours rien résolu.
// Ici on veut borner un ÉTAT (le nombre de fils encore ouverts), qui se
// libère de lui-même quand l'équipe résout une question : un laveur qui
// enchaîne plusieurs vrais soucis peut continuer à échanger sur ceux déjà
// ouverts, seule l'ouverture d'un ONZIÈME fil est refusée. `rateLimit.ts` est
// de toute façon en mémoire, non partagé entre instances serverless (déjà
// documenté dans le TODO) : un compteur lu en base à chaque décision n'a pas
// ce défaut, quelle que soit l'instance qui répond à la requête.
//
// 10 laisse une large marge à une vraie mauvaise semaine (facturation,
// calendrier, un client mécontent, en parallèle) sans jamais être un plafond
// qu'un usage honnête frôle. Au-delà, ce n'est plus un empilement normal de
// soucis : soit un compte compromis, soit quelqu'un qu'il faut appeler
// autrement qu'en lui laissant ouvrir un onzième fil.
export const MAX_QUESTIONS_OUVERTES_PAR_LAVEUR = 10

export const MESSAGE_LIMITE_QUESTIONS_ATTEINTE =
  'Vous avez déjà plusieurs questions en attente de réponse. Attendez qu’on vous réponde, ou répondez dans un fil existant, avant d’en ouvrir un nouveau.'

/** Refuse l'ouverture d'un nouveau fil au-delà du plafond de fils NON
 *  RÉSOLUS. `nombreQuestionsOuvertes` doit venir d'une lecture réussie : une
 *  lecture en échec ne doit jamais être traitée par l'appelant comme « zéro
 *  fil ouvert », sous peine de rendre ce garde-fou inopérant pendant un
 *  incident de base de données — exactement quand un abus est le plus
 *  probable de passer inaperçu. */
export function peutOuvrirNouvelleQuestion(
  nombreQuestionsOuvertes: number,
  plafond: number = MAX_QUESTIONS_OUVERTES_PAR_LAVEUR,
): boolean {
  return nombreQuestionsOuvertes < plafond
}
