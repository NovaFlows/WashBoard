'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Trash2, Users2 } from 'lucide-react'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import FicheEntrepriseV2 from '@/components/dashboard/FicheEntrepriseV2'
import { ConfirmationSuppression } from '@/components/dashboard/PrestationsUiV2'
import { useLigneGlissante, LARGEUR_ACTION_PX } from '@/hooks/useLigneGlissante'
import { buildClientProfile, type ClientBooking, type ClientDocument, type ClientReglages } from '@/lib/clientProfile'
import { listeClients, rechercherClients, type ResumeClient } from '@/lib/listeClients'
import { clientsARelancer, type LigneARelancer, type ReglagesRelance } from '@/lib/clientsARelancer'
import { buildEntrepriseProfile, type EntrepriseListItem } from '@/lib/entrepriseProfile'
import { marquerNePlusContacter, supprimerClient, supprimerEntreprise } from '@/lib/clientsApi'
import { trouverDoublon } from '@/lib/doublons'
import type { RdvMessage } from '@/lib/messagesAutomatiques'
import { FUSEAU } from '@/lib/dateUtils'
import { formatEuros } from '@/lib/plan'
import { LigneClientVerrouilleeV2 } from '@/components/dashboard/ReservationVerrouilleeV2'
import AutomatismesClientsV2, { type AutomatismesClients } from '@/components/dashboard/AutomatismesClientsV2'
import { Ligne, CarteListe, TitreSection } from '@/components/dashboard/ParametresFormV2'
import type { ClientBloque } from '@/components/dashboard/ClientsViewV1'

// Fichier clients du laveur, présentation v2 — réservée à la PWA installée en
// mode standalone (voir ClientsView.tsx, le point de branchement ; décision
// d'Alexandre, 2026-09-22 : le site reste v1 sans exception). Anciennement
// l'écran pilote de la refonte 2026 (passe 2), à l'intérieur d'un châssis
// (DashboardShell) encore en v1 — voir le compte rendu de la passe pour ce
// que ça donne et pourquoi ce n'est pas rattrapé ici. La logique
// (listeClients, rechercherClients, buildClientProfile, le calcul de
// `maintenant`, l'ouverture de la fiche) n'a pas bougé : seule la
// présentation change, et elle n'est pas dupliquée avec ClientsViewV1.tsx.
//
// Onglet « À relancer » (2026-09-28, proposition de Yanis discutée avec Alexandre) : premier
// morceau d'un vrai CRM, avant les prospects et les fiches entreprise (voir le compte rendu de
// la discussion). Tout son calcul vit dans `lib/clientsARelancer.ts`, qui réutilise la règle
// exacte du cron de relance — cet écran ne fait qu'afficher.
//
// « Supprimer » un client (glisser la ligne vers la gauche, 2026-09-28, demande d'Alexandre) —
// en réalité un MASQUAGE, jamais une vraie suppression : voir `ClientReglages.masque` et
// `/api/clients/[cle]` DELETE. Ses réservations et ses documents ne sont pas touchés — un
// client porte parfois une facture dont la numérotation ne doit jamais avoir de trou, que la
// loi oblige à garder 10 ans, donc rien de tout ça ne peut disparaître. Il disparaît seulement
// de ce fichier-ci.
//
// Même geste dans « À relancer », sens différent (Alexandre, 2026-09-28) : supprimer une ligne
// là annule sa relance — « ne plus contacter » (même réglage que le menu de la fiche), pas un
// masquage. La ligne ne disparaît donc pas : elle passe en « Ne veut plus », comme n'importe
// quel client opposé (voir `clientsARelancer.ts`) — cohérent avec le fait qu'un client opposé
// reste volontairement visible dans cette liste.
//
// `reglagesLocaux` porte les deux (masquer, ne plus contacter) en overlay sur `reglages`, pour
// que l'écran change TOUT DE SUITE après un geste réussi, sans attendre le prochain chargement
// des props serveur (`router.refresh()` part quand même, pour rester à jour si l'écran se
// recompose plus tard).
//
// PASSE BUREAU (2026-10-05, Alexandre, 2026-10-03) : cet écran RESPIRE au-delà du palier
// `useGrandEcran()` plutôt qu'un `ClientsViewV3Bureau.tsx` séparé — arbitrage à documenter ici
// puisque c'est le premier écran de cette nouvelle passe et qu'il sert de modèle aux suivantes.
// Pourquoi pas un troisième fichier (le schéma `EcranV1.tsx`/`EcranV2.tsx` de
// `.claude/agents/refonte.md`) : ce schéma répond à un changement de FORME entre deux PUBLICS
// différents (site vs PWA) qui n'ont presque rien en commun dans leur JSX (voir
// ClientsViewV1.tsx vs ce fichier). Ici, c'est l'inverse : la même architecture
// d'information (liste de clients, pastilles de filtre, fiche qui montre stats + historique)
// s'affiche simplement avec plus de place — la liste ne change pas de contenu, la fiche ne
// change pas de contenu (voir ClientProfileModalV2.tsx, qui garde CORPS FICHE identique et ne
// fait varier que le châssis). Forker aurait dupliqué l'intégralité du JSX de la liste
// (recherche, pastilles, pagination, glisser-pour-supprimer, trois onglets) pour UN SEUL
// changement réel : la fiche sélectionnée s'affiche à côté plutôt que par-dessus. Un
// `ClientsViewV3Bureau.tsx` aurait donc reporté deux fois chaque correction de présentation de
// la liste (vérifié en relisant le JSX avant de trancher, comme demandé) — exactement le risque
// que `refonte.md` signale pour le schéma à trois fichiers.
//
// Qui voit cette disposition : UNIQUEMENT une largeur ≥ `SEUIL_GRAND_ECRAN_PX` (1024px,
// `grandEcran.ts`) — `ClientsView.tsx` a déjà décidé plus haut si cet écran v2 se montre du
// tout (PWA, ou site + grand écran + `washer.beta_refonte`) ; ici, la question est seulement
// « ai-je la place ». Une PWA installée sur ordinateur, à cette même largeur, obtient donc
// AUSSI le panneau à côté — cohérent, et pas testé par cette passe (voir le rapport). Le site
// sur téléphone ne peut jamais atteindre ce palier (voir `grandEcran.ts`), donc rien ne change
// pour lui ici — la vraie garde contre ce cas-là vit dans `ClientsView.tsx`.

