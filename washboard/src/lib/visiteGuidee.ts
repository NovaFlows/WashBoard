// Visite guidée du tableau de bord : onze arrêts sur de vraies pages, montrée une
// seule fois, au premier passage sur `/dashboard`.
//
// `washers.dashboard_tour_complete_at` dit si elle reste à faire. Les comptes
// antérieurs à sa mise en place ont été remplis à leur date de création : seul un
// compte créé depuis peut avoir NULL. La progression, elle, vit dans l'onglet
// (sessionStorage) : elle survit aux changements de page comme à un rechargement.

import { logger } from './logger'
import { requiredPlanLabel } from './plan'

export type EtapeVisite = {
  route: string
  texte: string
  /** Valeur de l'attribut `data-visite-cible` de l'élément à mettre en évidence. */
  cible?: string
  /** Où retrouver cet écran par le menu, sur le SITE actuel (pas la PWA). À revoir
   *  à la refonte, quand cette navigation changera — voir TODO.md. */
  chemin?: string
}

// Les arrêts 2 à 4 visent les écrans de l'application installée : sur le site,
// leur garde-fou renvoie vers l'équivalent v1 (`/dashboard/admin#…`,
// `/dashboard/crm`). Viser directement l'ancre v1 casserait l'enchaînement
// prestations → disponibilités : `admin#prestations` → `admin#disponibilites`
// ne change que le fragment, et AdminTabs ne relit le fragment qu'au montage.
//
// L'arrêt Lien, lui, vise directement `/dashboard/parametres` (page réelle du
// site, pas redirigée) : l'onglet « Page client » s'ouvre tout seul grâce à
// l'ancre `#lien-reservation` (voir le `useEffect` dédié dans
// `ParametresFormV1.tsx`). Avant les deux autres : c'est ce qu'on voit en
// premier dans cet onglet, « Configurer ma page client » n'étant qu'un bouton
// plus bas dessus — Ryan, 2026-10-02, en testant l'ordre à l'écran.
const CHEMIN_PAGE_CLIENT = 'Paramètres → onglet « Page client »'
const CHEMIN_CONFIGURER = `${CHEMIN_PAGE_CLIENT} → « Configurer ma page client »`

export const ETAPES_VISITE: readonly EtapeVisite[] = [
  { route: '/dashboard', texte: "Voilà ton tableau de bord : tes rendez-vous du jour et ceux à venir, en un coup d'œil." },
  { route: '/dashboard/parametres#lien-reservation', cible: 'lien', texte: "Le lien à donner à tes clients — celui que tu as choisi à l'inscription.", chemin: CHEMIN_PAGE_CLIENT },
  { route: '/dashboard/parametres/prestations', cible: 'prestations', texte: "Ce que tu vends : nom, prix, durée. Ta page reste vide tant que tu n'en as pas créé une.", chemin: `${CHEMIN_CONFIGURER} → Prestations` },
  { route: '/dashboard/parametres/horaires', cible: 'horaires', texte: 'Tes dispos et tes congés : ça décide des créneaux que voient tes clients.', chemin: `${CHEMIN_CONFIGURER} → Disponibilités` },
  { route: '/dashboard/calendrier', texte: 'Toute ton activité en vue mois/semaine/jour.' },
  { route: '/dashboard/clients', texte: "Chaque client qui a réservé, avec son historique et son chiffre d'affaires." },
  { route: '/dashboard/crm', texte: `D'où viennent tes visiteurs et combien réservent vraiment — en formule ${requiredPlanLabel('crm')}.` },
  { route: '/dashboard/compta', texte: `Ton chiffre d'affaires et tes dépenses, par jour, semaine, mois ou année — en formule ${requiredPlanLabel('compta')}.` },
  { route: '/dashboard/factures', texte: `Facture conforme générée et envoyée automatiquement à chaque prestation terminée — en formule ${requiredPlanLabel('facturation')}.` },
  { route: '/dashboard/abonnement', texte: "Ici tu changes d'offre quand tu en as besoin." },
  { route: '/dashboard/guide', texte: "Si tu bloques un jour : le Guide répond seul, l'Assistance contacte l'équipe." },
]

