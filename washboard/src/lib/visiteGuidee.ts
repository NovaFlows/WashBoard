// Visite guidée du tableau de bord : montrée une seule fois, au premier passage
// sur `/dashboard` — et rejouable à volonté depuis le Guide (voir `redemarrerVisite`).
//
// Sur le SITE, dix-huit arrêts sur de vraies pages — couvre désormais tout le
// catalogue réel de la PWA (audit du 2026-10-09 : barre du bas, sous-menu Plus,
// Clients et ses automatismes/publicités, Chiffres et ses trois sous-écrans,
// Réglages, Assistance). Les trois anciens arrêts CRM/Compta/Factures
// (`/dashboard/crm`, `/dashboard/compta`, `/dashboard/factures`) ont été
// retirés le même jour : ce sont d'anciens écrans v1 qu'aucun écran v2 ne lie
// plus depuis que `/dashboard/chiffres` a absorbé leur contenu — des
// impasses pour un laveur qui les suivrait. Dans l'APPLICATION installée, des
// arrêts supplémentaires s'intercalent pour présenter la barre du bas au fil de
// l'eau — « regarde cet onglet » (assombrissement + découpe, sans changer de
// page) juste avant d'y naviguer pour de vrai, plutôt qu'un bloc à part à la
// fin. `pwaSeulement` marque ces arrêts : invisibles sur le site, où la barre
// du bas n'existe pas (demande de Ryan, 2026-10-07 : « tu peux présenter un onglet
// de la barre puis rentrer dedans et présenter etc. »).
//
// Prestations, Horaires, Adresse de départ, Téléphone et Logo (les cinq
// essentiels de `computeSetupProgress`, setupProgress.ts) sont en plus
// `interactif` : la visite s'efface au profit d'un simple repère, laisse
// l'écran réel cliquable, et avance toute seule dès que le laveur a vraiment
// fait l'action — pas de « Suivant » à cliquer dans le vide (Ryan,
// 2026-10-07 puis 2026-10-09 : « accompagner le laveur à remplir ses
// informations », pour les cinq, pas seulement les trois bloquants).
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
  /** Arrêt « fais-le maintenant », pas « regarde » : la carte s'efface au
   *  profit d'un simple repère lumineux, laisse l'écran réel cliquable, et
   *  avance toute seule dès que `avancement` (VisiteGuidee.tsx) dit que
   *  c'est fait — ajouter une prestation, un horaire, une adresse, un
   *  téléphone, un logo. Clé de `SetupInput`/`computeSetupProgress`
   *  (setupProgress.ts) : les cinq essentiels (les trois bloquants, plus
   *  téléphone et logo qui ne l'étaient pas mais restaient sans aucun arrêt
   *  — Ryan, 2026-10-09 : « accompagner le laveur à remplir ses
   *  informations », pas seulement 3 des 5). */
  interactif?: 'services' | 'availabilities' | 'baseAddress' | 'phone' | 'logo'
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
  { pwaSeulement: true, cible: 'barre-bas', texte: 'Nouveau : ta navigation passe maintenant par cette barre, toujours sous le pouce — on commence par Aujourd’hui.' },
  { route: '/dashboard', texte: "Voilà ton tableau de bord : tes rendez-vous du jour et ceux à venir, en un coup d'œil." },
  { pwaSeulement: true, cible: 'barre-bas-nouveau', texte: 'Ce bouton va droit à un nouveau devis ou une nouvelle facture — le geste le plus fréquent sur le terrain.' },
  { pwaSeulement: true, cible: 'barre-bas-plus', texte: 'Plus loin dans Plus : tout ce que tu ne consultes pas tous les jours — prestations, horaires, factures, compte.' },
  { route: '/dashboard/parametres#lien-reservation', cible: 'lien', texte: "Le lien à donner à tes clients — celui que tu as choisi à l'inscription.", chemin: CHEMIN_PAGE_CLIENT },
  { route: '/dashboard/parametres/prestations', cible: 'prestations', texte: "Ce que tu vends : nom, prix, durée. Ajoutes-en au moins une — ta page reste vide tant que tu n'en as pas créé une.", chemin: `${CHEMIN_CONFIGURER} → Prestations`, interactif: 'services' },
  { route: '/dashboard/parametres/horaires', cible: 'horaires', texte: 'Tes dispos et tes congés : choisis un modèle de semaine, ça décide des créneaux que voient tes clients.', chemin: `${CHEMIN_CONFIGURER} → Disponibilités`, interactif: 'availabilities' },
  { route: '/dashboard/parametres/profil', cible: 'adresse-depart', texte: "Ton point de départ : sert à calculer les trajets, et à ne pas proposer un créneau hors de ta zone.", chemin: `${CHEMIN_CONFIGURER} → Mon profil`, interactif: 'baseAddress' },
  { cible: 'telephone', texte: "Ton téléphone : le numéro que voient tes clients pour te joindre.", chemin: `${CHEMIN_CONFIGURER} → Mon profil`, interactif: 'phone' },
  { route: '/dashboard/parametres/apparence', cible: 'logo', texte: "Ton logo : il habille ta page de réservation, pour que tes clients te reconnaissent du premier coup d'œil.", chemin: CHEMIN_CONFIGURER, interactif: 'logo' },
  { pwaSeulement: true, cible: 'barre-bas-agenda', texte: 'Et sur Agenda :' },
  { route: '/dashboard/calendrier', texte: 'Toute ton activité en vue mois/semaine/jour.' },
  { pwaSeulement: true, cible: 'barre-bas-clients', texte: 'Sur Clients :' },
  { route: '/dashboard/clients', texte: "Chaque client qui a réservé, avec son historique et son chiffre d'affaires." },
  { route: '/dashboard/clients/messages', texte: `Avis Google et relances automatiques après chaque prestation — en formule ${requiredPlanLabel('followup')}.` },
  { route: '/dashboard/clients/publicites', texte: `Le retour sur chaque campagne publicitaire, visites et réservations comptées — en formule ${requiredPlanLabel('campagnes')}.` },
  { route: '/dashboard/chiffres', texte: `D'où viennent tes visiteurs et combien réservent vraiment, à côté de ton chiffre d'affaires — en formule ${requiredPlanLabel('crm')}.` },
  { route: '/dashboard/chiffres/documents', texte: 'Un devis ou une facture sans rendez-vous derrière — le même écran que le bouton [+] de la barre.' },
  { route: '/dashboard/chiffres/depenses', texte: "Tes dépenses, pour un chiffre d'affaires net plus juste." },
  { route: '/dashboard/abonnement', texte: "Ici tu changes d'offre quand tu en as besoin." },
  { route: '/dashboard/parametres/reglages', texte: 'Thème, notifications — et deux raccourcis vers ce qui vient juste après.' },
  { route: '/dashboard/assistance', texte: "Une question sans réponse dans le Guide ? Écris directement à l'équipe." },
  { pwaSeulement: true, texte: "Dernière chose : pour revenir en arrière, glisse n'importe où sur l'écran vers la droite — pas besoin d'atteindre un bouton précis." },
  { route: '/dashboard/guide', texte: 'Si tu bloques un jour, commence ici : la plupart des questions ont déjà leur réponse.' },
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
 *  `/dashboard` la redirait aussitôt « finie ») puis relance au premier arrêt.
 *
 *  Renvoie une promesse — l'appelant DOIT l'attendre avant de naviguer vers
 *  `/dashboard` (et appeler `router.refresh()` juste après). Avant le
 *  2026-10-10, cette fonction ne l'attendait pas elle-même : l'appelant
 *  lançait `router.push('/dashboard')` dans la foulée, sans attendre que la
 *  base ait vraiment été modifiée NI que le cache routeur de Next.js ait eu
 *  la moindre raison de ne pas resservir la page déjà visitée (celle d'avant
 *  la remise à zéro). Repéré par Ryan : premier clic sur « Revoir le tuto »
 *  qui ramène simplement au tableau de bord sans rien démontrer, deuxième
 *  clic qui marche — et un « faux lancement » (premier arrêt qui semblait se
 *  jouer deux fois), très probablement le même bug : la page en cache
 *  s'affiche d'abord, puis Next.js la remplace en silence par la version
 *  fraîche une fraction de seconde après, réamorçant le premier arrêt.
 *  Vérifié : 5 essais consécutifs sans échec une fois la suppression
 *  attendue ET `router.refresh()` ajouté (contre des échecs intermittents
 *  avec `router.refresh()` seul, sans l'attente). */
export async function redemarrerVisite(): Promise<void> {
  ecrireVisite({ statut: 'en_cours', etape: 0 })

  try {
    const res = await fetch('/api/washer/visite-guidee', { method: 'DELETE' })
    if (res.status === 401) logger.warn('visite_guidee.redemarrer.session_expiree', {})
  } catch (e) {
    logger.error('visite_guidee.redemarrer.reseau', {}, e)
  }
}

// ── Signal des arrêts `interactif` ──────────────────────────────────────────
//
// Les écrans de réglages (PrestationsV2, HorairesV2, ProfilV2) gardent leur
// propre état local après une écriture — `usePrestationsV2`/`useHorairesV2` ne
// rappellent PAS le serveur (affichage optimiste assumé, voir leurs
// commentaires), donc les props que chaque page sert à `DashboardShell` à son
// premier rendu restent figées : une prestation ajoutée pendant la visite ne
// s'y reflète jamais. Plutôt que de forcer un `router.refresh()` que ces
// écrans évitent exprès, chacun signale son écriture ici, et VisiteGuidee
// n'écoute que l'arrêt affiché — même mécanisme que `abonnerVisite` ci-dessus.
export type CleAvancement = 'services' | 'availabilities' | 'baseAddress' | 'phone' | 'logo'

const abonnesAvancement = new Set<(cle: CleAvancement) => void>()

/** Appelé juste après une écriture réussie — jamais avant, jamais en optimiste :
 *  un signal doit dire « c'est fait », pas « ça va peut-être marcher ». */
export function signalerAvancement(cle: CleAvancement): void {
  abonnesAvancement.forEach(f => f(cle))
}

export function abonnerAvancement(f: (cle: CleAvancement) => void): () => void {
  abonnesAvancement.add(f)
  return () => { abonnesAvancement.delete(f) }
}
