// Visite guidée du tableau de bord : montrée une seule fois, au premier passage
// sur `/dashboard` — et rejouable à volonté depuis le Guide (voir `redemarrerVisite`).
//
// Sur le SITE, onze arrêts sur de vraies pages (comme avant). Dans l'APPLICATION
// installée, des arrêts supplémentaires s'intercalent pour présenter la barre du
// bas au fil de l'eau — « regarde cet onglet » (assombrissement + découpe, sans
// changer de page) juste avant d'y naviguer pour de vrai, plutôt qu'un bloc à part
// à la fin. `pwaSeulement` marque ces arrêts : invisibles sur le site, où la barre
// du bas n'existe pas (demande de Ryan, 2026-10-07 : « tu peux présenter un onglet
// de la barre puis rentrer dedans et présenter etc. »).
//
// `washers.dashboard_tour_complete_at` dit si elle reste à faire. Les comptes
// antérieurs à sa mise en place ont été remplis à leur date de création : seul un
// compte créé depuis peut avoir NULL. La progression, elle, vit dans l'onglet
// (sessionStorage) : elle survit aux changements de page comme à un rechargement.
//
// « Passer » ne marque PLUS la visite comme terminée (changé le 2026-10-07) : elle
// ferme juste la carte pour cette session d'onglet, et reprend au premier arrêt la
// prochaine fois que `/dashboard` se charge pour de vrai (tant que la colonne reste
// NULL). Seul le dernier arrêt, avec « Terminé », marque la fin pour de bon.

import { logger } from './logger'
import { requiredPlanLabel } from './plan'

export type EtapeVisite = {
  /** Absente : l'arrêt reste sur la page déjà affichée (ex. un onglet de la barre
   *  du bas, montré avant d'y naviguer). Présente : navigue vers cette route. */
  route?: string
  texte: string
  /** Valeur de l'attribut `data-visite-cible` de l'élément à mettre en évidence. */
  cible?: string
  /** Où retrouver cet écran par le menu, sur le SITE actuel (pas la PWA). À revoir
   *  à la refonte, quand cette navigation changera — voir TODO.md. */
  chemin?: string
  /** N'apparaît que dans l'application installée (barre du bas, geste retour :
   *  rien de tout ça n'existe sur le site). */
  pwaSeulement?: boolean
}

// Les arrêts « page » visent les écrans de l'application installée : sur le site,
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

// Ordre des arrêts « page » INCHANGÉ par rapport à avant (demande testée et
// tranchée par Ryan le 2026-10-02 pour Lien/Prestations/Horaires) : les arrêts
// PWA s'intercalent juste avant l'arrêt qu'ils annoncent, sans jamais déplacer
// les arrêts existants les uns par rapport aux autres.
export const ETAPES_VISITE: readonly EtapeVisite[] = [
  { pwaSeulement: true, cible: 'barre-bas', texte: 'Nouveau : ta navigation passe maintenant par cette barre, toujours sous le pouce.' },
  { pwaSeulement: true, cible: 'barre-bas-aujourdhui', texte: 'On commence par Aujourd’hui.' },
  { route: '/dashboard', texte: "Voilà ton tableau de bord : tes rendez-vous du jour et ceux à venir, en un coup d'œil." },
  { pwaSeulement: true, cible: 'barre-bas-nouveau', texte: 'Ce bouton va droit à un nouveau devis ou une nouvelle facture — le geste le plus fréquent sur le terrain.' },
  { pwaSeulement: true, cible: 'barre-bas-plus', texte: 'Plus loin dans Plus : tout ce que tu ne consultes pas tous les jours — prestations, horaires, factures, compte.' },
  { route: '/dashboard/parametres#lien-reservation', cible: 'lien', texte: "Le lien à donner à tes clients — celui que tu as choisi à l'inscription.", chemin: CHEMIN_PAGE_CLIENT },
  { route: '/dashboard/parametres/prestations', cible: 'prestations', texte: "Ce que tu vends : nom, prix, durée. Ta page reste vide tant que tu n'en as pas créé une.", chemin: `${CHEMIN_CONFIGURER} → Prestations` },
  { route: '/dashboard/parametres/horaires', cible: 'horaires', texte: 'Tes dispos et tes congés : ça décide des créneaux que voient tes clients.', chemin: `${CHEMIN_CONFIGURER} → Disponibilités` },
  { pwaSeulement: true, cible: 'barre-bas-agenda', texte: 'Et sur Agenda :' },
  { route: '/dashboard/calendrier', texte: 'Toute ton activité en vue mois/semaine/jour.' },
  { pwaSeulement: true, cible: 'barre-bas-clients', texte: 'Sur Clients :' },
  { route: '/dashboard/clients', texte: "Chaque client qui a réservé, avec son historique et son chiffre d'affaires." },
  { route: '/dashboard/crm', texte: `D'où viennent tes visiteurs et combien réservent vraiment — en formule ${requiredPlanLabel('crm')}.` },
  { route: '/dashboard/compta', texte: `Ton chiffre d'affaires et tes dépenses, par jour, semaine, mois ou année — en formule ${requiredPlanLabel('compta')}.` },
  { route: '/dashboard/factures', texte: `Facture conforme générée et envoyée automatiquement à chaque prestation terminée — en formule ${requiredPlanLabel('facturation')}.` },
  { route: '/dashboard/abonnement', texte: "Ici tu changes d'offre quand tu en as besoin." },
  { pwaSeulement: true, texte: "Dernière chose : pour revenir en arrière, glisse n'importe où sur l'écran vers la droite — pas besoin d'atteindre un bouton précis." },
  { route: '/dashboard/guide', texte: "Si tu bloques un jour : le Guide répond seul, l'Assistance contacte l'équipe." },
]

