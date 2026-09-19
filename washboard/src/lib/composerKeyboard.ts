// Entrée envoie, Maj+Entrée fait un saut de ligne — dans les deux champs de
// saisie du canal support (laveur et équipe). Mais uniquement quand un clavier
// physique est probable : un clavier tactile n'a pas de Maj utilisable pour
// ça, Entrée doit donc y rester un saut de ligne, comportement par défaut du
// navigateur qu'on se contente de ne pas court-circuiter.
//
// La détection se fait sur la finesse du pointeur (`pointer: coarse`), pas sur
// la taille d'écran : une tablette avec clavier Bluetooth garde un pointeur
// tactile mais mérite quand même Entrée pour envoyer si son navigateur expose
// un pointeur fin (rare, mais rien n'empêche de rester correct dans ce cas).

export type ComposerKeyEvent = {
  key: string
  shiftKey: boolean
  nativeEvent?: { isComposing?: boolean }
}

/** Vrai si cet appui doit déclencher l'envoi plutôt qu'un saut de ligne. */
export function shouldSendOnEnter(e: ComposerKeyEvent, clavierTactile: boolean): boolean {
  if (clavierTactile) return false
  if (e.key !== 'Enter' || e.shiftKey) return false
  // Validation d'une saisie IME (ex. composition d'un caractère japonais) :
  // cet Entrée-là confirme le caractère, il n'est pas destiné au formulaire.
  if (e.nativeEvent?.isComposing) return false
  return true
}

/** Absence de `window` ou de `matchMedia` (SSR, navigateur ancien) ⇒ on
 *  suppose un clavier physique, pour ne jamais priver quelqu'un sur
 *  ordinateur d'Entrée pour envoyer. */
export function estClavierTactile(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches
}
