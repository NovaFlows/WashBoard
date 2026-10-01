// Le « bien envoyé » de la PWA : un petit magasin partagé (sans contexte React) que n'importe
// quel écran alimente, et que `ConfirmationEnvoiV2` affiche une fois pour toutes, monté dans
// le châssis (`DashboardShell`).
//
// Deux sortes d'envoi :
//  - un envoi que WashBoard fait lui-même (SMS test, partage natif terminé) : `confirmerEnvoi`
//    à l'instant où le serveur ou l'appareil répond ;
//  - un envoi qui part vers une autre app (lien `sms:` ou `wa.me`) : le navigateur ne sait
//    JAMAIS si le message est parti — il sait seulement que le laveur a quitté WashBoard puis
//    y est revenu. `annoncerApresRetour` s'appuie là-dessus : la confirmation n'apparaît qu'au
//    retour dans l'app, jamais au moment du tap (le message n'est alors pas encore écrit).

export type Confirmation = { id: number; titre: string; detail?: string }
export type TexteConfirmation = { titre: string; detail?: string }

let courante: Confirmation | null = null
let compteur = 0
const abonnes = new Set<() => void>()

const emettre = () => abonnes.forEach(f => f())

export function confirmerEnvoi(c: TexteConfirmation): void {
  compteur += 1
  courante = { id: compteur, titre: c.titre, detail: c.detail }
  emettre()
}

export function fermerConfirmation(): void {
  if (courante === null) return
  courante = null
  emettre()
}

export function abonnerConfirmation(f: () => void): () => void {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

export const lireConfirmation = (): Confirmation | null => courante

/** Délai de grâce : au-delà, on considère que le laveur a renoncé à écrire son message. */
export const ATTENTE_RETOUR_MAX_MS = 5 * 60_000
/** Petite pause au retour, le temps que l'app se réaffiche avant d'animer quoi que ce soit. */
const PAUSE_RETOUR_MS = 350

let annulerAttente: (() => void) | null = null

/** À appeler au tap sur un lien `sms:` ou `wa.me`. Affiche la confirmation quand le laveur
 *  REVIENT dans l'app après l'avoir quittée. Un seul envoi attendu à la fois : un nouveau tap
 *  remplace le précédent. */
export function annoncerApresRetour(c: TexteConfirmation): void {
  if (typeof document === 'undefined') return
  annulerAttente?.()

  let parti = document.visibilityState === 'hidden'
  let delai: ReturnType<typeof setTimeout> | undefined

  const nettoyer = () => {
    document.removeEventListener('visibilitychange', surVisibilite)
    clearTimeout(minuteur)
    clearTimeout(delai)
    if (annulerAttente === nettoyer) annulerAttente = null
  }

  function surVisibilite() {
    if (document.visibilityState === 'hidden') { parti = true; return }
    if (!parti) return
    document.removeEventListener('visibilitychange', surVisibilite)
    delai = setTimeout(() => { confirmerEnvoi(c); nettoyer() }, PAUSE_RETOUR_MS)
  }

  document.addEventListener('visibilitychange', surVisibilite)
  const minuteur = setTimeout(nettoyer, ATTENTE_RETOUR_MAX_MS)
  annulerAttente = nettoyer
}