/** La liste réellement montrée : tous les arrêts sur le site, les arrêts PWA en
 *  plus dans l'application installée. Tout le reste (numérotation, navigation,
 *  stockage) travaille sur CETTE liste, jamais sur `ETAPES_VISITE` brute. */
export function etapesPour(isPwa: boolean): readonly EtapeVisite[] {
  return isPwa ? ETAPES_VISITE : ETAPES_VISITE.filter(e => !e.pwaSeulement)
}

export type EtatVisite =
  | { statut: 'absente' }
  | { statut: 'en_cours'; etape: number }
  | { statut: 'finie' }

const FINIE = 'finie'

export function lireEtat(brut: string | null, nombreEtapes: number): EtatVisite {
  if (brut === FINIE) return { statut: 'finie' }
  if (brut !== null && /^\d+$/.test(brut) && Number(brut) < nombreEtapes) {
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
export function etapeSuivante(etape: number, nombreEtapes: number): number | null {
  return etape + 1 < nombreEtapes ? etape + 1 : null
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

/** « Passer » : ferme la carte pour cette session d'onglet, SANS marquer la
 *  visite terminée — elle reprend au premier arrêt la prochaine fois que
 *  `/dashboard` se charge pour de vrai (tant que la colonne reste NULL).
 *  Rien à écrire en base : il n'y a rien de définitif à y poser. */
export function fermerPourLInstant(): void {
  ecrireVisite({ statut: 'absente' })
}

/** « Terminé », au dernier arrêt seulement : la visite disparaît tout de suite,
 *  l'écriture en base suit. Un second appel (double clic) ne renvoie rien.
 *
 *  Si l'écriture échoue, la visite reviendra à la prochaine session : le serveur
 *  trace déjà ses propres échecs (errorId), on ne trace ici que ce qu'il ne peut
 *  pas voir — la requête qui ne lui parvient pas, ou une session expirée. */
export function terminerVisite(): void {
  if (lireEtat(lireVisite(), ETAPES_VISITE.length).statut === 'finie') return
  ecrireVisite({ statut: 'finie' })

  fetch('/api/washer/visite-guidee', { method: 'POST', keepalive: true })
    .then(res => {
      if (res.status === 401) logger.warn('visite_guidee.terminer.session_expiree', {})
    })
    .catch(e => logger.error('visite_guidee.terminer.reseau', {}, e))
}

/** Bouton « Revoir le tuto » du Guide : repart de zéro même si déjà terminée.
 *  Efface `dashboard_tour_complete_at` en base (sinon le prochain chargement de
 *  `/dashboard` la redirait aussitôt « finie ») puis relance au premier arrêt. */
export function redemarrerVisite(): void {
  ecrireVisite({ statut: 'en_cours', etape: 0 })

  fetch('/api/washer/visite-guidee', { method: 'DELETE', keepalive: true })
    .then(res => {
      if (res.status === 401) logger.warn('visite_guidee.redemarrer.session_expiree', {})
    })
    .catch(e => logger.error('visite_guidee.redemarrer.reseau', {}, e))
}
