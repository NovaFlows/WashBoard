import { isPwaStandalone } from '@/lib/pwaStandalone'

// Quel design afficher dans l'espace laveur : mobile (la refonte v2, barre du bas) ou
// ordinateur (v1, menu latéral). Décision d'Alexandre, 2026-10-09 : on ne parle plus
// de « design site » et « design PWA » mais de design mobile et design ordinateur.
// Un téléphone qui ouvre le site dans son navigateur et se connecte reçoit donc le
// même design que l'application installée.
//
// Téléphone = écran étroit, ou téléphone tenu à l'horizontale (écran tactile peu haut).
// Une tablette, un ordinateur ou une fenêtre large gardent le design ordinateur.
// L'application installée reste toujours en design mobile, quelle que soit sa taille.
//
// À ne pas confondre avec `isPwaStandalone` : notifications, invitation à installer,
// couleur de la barre d'état et bouton retour de l'aperçu dépendent de l'installation,
// pas du design.
export const REQUETE_ECRAN_MOBILE = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)'

export function isDesignMobile(): boolean {
  if (isPwaStandalone()) return true
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(REQUETE_ECRAN_MOBILE).matches
  } catch {
    return false
  }
}
