// Tuto de la PWA installée : 4 arrêts sur la barre du bas et le geste retour,
// montré une seule fois, à l'ouverture de l'application installée.
//
// Distinct de la visite guidée du tableau de bord (`visiteGuidee.ts`, onze
// arrêts sur de vraies pages) : ici le déclencheur est l'INSTALLATION de
// l'app elle-même, pour un laveur qui utilisait déjà le site depuis un
// moment et installe l'app plus tard — il a donc déjà fait la visite
// guidée, mais découvre une forme différente (barre du bas, geste retour,
// « Plus ») sans qu'on la lui présente.
//
// `washers.pwa_tour_complete_at` dit si ce tuto reste à faire — contrairement à
// `dashboard_tour_complete_at`, aucun compte existant n'a été rempli à sa mise en
// place : personne n'a jamais vu cette explication, donc tout le monde la voit une
// fois (NULL partout au départ, y compris les comptes déjà anciens). La progression
// vit dans l'onglet (sessionStorage), comme la visite guidée.
//
// Ne se déclenche qu'une fois la visite guidée du dashboard elle-même terminée
// (passée ou faite) : un compte flambant neuf qui installerait l'app avant même
// d'avoir ouvert le site verrait sinon les deux tutos se chevaucher.

import { logger } from './logger'

export type EtapeTutoPwa = {
  /** Valeur de l'attribut `data-tuto-pwa-cible` de l'élément à mettre en évidence.
   *  `undefined` : aucune découpe, le fond s'assombrit sans rien éclairer (le geste
   *  retour ne correspond à aucun élément précis de l'écran). */
  cible?: string
  texte: string
}

export const ETAPES_TUTO_PWA: readonly EtapeTutoPwa[] = [
  { cible: 'barre-bas', texte: 'Voilà ta barre de navigation : Aujourd’hui, Agenda, Clients et Plus, toujours sous le pouce.' },
  { cible: 'barre-bas-nouveau', texte: 'Ce bouton va droit à un nouveau devis ou une nouvelle facture — le geste que tu fais le plus souvent sur le terrain.' },
  { texte: 'Pour revenir en arrière, glisse n’importe où sur l’écran vers la droite — pas besoin d’atteindre un bouton précis.' },
  { cible: 'barre-bas-plus', texte: 'Le menu a disparu : tout ce qu’il donnait (Guide, abonnement, réglages, assistance) est maintenant ici, dans Plus.' },
]

export type EtatTutoPwa =
  | { statut: 'absente' }
  | { statut: 'en_cours'; etape: number }
  | { statut: 'finie' }

const FINIE = 'finie'

export function lireEtat(brut: string | null): EtatTutoPwa {
  if (brut === FINIE) return { statut: 'finie' }
  if (brut !== null && /^\d+$/.test(brut) && Number(brut) < ETAPES_TUTO_PWA.length) {
    return { statut: 'en_cours', etape: Number(brut) }
  }
  return { statut: 'absente' }
}

export function serialiserEtat(etat: EtatTutoPwa): string | null {
  if (etat.statut === 'finie') return FINIE
  if (etat.statut === 'en_cours') return String(etat.etape)
  return null
}

/** `null` au dernier arrêt : c'est « Terminé », pas « Suivant ». */
export function etapeSuivante(etape: number): number | null {
  return etape + 1 < ETAPES_TUTO_PWA.length ? etape + 1 : null
}

/** Strictement `null`, et la visite guidée du dashboard déjà terminée (passée ou
 *  faite) : sans cette seconde condition, un compte flambant neuf qui installerait
 *  l'app avant d'avoir ouvert le site verrait les deux tutos se chevaucher. */
export function tutoAFaire(fiche: {
  pwa_tour_complete_at?: string | null
  dashboard_tour_complete_at?: string | null
} | null): boolean {
  return fiche?.pwa_tour_complete_at === null && !!fiche?.dashboard_tour_complete_at
}

/** Ce qu'il faut afficher en arrivant sur une page. Même logique que la visite
 *  guidée : `aFaire` n'est connu que sur `/dashboard` (seule page qui le déclenche) ;
 *  ailleurs il vaut `undefined` et l'onglet fait foi. */
export function etatAuChargement(stocke: EtatTutoPwa, aFaire: boolean | undefined): EtatTutoPwa {
  if (stocke.statut === 'finie' || aFaire === undefined) return stocke
  if (!aFaire) return { statut: 'absente' }
  return stocke.statut === 'en_cours' ? stocke : { statut: 'en_cours', etape: 0 }
}

// ── Mémoire de l'onglet ───────────────────────────────────────────────────────

const CLE = 'wb_tuto_pwa'
let memoire: string | null | undefined
const abonnes = new Set<() => void>()

export function lireTuto(): string | null {
  if (memoire === undefined) {
    try {
      memoire = globalThis.sessionStorage.getItem(CLE)
    } catch {
      memoire = null
    }
  }
  return memoire
}

export function ecrireTuto(etat: EtatTutoPwa): void {
  memoire = serialiserEtat(etat)
  try {
    if (memoire === null) globalThis.sessionStorage.removeItem(CLE)
    else globalThis.sessionStorage.setItem(CLE, memoire)
  } catch {
    // voir plus haut : la mémoire du module suffit jusqu'au prochain rechargement
  }
  abonnes.forEach(f => f())
}

export function abonnerTuto(f: () => void): () => void {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

/** « Passer » ou « Terminé » : le tuto disparaît tout de suite, l'écriture en
 *  base suit. Un second appel (double clic) ne renvoie rien. */
export function terminerTuto(): void {
  if (lireEtat(lireTuto()).statut === 'finie') return
  ecrireTuto({ statut: 'finie' })

  fetch('/api/washer/tuto-pwa', { method: 'POST', keepalive: true })
    .then(res => {
      if (res.status === 401) logger.warn('tuto_pwa.terminer.session_expiree', {})
    })
    .catch(e => logger.error('tuto_pwa.terminer.reseau', {}, e))
}