// Rôle "corps" (14/450) et "corps fort" (15/550), largeur 100 — planche
// Système. Les tailles en px viennent de `specs/03_Clients.txt` (position et
// taille exactes de chaque ligne de texte de cet écran), pas d'une estimation.
const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

function dateCourte(iso: string, maintenant: number): string {
  const d = new Date(iso)
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }), timeZone: FUSEAU,
  })
}

// Un jour de semaine ("jeudi") pour un rendez-vous proche : c'est ce que lit
// la maquette ("RDV jeudi"). Au-delà d'une semaine, la date courte reste plus
// lisible qu'un jour de semaine ambigu.
function jourCourt(iso: string, maintenant: number): string {
  const diffJours = Math.round((new Date(iso).getTime() - maintenant) / 86_400_000)
  if (diffJours >= 0 && diffJours < 7) {
    return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: FUSEAU })
  }
  return dateCourte(iso, maintenant)
}

// Initiales d'avatar : premier mot + dernier mot, un seul mot sinon. Même
// règle pour une personne ("Claire Martin" → CM) et une entreprise
// ("Garage Renault Mérignac" → GM) — la maquette prend les deux premiers
// mots d'une entreprise ("GR"), une règle propre à cet exemple plutôt que
// généralisable (elle donnerait de moins bons résultats sur un nom à quatre
// mots) : un seul algorithme pour tout le monde plutôt que d'en inventer un
// second pour ce seul cas.
function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

// Le contenu de la ligne secondaire : le contact (pour un pro) puis la
// dernière prestation réellement faite, ou l'état "pas encore" existant.
function ligneSecondaire(c: ResumeClient, maintenant: number): string {
  const contact = c.isProfessional && c.companyName ? c.name : null
  const prestation = c.derniere
    ? `${c.derniere.service} · ${dateCourte(c.derniere.date, maintenant)}`
    : 'Pas encore de prestation faite'
  return [contact, prestation].filter(Boolean).join(' · ')
}

// La pastille de droite : un seul signal par ligne ("un écran = un héros, le
// reste en petit", appliqué à la ligne). Un rendez-vous à venir prime — c'est
// ce qu'il cherche au téléphone — sinon le nombre de lavages, qui existe pour
// tout le monde, y compris 0. Ce que la maquette montre à cet endroit pour
// d'autres lignes (devis en attente, revenu mensuel, jours depuis la
// dernière visite) n'est pas dans les réservations : voir le compte rendu.
function pastilleDroite(c: ResumeClient, maintenant: number): { texte: string; couleur: string } {
  if (c.prochain) {
    return { texte: `RDV ${jourCourt(c.prochain.date, maintenant)}`, couleur: 'text-[color:var(--v2-color-vert)]' }
  }
  return {
    texte: `${c.honoredCount} lavage${c.honoredCount > 1 ? 's' : ''}`,
    couleur: 'text-[color:var(--v2-color-gris)]',
  }
}

type Filtre = 'tous' | 'pros' | 'relancer' | 'entreprises'

/** Clients montrés d'abord sous chaque filtre, puis ajoutés à chaque « Charger plus »
 *  (Alexandre, 2026-09-30) : un fichier de plusieurs dizaines de contacts ne se déroule plus d'un bloc. */
const PAS_AFFICHAGE = 5
/** Sur grand écran, la colonne de liste fait toute la hauteur de la fenêtre : s’arrêter à 5
 *  lignes y laisse un grand vide et donne l’impression d’un fichier client presque vide.
 *  Le pas du téléphone (5) reste celui du petit écran, où chaque ligne coûte un défilement. */
const PAS_AFFICHAGE_BUREAU = 15

const CLASSE_BOUTON_PAGINATION = `flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-colors active:bg-[color:var(--v2-color-fond)] motion-reduce:transition-none`

/** « Charger plus » tant qu'il reste des lignes ; « Charger moins » dès qu'on a déplié au-delà du
 *  premier lot (Alexandre, 2026-09-30) — un tap par lot de 5, dans les deux sens. */
function PaginationListe({ total, limite, onPlus, onMoins }: {
  total: number; limite: number; onPlus: () => void; onMoins: () => void
}) {
  const restants = total - limite
  const peutReplier = limite > PAS_AFFICHAGE && total > PAS_AFFICHAGE
  if (restants <= 0 && !peutReplier) return null
  return (
    <div className="flex gap-2">
      {peutReplier && (
        <button type="button" onClick={onMoins} className={CLASSE_BOUTON_PAGINATION}>
          Charger moins
        </button>
      )}
      {restants > 0 && (
        <button type="button" onClick={onPlus} className={CLASSE_BOUTON_PAGINATION}>
          Charger plus
          <span className="ml-1.5 text-[color:var(--v2-color-gris)]">({restants})</span>
        </button>
      )}
    </div>
  )
}

/** `ClientBooking` porte déjà tout ce que `RdvMessage` demande (voir son en-tête) — sauf
 *  `client_email` non nullable, alors que le formulaire de réservation ne l'exige pas toujours
 *  d'après son type. Une chaîne vide s'exclut d'elle-même du regroupement par client. */
function versRdvMessage(b: ClientBooking): RdvMessage {
  return {
    id: b.id, client_name: b.client_name, client_email: b.client_email || null, client_phone: b.client_phone,
    scheduled_at: b.scheduled_at, created_at: b.created_at ?? b.scheduled_at, status: b.status,
    is_professional: b.is_professional, company_name: b.company_name, services: b.services,
    followup_sent_at: b.followup_sent_at,
  }
}