export type EtatVisite =
  | { statut: 'absente' }
  | { statut: 'en_cours'; etape: number }
  | { statut: 'finie' }

const FINIE = 'finie'

export function lireEtat(brut: string | null): EtatVisite {
  if (brut === FINIE) return { statut: 'finie' }
  if (brut !== null && /^\d+$/.test(brut) && Number(brut) < ETAPES_VISITE.length) {
    return { statut: 'en_cours', etape: Number(brut) }
  }
  return { statut: 'absente' }
}

export function serialiserEtat(etat: EtatVisite): string | null {
  if (etat.statut === 'finie') return FINIE
  if (etat.statut === 'en_cours') return String(etat.etape)
  return null
}

/** `null` au dernier arrêt : c'est « Terminé », pas « Suivant ». */
export function etapeSuivante(etape: number): number | null {
  return etape + 1 < ETAPES_VISITE.length ? etape + 1 : null
}

/** Strictement `null` : tant que le SQL n'a pas tourné, la colonne manque dans
 *  la fiche (lue en `*`) et vaut `undefined` — la visite ne doit alors surtout
 *  pas apparaître chez tous les comptes existants. */
export function visiteAFaire(fiche: { dashboard_tour_complete_at?: string | null } | null): boolean {
  return fiche?.dashboard_tour_complete_at === null
}

/** Ce qu'il faut afficher en arrivant sur une page.
 *
 *  `aFaire` n'est connu que sur `/dashboard` (seule page qui la déclenche) ;
 *  ailleurs il vaut `undefined` et l'onglet fait foi. Une visite finie dans cet
 *  onglet ne repart jamais : la page `/dashboard` remise en cache par le routeur
 *  (bouton retour) dirait encore « à faire ». */
export function etatAuChargement(stocke: EtatVisite, aFaire: boolean | undefined): EtatVisite {
  if (stocke.statut === 'finie' || aFaire === undefined) return stocke
  if (!aFaire) return { statut: 'absente' }
  return stocke.statut === 'en_cours' ? stocke : { statut: 'en_cours', etape: 0 }
}

// ── Mémoire de l'onglet ───────────────────────────────────────────────────────
//
// La variable du module fait foi pendant la vie de la page ; sessionStorage ne
// sert qu'à la retrouver après un rechargement. Stockage refusé (navigation
// privée, quota) : la visite marche quand même, elle repart seulement de
// l'arrêt 1 après un rechargement — rien d'autre n'en dépend.

const CLE = 'wb_visite_guidee'
let memoire: string | null | undefined
const abonnes = new Set<() => void>()

export function lireVisite(): string | null {
  if (memoire === undefined) {
    try {
      memoire = globalThis.sessionStorage.getItem(CLE)
    } catch {
      memoire = null
    }
  }
  return memoire
}

export function ecrireVisite(etat: EtatVisite): void {
  memoire = serialiserEtat(etat)
  try {
    if (memoire === null) globalThis.sessionStorage.removeItem(CLE)
    else globalThis.sessionStorage.setItem(CLE, memoire)
  } catch {
    // voir plus haut : la mémoire du module suffit jusqu'au prochain rechargement
  }
  abonnes.forEach(f => f())
}

export function abonnerVisite(f: () => void): () => void {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

/** « Passer » ou « Terminé » : la visite disparaît tout de suite, l'écriture en
 *  base suit. Un second appel (double clic) ne renvoie rien.
 *
 *  Si l'écriture échoue, la visite reviendra à la prochaine session : le serveur
 *  trace déjà ses propres échecs (errorId), on ne trace ici que ce qu'il ne peut
 *  pas voir — la requête qui ne lui parvient pas, ou une session expirée. */
export function terminerVisite(): void {
  if (lireEtat(lireVisite()).statut === 'finie') return
  ecrireVisite({ statut: 'finie' })

  fetch('/api/washer/visite-guidee', { method: 'POST', keepalive: true })
    .then(res => {
      if (res.status === 401) logger.warn('visite_guidee.terminer.session_expiree', {})
    })
    .catch(e => logger.error('visite_guidee.terminer.reseau', {}, e))
}
