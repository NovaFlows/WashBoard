// Chargement du Pixel Meta et envoi de ses événements.
//
// Tout ici part du même principe : RIEN ne se charge tant que personne n'a
// accepté. Le script de Facebook n'est pas seulement inactif avant le clic —
// il n'est pas présent dans la page. C'est la seule façon de garantir qu'aucun
// cookie tiers n'est déposé, puisqu'un script chargé en dépose à l'instant où
// il s'exécute, bien avant qu'on lui demande quoi que ce soit.
//
// L'état vit dans le module plutôt que dans un contexte React : le formulaire
// de réservation peut alors signaler un événement sans savoir si le Pixel
// existe, et sans qu'on ait à faire descendre une information de consentement
// à travers cinq composants. Quand rien n'est chargé, l'appel ne fait rien.

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; callMethod?: unknown }
    _fbq?: unknown
  }
}

const ID_SCRIPT = 'wb-meta-pixel'

/** L'identifiant réellement chargé, ou `null`. Sert de garde-fou : deux appels
 *  n'initialisent jamais deux fois le même Pixel, ce qui doublerait chaque
 *  événement et donc chaque conversion remontée à Meta. */
let pixelActif: string | null = null

export function pixelCharge(): boolean {
  return pixelActif !== null
}

/** Injecte le script de Meta et déclenche la première vue.
 *
 *  À n'appeler QU'APRÈS un consentement explicite. La fonction ne vérifie pas
 *  le consentement elle-même : ce n'est pas son rôle, et un garde-fou dupliqué
 *  à deux endroits finit toujours par diverger. C'est `peutChargerPixel`
 *  (consentement.ts) qui décide, et cette fonction qui exécute. */
export function chargerPixel(pixelId: string): void {
  if (typeof window === 'undefined' || !pixelId) return
  if (pixelActif === pixelId) return

  // Le fragment officiel de Meta, écrit à la main pour rester lisible : il
  // crée une file d'attente pour que les événements envoyés avant l'arrivée du
  // script ne soient pas perdus.
  if (!window.fbq) {
    const f = function (...args: unknown[]) {
      const q = f as unknown as { callMethod?: (...a: unknown[]) => void; queue: unknown[] }
      if (q.callMethod) q.callMethod(...args)
      else q.queue.push(args)
    } as Window['fbq'] & { queue: unknown[] }
    f.queue = []
    f.loaded = true
    f.version = '2.0'
    window.fbq = f
    window._fbq = f
  }

  if (!document.getElementById(ID_SCRIPT)) {
    const script = document.createElement('script')
    script.id = ID_SCRIPT
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }

  window.fbq?.('init', pixelId)
  window.fbq?.('track', 'PageView')
  pixelActif = pixelId
}

/** Retire le Pixel de la page.
 *
 *  Appelé quand le visiteur revient sur son accord depuis « Gérer mes
 *  cookies ». Le script ne peut pas être « déchargé » au sens strict — il est
 *  déjà exécuté — mais on cesse immédiatement d'émettre, on retire la balise,
 *  et le rechargement de la page repart d'une feuille blanche. Sans cela, un
 *  visiteur qui retire son accord continuerait d'alimenter Meta jusqu'à ce
 *  qu'il ferme l'onglet. */
export function retirerPixel(): void {
  if (typeof window === 'undefined') return
  pixelActif = null
  document.getElementById(ID_SCRIPT)?.remove()
  // On neutralise la fonction plutôt que de la supprimer : du code déjà en vol
  // peut encore l'appeler, et la supprimer lèverait une exception dans la page
  // du laveur.
  if (window.fbq) window.fbq = (() => {}) as Window['fbq']
}

/** Les trois seuls événements qu'on envoie.
 *
 *  Trois, et pas la douzaine que Meta propose : chacun doit correspondre à un
 *  moment réel du parcours, sinon il pollue l'optimisation publicitaire du
 *  laveur au lieu de l'aider. */
export type EvenementPixel = 'PageView' | 'InitiateCheckout' | 'Purchase'

/** Signale un événement, s'il y a un Pixel chargé. Sinon ne fait rien.
 *
 *  C'est ce silence qui permet au formulaire de réservation d'appeler cette
 *  fonction sans condition : le cas « pas de Pixel » et le cas « refusé » se
 *  traitent tout seuls, au même endroit, et un composant ne peut pas oublier
 *  de vérifier. */
export function evenementPixel(nom: EvenementPixel, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !pixelActif) return
  try {
    window.fbq?.('track', nom, params)
  } catch {
    // La mesure ne doit jamais casser une réservation. Un bloqueur de
    // publicité, une extension, un réseau coupé : rien de tout cela ne
    // regarde le client qui essaie de réserver son lavage.
  }
}

/** Remet l'état à zéro. Réservé aux tests. */
export function _reinitialiserPourTests(): void {
  pixelActif = null
}