export default function ClientsViewV2({
  bookings, bloques = [], offreDeblocage = 'Pro', montantBloque = 0,
  documents = [], reglages = [], reglagesMessages, entreprises = [], nomLaveur, automatismes,
}: {
  bookings: ClientBooking[]
  /** Clients masqués par le plafond de l'offre (2026-09-28) — voir `ClientsViewV1.tsx`,
   *  `ClientBloque` : même règle des deux côtés, une carte floutée plutôt qu'un encart à part
   *  (« se lisait comme une publicité et se sautait comme une publicité », retour de test). */
  bloques?: ClientBloque[]
  /** Nom de l'offre qui les débloque — « Starter », « Pro ». */
  offreDeblocage?: string
  /** Total en euros des lavages masqués. */
  montantBloque?: number
  /** Devis et factures écrits à la main : ils font naître des clients qui n'ont jamais
   *  réservé (Alexandre, 2026-09-27 — « un client comme un autre »). */
  documents?: ClientDocument[]
  /** « Ne plus contacter », écrit à la main (2026-09-28). */
  reglages?: ClientReglages[]
  /** Réglages de relance du laveur : sans eux, pas d'onglet « À relancer » (bookings passés
   *  sans cette prop dans les autres écrans qui réutilisent ClientsViewV2 — aucun aujourd'hui). */
  reglagesMessages?: ReglagesRelance
  /** Fiches entreprise (2026-09-28), sites et contacts déjà joints. */
  entreprises?: EntrepriseListItem[]
  /** Signature du message WhatsApp envoyé depuis une facture ouverte dans la Fiche entreprise. */
  nomLaveur?: string
  /** Section « Automatismes » (avis Google, relance, créneaux intelligents), 2026-09-30. */
  automatismes?: AutomatismesClients
}) {
  const router = useRouter()
  // Passe bureau : voir l'en-tête du fichier. `false` au rendu serveur et jusqu'à l'hydratation
  // — l'écran démarre donc toujours en disposition à une colonne, comme avant cette passe.
  const grandEcran = useGrandEcran()
  // Combien de lignes on montre avant de demander « Charger plus » : la place disponible
  // n’est pas la même sur un téléphone et sur un écran d’ordinateur.
  const pas = grandEcran ? PAS_AFFICHAGE_BUREAU : PAS_AFFICHAGE
  // L'instant présent, lu une seule fois : le serveur et le navigateur doivent
  // calculer la même liste.
  const [maintenant] = useState(() => Date.now())
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')
  const [visibles, setVisibles] = useState<Record<Filtre, number>>({
    tous: pas, pros: pas, relancer: pas, entreprises: pas,
  })
  const [ouvert, setOuvert] = useState<string | null>(null)
  const [entrepriseOuverteId, setEntrepriseOuverteId] = useState<string | null>(null)

  // Réglages écrits en overlay LOCAL, en plus de `reglages` (props serveur) — voir l'en-tête du
  // fichier. Une seule structure pour les deux gestes de suppression (client, ligne à relancer).
  const [reglagesLocaux, setReglagesLocaux] = useState<Map<string, Partial<Pick<ClientReglages, 'masque' | 'nePlusContacter'>>>>(new Map())
  const reglagesEffectifs = useMemo(() => {
    if (reglagesLocaux.size === 0) return reglages
    const parCle = new Map(reglages.map(r => [r.cle, r]))
    for (const [cle, override] of reglagesLocaux) {
      const existant = parCle.get(cle) ?? { cle, nePlusContacter: false, masque: false, notes: null, vehicules: null, nom: null, telephone: null }
      parCle.set(cle, { ...existant, ...override })
    }
    return [...parCle.values()]
  }, [reglages, reglagesLocaux])

  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null)
  const [suppression, setSuppression] = useState<ResumeClient | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null)

  // Ligne d'« À relancer » qu'on annule — même geste, sens différent (voir l'en-tête).
  const [annulationRelance, setAnnulationRelance] = useState<LigneARelancer | null>(null)
  const [annulationRelanceEnCours, setAnnulationRelanceEnCours] = useState(false)
  const [annulationRelanceErreur, setAnnulationRelanceErreur] = useState<string | null>(null)

  // Entreprise qu'on supprime depuis la liste (onglet « Entreprises ») — même geste, même
  // conséquence sans risque que depuis sa fiche (voir FicheEntrepriseV2.tsx).
  const [entreprisesSupprimeesLocalement, setEntreprisesSupprimeesLocalement] = useState<Set<string>>(new Set())
  const [entrepriseASupprimer, setEntrepriseASupprimer] = useState<EntrepriseListItem | null>(null)
  const [suppressionEntrepriseEnCours, setSuppressionEntrepriseEnCours] = useState(false)
  const [suppressionEntrepriseErreur, setSuppressionEntrepriseErreur] = useState<string | null>(null)

  const clients = useMemo(
    () => listeClients(bookings, new Date(maintenant), documents, reglagesEffectifs),
    [bookings, documents, reglagesEffectifs, maintenant],
  )
  const pros = useMemo(() => clients.filter(c => c.isProfessional).length, [clients])

  async function confirmerSuppressionClient() {
    if (!suppression || suppressionEnCours) return
    setSuppressionEnCours(true)
    setSuppressionErreur(null)
    const r = await supprimerClient(suppression.cle)
    setSuppressionEnCours(false)
    if (!r.ok) { setSuppressionErreur(r.message); return }
    setReglagesLocaux(m => new Map(m).set(suppression.cle, { ...m.get(suppression.cle), masque: true }))
    setSuppression(null)
    setLigneOuverte(null)
    router.refresh()
  }

  async function confirmerAnnulationRelance() {
    if (!annulationRelance || annulationRelanceEnCours) return
    setAnnulationRelanceEnCours(true)
    setAnnulationRelanceErreur(null)
    const r = await marquerNePlusContacter(annulationRelance.cle, true)
    setAnnulationRelanceEnCours(false)
    if (!r.ok) { setAnnulationRelanceErreur(r.message); return }
    setReglagesLocaux(m => new Map(m).set(annulationRelance.cle, { ...m.get(annulationRelance.cle), nePlusContacter: true }))
    setAnnulationRelance(null)
    setLigneOuverte(null)
    router.refresh()
  }

  async function confirmerSuppressionEntreprise() {
    if (!entrepriseASupprimer || suppressionEntrepriseEnCours) return
    setSuppressionEntrepriseEnCours(true)
    setSuppressionEntrepriseErreur(null)
    const r = await supprimerEntreprise(entrepriseASupprimer.id)
    setSuppressionEntrepriseEnCours(false)
    if (!r.ok) { setSuppressionEntrepriseErreur(r.message); return }
    setEntreprisesSupprimeesLocalement(s => new Set(s).add(entrepriseASupprimer.id))
    setEntrepriseASupprimer(null)
    setLigneOuverte(null)
    router.refresh()
  }

  // Qui est déjà rattaché à une entreprise, et à laquelle — pour la Fiche client (menu « … »)
  // et pour exclure ces clients de la liste des contacts à rattacher.
  const entrepriseParCle = useMemo(() => {
    const m = new Map<string, { id: string; nom: string; role: string | null }>()
    for (const e of entreprises) for (const c of e.contacts) m.set(c.cle, { id: e.id, nom: e.nom, role: c.role })
    return m
  }, [entreprises])
  const entreprisesAffichees = useMemo(
    () => entreprisesSupprimeesLocalement.size === 0
      ? entreprises
      : entreprises.filter(e => !entreprisesSupprimeesLocalement.has(e.id)),
    [entreprises, entreprisesSupprimeesLocalement],
  )
  const entreprisesOptions = useMemo(() => entreprisesAffichees.map(e => ({ id: e.id, nom: e.nom })), [entreprisesAffichees])
  const entrepriseOuverte = entrepriseOuverteId ? entreprisesAffichees.find(e => e.id === entrepriseOuverteId) ?? null : null
  const entrepriseProfil = entrepriseOuverte
    ? buildEntrepriseProfile(entrepriseOuverte, entrepriseOuverte.sites, entrepriseOuverte.contacts, bookings, documents, new Date(maintenant), reglagesEffectifs)
    : null
  // Candidats au rattachement : tout le monde sauf les contacts DÉJÀ dans l'entreprise ouverte
  // (un client lié à une AUTRE entreprise reste proposé — le réassigner est permis, juste pas
  // vérifié comme un cas normal, voir `lib/entrepriseProfile.ts`).
  const contactsDisponibles = useMemo(
    () => clients.filter(c => entrepriseParCle.get(c.cle)?.id !== entrepriseOuverteId),
    [clients, entrepriseParCle, entrepriseOuverteId],
  )
  const aRelancer: LigneARelancer[] = useMemo(
    () => reglagesMessages
      ? clientsARelancer(bookings.map(versRdvMessage), reglagesMessages, reglagesEffectifs, maintenant)
      : [],
    [bookings, reglagesMessages, reglagesEffectifs, maintenant],
  )
  const parFiltre = useMemo(
    () => (filtre === 'pros' ? clients.filter(c => c.isProfessional) : clients),
    [clients, filtre],
  )
  const affiches = useMemo(() => rechercherClients(parFiltre, recherche), [parFiltre, recherche])
  // Les masqués disparaissent dès qu'une recherche est en cours (on n'a ni leur téléphone ni
  // leur email, rien sur quoi chercher), et hors de l'onglet « Tous »/« Pros » — même règle
  // que ClientsViewV1.tsx.
  const bloquesAffiches = filtre === 'relancer' || filtre === 'entreprises' || recherche.trim() ? [] : bloques
  const limite = visibles[filtre]
  const chargerPlus = () => setVisibles(v => ({ ...v, [filtre]: v[filtre] + pas }))
  const bloquesVus = bloquesAffiches.slice(0, limite)
  const affichesVus = affiches.slice(0, Math.max(0, limite - bloquesVus.length))
  const totalClients = bloquesAffiches.length + affiches.length
  // Replier ramène au lot précédent de ce qui est RÉELLEMENT affiché (pas de la limite, qui peut
  // dépasser le total après un dernier « Charger plus » partiel).
  const chargerMoins = (total: number) => setVisibles(v => {
    const affiche = Math.min(v[filtre], total)
    return { ...v, [filtre]: Math.max(PAS_AFFICHAGE, (Math.ceil(affiche / PAS_AFFICHAGE) - 1) * PAS_AFFICHAGE) }
  })
  const fiche = ouvert ? buildClientProfile(bookings, ouvert, new Date(maintenant), documents, reglagesEffectifs) : null
  // Doublon probable (menu « … » de la fiche, 2026-09-28) : calculé ici, pas dans la fiche —
  // c'est cet écran qui connaît TOUT le fichier (`clients`), une fiche ouverte ne voit qu'elle-même.
  const doublon = fiche ? trouverDoublon(fiche, clients) : null
  // Panneau à côté plutôt que feuille par-dessus (voir l'en-tête du fichier) : seulement là où
  // cliquer une ligne ouvre CETTE fiche (`ouvert`/`fiche` ci-dessus) — pas dans l'onglet
  // « Entreprises », qui ouvre `FicheEntrepriseV2` en plein écran (branche `entrepriseProfil`
  // ci-dessus), inchangée par cette passe.
  const modoBureauListe = grandEcran && filtre !== 'entreprises'

  // Le CONTENU de l'onglet courant (liste + pagination) — strictement le même JSX qu'avant
  // cette passe, en variable plutôt qu'inline pour pouvoir le poser SOIT seul (comportement
  // d'avant), SOIT à gauche d'un panneau de fiche (`modoBureauListe`, plus bas). Aucune logique
  // n'a bougé ici : seul l'endroit où ce résultat est posé dans la page change.
  const contenuListe = filtre === 'relancer' ? (
    aRelancer.length === 0 ? (
      <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
        Tous vos clients sont revenus, ou n’ont pas encore de quoi être relancés.
      </p>
    ) : (
      <>
      <ul aria-label="Clients à relancer" className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] overflow-hidden">
        {aRelancer.slice(0, limite).map(l => (
          <LigneARelancerVue
            key={l.cle}
            ligne={l}
            onOuvrir={() => setOuvert(l.cle)}
            selectionnee={modoBureauListe && ouvert === l.cle}
            ouverte={ligneOuverte === l.cle}
            onOuvrirLigne={() => setLigneOuverte(l.cle)}
            onFermerLigne={() => setLigneOuverte(o => (o === l.cle ? null : o))}
            onSupprimer={() => { setAnnulationRelanceErreur(null); setAnnulationRelance(l) }}
          />
        ))}
      </ul>
      <PaginationListe total={aRelancer.length} limite={limite} onPlus={chargerPlus} onMoins={() => chargerMoins(aRelancer.length)} />
      </>
    )
  ) : filtre === 'entreprises' ? (
    <>
    <ul aria-label="Entreprises" className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] overflow-hidden">
      {entreprisesAffichees.slice(0, limite).map(e => (
        <LigneEntreprise
          key={e.id}
          entreprise={e}
          onOuvrir={() => setEntrepriseOuverteId(e.id)}
          ouverte={ligneOuverte === e.id}
          onOuvrirLigne={() => setLigneOuverte(e.id)}
          onFermerLigne={() => setLigneOuverte(o => (o === e.id ? null : o))}
          onSupprimer={() => { setSuppressionEntrepriseErreur(null); setEntrepriseASupprimer(e) }}
        />
      ))}
    </ul>
    <PaginationListe
      total={entreprisesAffichees.length}
      limite={limite}
      onPlus={chargerPlus}
      onMoins={() => chargerMoins(entreprisesAffichees.length)}
    />
    </>
  ) : (
    <>
      {(recherche.trim() || affiches.length === 0) && (
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`} aria-live="polite">
          {affiches.length === 0
            ? recherche.trim()
              ? `Aucun client ne correspond à « ${recherche.trim()} ».`
              : 'Aucun client professionnel pour l’instant.'
            : `${affiches.length} client${affiches.length > 1 ? 's' : ''} trouvé${affiches.length > 1 ? 's' : ''}`}
        </p>
      )}

      {(affiches.length > 0 || bloquesAffiches.length > 0) && (
        <ul aria-label="Liste des clients" className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] overflow-hidden">
          {bloquesVus.map(b => (
            <LigneClientVerrouilleeV2 key={b.id} reservation={b} offre={offreDeblocage} />
          ))}
          {affichesVus.map(c => (
            <LigneClient
              key={c.cle}
              client={c}
              maintenant={maintenant}
              onOuvrir={() => setOuvert(c.cle)}
              selectionnee={modoBureauListe && ouvert === c.cle}
              ouverte={ligneOuverte === c.cle}
              onOuvrirLigne={() => setLigneOuverte(c.cle)}
              onFermerLigne={() => setLigneOuverte(o => (o === c.cle ? null : o))}
              onSupprimer={() => { setSuppressionErreur(null); setSuppression(c) }}
            />
          ))}
        </ul>
      )}
      <PaginationListe total={totalClients} limite={limite} onPlus={chargerPlus} onMoins={() => chargerMoins(totalClients)} />
    </>
  )

  // La Fiche entreprise REMPLACE l'écran Clients (comme une destination à part), pas une
  // feuille par-dessus : c'est un fichier en soi (contacts, sites), pas le détail d'une ligne.
  // La Fiche d'UN CONTACT, elle, reste une feuille qui monte par-dessus — cohérent avec le reste
  // de l'écran, et elle sait y revenir (`onOuvrirEntreprise`).
  if (entrepriseProfil) {
    return (
      <>
        <FicheEntrepriseV2
          profil={entrepriseProfil}
          clientsDisponibles={contactsDisponibles}
          nomLaveur={nomLaveur ?? ''}
          onOuvrirContact={cle => { setEntrepriseOuverteId(null); setOuvert(cle) }}
          onClose={() => setEntrepriseOuverteId(null)}
        />
        {fiche && (
          <ClientProfileModal
            profile={fiche}
            onClose={() => setOuvert(null)}
            entrepriseDuContact={entrepriseParCle.get(fiche.cle) ?? null}
            entreprisesDisponibles={entreprisesOptions}
            onOuvrirEntreprise={id => { setOuvert(null); setEntrepriseOuverteId(id) }}
            doublon={doublon}
            nomLaveur={nomLaveur}
          />
        )}
      </>
    )
  }

  return (
    <div
      // Passe « châssis bureau » (2026-10-05) : ce plafond de 768px et sa compensation de
      // marge (`-mx-3 sm:-mx-4 -mt-6`, qui annulait le padding de l'ancien `<main>` de
      // DashboardShell pour reposer le sien) n'ont de sens que sous CETTE largeur — c'est-à-dire
      // quand `grandEcran` est faux. Un `ClientsViewV2` qui s'affiche avec `grandEcran` vrai ne
      // tourne JAMAIS dans ce `<main>`-là : `ClientsView.tsx` ne choisit ce composant que
      // derrière `useDashboardV2()`, qui est vrai dans ce cas précisément parce que
      // DashboardShell a basculé sur le rail (voir DashboardShell.tsx, `showRailBureau`) — un
      // châssis qui ne pose ni padding ni marge à annuler, le contenu gère directement sa
      // propre largeur. Sans cette condition, le panneau de fiche posé à côté de la liste
      // (`modoBureauListe` plus bas) resterait écrasé dans cette même colonne de 768px : le
      // bug que cette passe corrige.
      className={`${grandEcran ? '' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6'} space-y-5 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={`text-[21px] ${titre}`}>Clients</h1>
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1`}>
          {filtre === 'relancer' ? (
            <span className="tabular-nums">{aRelancer.length} client{aRelancer.length > 1 ? 's' : ''} pas revenu{aRelancer.length > 1 ? 's' : ''}</span>
          ) : filtre === 'entreprises' ? (
            <span className="tabular-nums">{entreprisesAffichees.length} entreprise{entreprisesAffichees.length > 1 ? 's' : ''}</span>
          ) : clients.length === 0 ? (
            'Vos clients apparaîtront ici dès leur première réservation.'
          ) : pros > 0 ? (
            <span className="tabular-nums">{clients.length} client{clients.length > 1 ? 's' : ''} · {pros} pro{pros > 1 ? 's' : ''}</span>
          ) : (
            <span className="tabular-nums">{clients.length} client{clients.length > 1 ? 's' : ''}</span>
          )}
        </p>
        {filtre !== 'relancer' && filtre !== 'entreprises' && bloques.length > 0 && (
          <p className={`text-[13px] mt-0.5 ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
            {bloques.length} masqué{bloques.length > 1 ? 's' : ''}
            {montantBloque > 0 && ` · ${formatEuros(montantBloque)} € de lavages`}
          </p>
        )}
      </div>

      {/* Fichier vide, en grand écran (écran 35 de la maquette bureau) : la ligne grise
          au-dessus suffit sur téléphone, mais à cette largeur un simple mot perdu dans un coin
          se lit comme un oubli plutôt qu'un choix (règle du contrat de la maquette : « un
          écran plein, pas un écran à moitié vide »). Repris : seulement le titre en forme de
          question et le paragraphe d'explication — la maquette propose aussi deux cartes
          d'action (« Partager mon lien de réservation », « Importer mes clients (Excel) ») qui
          n'ont pas été construites ici : la première demande le slug public du laveur, que cet
          écran ne reçoit pas aujourd'hui (ajout simple mais hors de cette passe) ; la seconde ne
          correspond à AUCUNE fonction existante dans le dépôt — l'inventer aurait affiché un
          bouton qui ne fait rien. Voir le rapport de la passe. */}
      {grandEcran && clients.length === 0 && bloques.length === 0 && (
        <div className="flex h-[420px] items-center justify-center rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] px-8 text-center">
          <div className="max-w-[420px]">
            <p className={`text-[22px] leading-snug ${titre}`}>D’où viendront vos premiers clients ?</p>
            <p className={`mt-2.5 text-[13.5px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
              Pas besoin de les ajouter à la main : dès qu’une réservation arrive sur votre page,
              la personne devient un client ici, avec son historique qui se construit tout seul.
            </p>
          </div>
        </div>
      )}

      {(clients.length > 0 || bloques.length > 0) && (
        <>
          {filtre !== 'relancer' && filtre !== 'entreprises' && (
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--v2-color-gris)] pointer-events-none" aria-hidden />
              <input
                id="recherche-clients"
                type="search"
                inputMode="search"
                value={recherche}
                onChange={e => setRecherche(e.target.value)}
                placeholder="Nom, téléphone, adresse"
                aria-label="Rechercher un client"
                autoComplete="off"
                className={`w-full h-11 pl-11 pr-11 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40 [&::-webkit-search-cancel-button]:hidden`}
              />
              {recherche && (
                <button
                  type="button"
                  onClick={() => setRecherche('')}
                  aria-label="Effacer la recherche"
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto">
            {([
              ['tous', 'Tous'],
              ['pros', 'Pros'],
              // Le laveur qui n'a pas encore réglé de relance a quand même le droit de voir qui
              // n'est pas revenu : voir le mode « pas de relance programmée » de clientsARelancer.
              ...(reglagesMessages ? [['relancer', 'À relancer'] as const] : []),
              // Masqué tant qu'aucune entreprise n'existe : un onglet vide n'aiderait personne
              // (Alexandre, 2026-09-28 — sans lui, une entreprise ne se retrouvait qu'en
              // rouvrant le contact qui a servi à la créer).
              ...(entreprisesAffichees.length > 0 ? [['entreprises', 'Entreprises'] as const] : []),
            ] as const).map(([f, libelle]) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                aria-pressed={filtre === f}
                className={`shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} transition-colors ${
                  filtre === f
                    ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]'
                    : 'bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] border border-[color:var(--v2-filet-fort)]'
                }`}
              >
                {libelle}
              </button>
            ))}
          </div>

          {modoBureauListe ? (
            // Passe bureau : la liste garde EXACTEMENT le même JSX (`contenuListe`, défini
            // juste au-dessus de ce `return`) — seule la mise en page qui l'entoure change,
            // pour lui faire de la place à côté de la fiche. Hauteur fixe choisie à l'oeil
            // (600px, pas mesurée sur la maquette) — et TOUJOURS pas corrigée à la passe
            // « châssis bureau » (2026-10-05, DashboardShell.tsx/RailBureauV2.tsx) qui construit
            // enfin le rail à côté : cette passe a changé l'extérieur (plus de plafond à 768px
            // qui écrasait ce bloc, voir le commentaire de `className` plus haut), pas
            // l'intérieur. 600px reste une valeur à l'oeil, indépendante de la hauteur réelle de
            // la fenêtre — à revoir dans une passe qui s'attaque spécifiquement au contenu de cet
            // écran plutôt qu'à son châssis.
            // Hauteur : plus de 600px figés. On retranche du haut de la fenêtre ce que le
            // châssis occupe déjà (bandeau, titre, recherche, pastilles) pour que les deux
            // panneaux descendent jusqu’en bas de l’écran quelle qu’en soit la taille, avec
            // un plancher pour les très petites hauteurs.
            <div className="flex gap-4" style={{ height: 'max(420px, calc(100vh - 268px))' }}>
              {/* 380px, la valeur de la maquette : à 280 les noms d’entreprise étaient
                  tronqués et chaque ligne retombait sur trois niveaux. */}
              <div className="h-full min-w-0 w-[380px] shrink-0 space-y-3 overflow-y-auto">
                {contenuListe}
              </div>
              <div className="h-full min-w-0 flex-1">
                {fiche ? (
                  <ClientProfileModal
                    key={fiche.cle}
                    profile={fiche}
                    onClose={() => setOuvert(null)}
                    entrepriseDuContact={entrepriseParCle.get(fiche.cle) ?? null}
                    entreprisesDisponibles={entreprisesOptions}
                    onOuvrirEntreprise={id => { setOuvert(null); setEntrepriseOuverteId(id) }}
                    doublon={doublon}
                    nomLaveur={nomLaveur}
                    v2
                    panneau
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-6 text-center">
                    <Users2 size={22} strokeWidth={1.8} className="text-[color:var(--v2-color-gris)]" aria-hidden />
                    <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                      Sélectionnez un client pour voir sa fiche.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : contenuListe}
        </>
      )}

      {automatismes && <AutomatismesClientsV2 automatismes={automatismes} />}

      {/* Raccourci vers Chiffres, dupliqué depuis « Plus » (demande d'Alexandre,
          2026-10-01) : Chiffres reste dans « Plus », qui garde sa ligne — ici,
          c'est le même écran, pas une copie, pour qui consulte ses chiffres
          juste après avoir regardé ses clients plutôt que de rouvrir le
          menu. */}
      <section aria-label="Chiffres">
        <TitreSection>L’argent</TitreSection>
        <CarteListe>
          <Ligne label="Chiffres" sousLabel="Argent, acquisition, clients" href="/dashboard/chiffres" />
        </CarteListe>
      </section>

      {/* En mode bureau, cette fiche est déjà posée dans le panneau à côté de la liste
          (`modoBureauListe`, plus haut) : ne pas la reposer ICI en plus, par-dessus — elle
          serait affichée deux fois. */}
      {!modoBureauListe && fiche && (
        <ClientProfileModal
          key={fiche.cle}
          profile={fiche}
          onClose={() => setOuvert(null)}
          entrepriseDuContact={entrepriseParCle.get(fiche.cle) ?? null}
          entreprisesDisponibles={entreprisesOptions}
          onOuvrirEntreprise={id => { setOuvert(null); setEntrepriseOuverteId(id) }}
          doublon={doublon}
          nomLaveur={nomLaveur}
        />
      )}

      {suppression && (
        <ConfirmationSuppression
          titre={`Supprimer ${suppression.isProfessional && suppression.companyName ? suppression.companyName : suppression.name} ?`}
          texte="Il disparaît de votre fichier. Ses réservations et ses documents restent intacts — rien n’est supprimé de son historique ni de vos chiffres."
          enCours={suppressionEnCours}
          erreur={suppressionErreur}
          onConfirmer={() => void confirmerSuppressionClient()}
          onClose={() => setSuppression(null)}
        />
      )}

      {annulationRelance && (
        <ConfirmationSuppression
          titre={`Ne plus relancer ${annulationRelance.nom} ?`}
          texte="Il ne recevra plus ni relance, ni demande d’avis. Il reste dans votre fichier — vous pouvez toujours l’appeler ou lui écrire vous-même."
          libelleAction="Ne plus relancer"
          libelleEnCours="Enregistrement…"
          enCours={annulationRelanceEnCours}
          erreur={annulationRelanceErreur}
          onConfirmer={() => void confirmerAnnulationRelance()}
          onClose={() => setAnnulationRelance(null)}
        />
      )}

      {entrepriseASupprimer && (
        <ConfirmationSuppression
          titre={`Supprimer « ${entrepriseASupprimer.nom} » ?`}
          texte="Ses sites disparaissent avec elle. Ses contacts redeviennent de simples clients : ils gardent toutes leurs réservations et leurs documents, rien n'est supprimé de leur côté."
          enCours={suppressionEntrepriseEnCours}
          erreur={suppressionEntrepriseErreur}
          onConfirmer={() => void confirmerSuppressionEntreprise()}
          onClose={() => setEntrepriseASupprimer(null)}
        />
      )}
    </div>
  )
}

function LigneClient({ client: c, maintenant, onOuvrir, selectionnee, ouverte, onOuvrirLigne, onFermerLigne, onSupprimer }: {
  client: ResumeClient
  maintenant: number
  onOuvrir: () => void
  /** Fiche de ce client affichée dans le panneau d’à côté (mode bureau seulement). */
  selectionnee: boolean
  ouverte: boolean
  onOuvrirLigne: () => void
  onFermerLigne: () => void
  onSupprimer: () => void
}) {
  const titreClient = c.isProfessional && c.companyName ? c.companyName : c.name
  const pastille = pastilleDroite(c, maintenant)
  const { refLigne, poignee, styleContenu, clicAbsorbe } = useLigneGlissante({
    ouverte, onOuvrir: onOuvrirLigne, onFermer: onFermerLigne,
  })

  return (
    <li ref={refLigne} className="relative overflow-hidden">
      {/* Derrière la ligne : cachée tant qu'on n'a pas glissé, retirée de l'ordre de
          tabulation — un client se supprime aussi depuis sa fiche (menu « … »), pas seulement
          d'ici. */}
      <button
        type="button"
        onClick={onSupprimer}
        tabIndex={ouverte ? 0 : -1}
        aria-hidden={!ouverte}
        aria-label={`Supprimer ${titreClient}`}
        className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 text-[12px] text-white ${corpsFort}`}
        style={{ width: LARGEUR_ACTION_PX, background: 'var(--v2-color-rouge)' }}
      >
        <Trash2 size={20} strokeWidth={2} aria-hidden />
        Supprimer
      </button>
      <div
        {...poignee}
        style={styleContenu}
        className="relative bg-[color:var(--v2-color-surface)] motion-reduce:!transition-none"
      >
        <button
          type="button"
          onClick={() => { if (!clicAbsorbe()) onOuvrir() }}
          aria-label={`Voir la fiche de ${titreClient}`}
          aria-current={selectionnee ? 'true' : undefined}
          className={`w-full flex items-start gap-3 px-4 py-3 text-left focus:outline-none focus-visible:bg-[color:var(--v2-filet)] transition-colors ${
            selectionnee ? 'bg-[color:var(--v2-filet)]' : 'hover:bg-[color:var(--v2-filet)]'
          }`}
        >
          <span
            className={`w-9 h-9 shrink-0 flex items-center justify-center text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)] ${
              c.isProfessional ? 'rounded-[var(--v2-radius-carte)]' : 'rounded-full'
            }`}
          >
            {initiales(titreClient)}
          </span>

          <span className="flex-1 min-w-0">
            <span className={`block text-[15px] ${nom} truncate`}>{titreClient}</span>
            <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>
              {ligneSecondaire(c, maintenant)}
            </span>
          </span>

          <span className={`shrink-0 text-right text-[12.5px] ${corpsFort} tabular-nums ${pastille.couleur}`}>
            {pastille.texte}
          </span>
        </button>
      </div>
    </li>
  )
}

