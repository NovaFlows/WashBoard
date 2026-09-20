// Réglages et petite logique pure du masquage réversible côté équipe (« fils
// archivés » de la boîte de réception, SupportInbox.tsx) — bouton sur
// ordinateur, glissement vers la gauche sur téléphone, contrat livré par
// `dev` sur PATCH /api/support/team-questions/[id] ({ hidden: true|false }).
//
// Le geste lui-même (React, glissement tactile) vit dans SupportInbox.tsx et
// n'est pas testable ici (environnement `node`, sans DOM — voir
// vitest.config.ts). Mais la DÉCISION « ce relâchement de glissement vaut-il
// archivage ? » ne dépend d'aucun DOM : elle est isolée ici pour être
// prouvée sans simuler un doigt sur un écran.

/** Délai pendant lequel un archivage reste annulable avant d'être vraiment
 *  écrit en base (voir SupportInbox.tsx, `confirmerArchivage`) — le fil
 *  disparaît de la boîte tout de suite, mais rien n'est envoyé au serveur
 *  avant l'écoulement de ce délai. Ni trop court (un geste accidentel doit
 *  laisser le temps de réagir), ni trop long (le fil resterait affiché comme
 *  déjà rangé alors que rien n'est encore acquis). */
export const DELAI_ANNULATION_ARCHIVAGE_MS = 6000

/** Distance de glissement (px, négative = vers la gauche) à partir de
 *  laquelle un relâchement lent vaut archivage — au-delà, revenir en place
 *  surprendrait plus que continuer le geste jusqu'à son terme visuel. */
export const SEUIL_GLISSEMENT_ARCHIVAGE_PX = -88

/** Vitesse de relâchement (px/s, négative = vers la gauche) à partir de
 *  laquelle un glissement rapide et bref (« flick ») vaut archivage même sans
 *  avoir atteint le seuil de distance — un geste net est une intention aussi
 *  claire qu'un glissement mené lentement jusqu'au bout. */
export const SEUIL_VITESSE_ARCHIVAGE_PX_S = -600

/** Un flick ne compte que si le doigt a réellement quitté sa position de
 *  départ vers la gauche — sinon un relâchement rapide sur place (tap nerveux,
 *  tremblement) pourrait valider un archivage sans aucun geste perceptible. */
const DISTANCE_MINIMALE_POUR_FLICK_PX = -10

/** Vrai si ce relâchement de glissement doit déclencher l'archivage du fil.
 *  Deux façons d'y arriver, l'une n'excluant pas l'autre : glisser lentement
 *  jusqu'au seuil de distance, ou lâcher rapidement (flick) après un début de
 *  mouvement franc vers la gauche. */
export function estUnGlissementDArchivage(distancePx: number, vitessePxParSeconde: number): boolean {
  if (distancePx <= SEUIL_GLISSEMENT_ARCHIVAGE_PX) return true
  return distancePx <= DISTANCE_MINIMALE_POUR_FLICK_PX && vitessePxParSeconde <= SEUIL_VITESSE_ARCHIVAGE_PX_S
}
