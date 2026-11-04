import type { CentreAutoPublic } from '@/lib/centreAuto'

// Message d'information d'une prestation (`services.lieu_adapte`), activé par le laveur
// qui lave chez le client. Texte fixe, identique pour tous : le laveur ne le rédige pas.
export const MESSAGE_LIEU_ADAPTE = 'Le lavage doit être effectué dans un lieu adapté.'

/** Le client vient-il au local du laveur ? Le lieu se choisit à l'étape suivante : tant qu'il
 *  n'est pas connu, seul un centre « sans domicile » l'impose. */
export function estAuCentre(centre: CentreAutoPublic | null | undefined, lieu: 'domicile' | 'centre' | null | undefined): boolean {
  return lieu === 'centre' || (!!centre && !centre.domicile)
}

/** La mention s'affiche si le laveur l'a activée, sauf au centre auto (le local est le lieu adapté). */
export function afficherMentionLieuAdapte(service: { lieu_adapte?: boolean }, auCentre: boolean): boolean {
  return service.lieu_adapte === true && !auCentre
}