/** Couleur du statut : rouge pour ce qui attend un appel maintenant, gris pour ce qui n'attend
 *  plus d'action automatique (relance déjà partie, client qui ne veut plus), vert sinon —
 *  une relance programmée est une bonne nouvelle en soi, elle n'a pas besoin d'un appel. */
function couleurStatut(l: LigneARelancer): string {
  if (l.urgent) return 'text-[color:var(--v2-color-rouge)]'
  if (l.nePlusContacter || l.statut.startsWith('Relancé')) return 'text-[color:var(--v2-color-gris)]'
  return 'text-[color:var(--v2-color-vert)]'
}

function LigneARelancerVue({ ligne: l, onOuvrir, selectionnee, ouverte, onOuvrirLigne, onFermerLigne, onSupprimer }: {
  ligne: LigneARelancer
  onOuvrir: () => void
  /** Voir `LigneClient`. */
  selectionnee: boolean
  ouverte: boolean
  onOuvrirLigne: () => void
  onFermerLigne: () => void
  onSupprimer: () => void
}) {
  const { refLigne, poignee, styleContenu, clicAbsorbe } = useLigneGlissante({
    ouverte, onOuvrir: onOuvrirLigne, onFermer: onFermerLigne,
  })
  return (
    <li ref={refLigne} className="relative overflow-hidden">
      {/* « Supprimer » ici annule la relance (« ne plus contacter ») — voir l'en-tête du
          fichier : ce n'est pas un masquage, la ligne reste visible ensuite en « Ne veut plus ». */}
      <button
        type="button"
        onClick={onSupprimer}
        tabIndex={ouverte ? 0 : -1}
        aria-hidden={!ouverte}
        aria-label={`Ne plus relancer ${l.nom}`}
        className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 text-[12px] text-white ${corpsFort}`}
        style={{ width: LARGEUR_ACTION_PX, background: 'var(--v2-color-rouge)' }}
      >
        <Trash2 size={20} strokeWidth={2} aria-hidden />
        Supprimer
      </button>
      <div
        {...poignee}
        style={styleContenu}
        className="relative bg-[color:var(--v2-color-surface)] motion-reduce:!transition-none"
      >
        <button
          type="button"
          onClick={() => { if (!clicAbsorbe()) onOuvrir() }}
          aria-label={`Voir la fiche de ${l.nom}`}
          aria-current={selectionnee ? 'true' : undefined}
          className={`w-full flex items-start gap-3 px-4 py-3 text-left focus:outline-none focus-visible:bg-[color:var(--v2-filet)] transition-colors ${
            selectionnee ? 'bg-[color:var(--v2-filet)]' : 'hover:bg-[color:var(--v2-filet)]'
          }`}
        >
          <span className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)]`}>
            {initiales(l.nom)}
          </span>

          <span className="flex-1 min-w-0">
            <span className={`block text-[15px] ${nom} truncate`}>{l.nom}</span>
            <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5 truncate`}>
              {l.detail}
            </span>
          </span>

          <span className="shrink-0 flex flex-col items-end gap-0.5">
            <span className={`text-[12.5px] ${corpsFort} tabular-nums text-[color:var(--v2-color-gris)]`}>
              {l.jours} j
            </span>
            <span className={`text-[11.5px] ${corpsFort} ${couleurStatut(l)}`}>{l.statut}</span>
          </span>
        </button>
      </div>
    </li>
  )
}

function LigneEntreprise({ entreprise: e, onOuvrir, ouverte, onOuvrirLigne, onFermerLigne, onSupprimer }: {
  entreprise: EntrepriseListItem
  onOuvrir: () => void
  ouverte: boolean
  onOuvrirLigne: () => void
  onFermerLigne: () => void
  onSupprimer: () => void
}) {
  const { refLigne, poignee, styleContenu, clicAbsorbe } = useLigneGlissante({
    ouverte, onOuvrir: onOuvrirLigne, onFermer: onFermerLigne,
  })
  return (
    <li ref={refLigne} className="relative overflow-hidden">
      <button
        type="button"
        onClick={onSupprimer}
        tabIndex={ouverte ? 0 : -1}
        aria-hidden={!ouverte}
        aria-label={`Supprimer ${e.nom}`}
        className={`absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-1 text-[12px] text-white ${corpsFort}`}
        style={{ width: LARGEUR_ACTION_PX, background: 'var(--v2-color-rouge)' }}
      >
        <Trash2 size={20} strokeWidth={2} aria-hidden />
        Supprimer
      </button>
      <div
        {...poignee}
        style={styleContenu}
        className="relative bg-[color:var(--v2-color-surface)] motion-reduce:!transition-none"
      >
        <button
          type="button"
          onClick={() => { if (!clicAbsorbe()) onOuvrir() }}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[color:var(--v2-filet)] focus:outline-none focus-visible:bg-[color:var(--v2-filet)] transition-colors"
        >
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--v2-radius-carte)] text-[13px] ${corpsFort} text-[color:var(--v2-color-encre)] bg-[color:var(--v2-filet)]`}>
            {initiales(e.nom)}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block text-[15px] ${nom} truncate`}>{e.nom}</span>
            <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-0.5`}>
              {e.contacts.length} contact{e.contacts.length > 1 ? 's' : ''}
              {e.sites.length > 0 && ` · ${e.sites.length} site${e.sites.length > 1 ? 's' : ''}`}
            </span>
          </span>
        </button>
      </div>
    </li>
  )
}
