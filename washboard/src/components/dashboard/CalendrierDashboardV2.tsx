'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CalendarX2, ChevronLeft, ChevronRight, Mail, Navigation, Phone, Plus, Users2, X } from 'lucide-react'
import MoisV2 from '@/components/dashboard/MoisV2'
import { effectiveDuration, addonsDuration, formatPrice } from '@/lib/pricing'
import { toDateStr } from '@/lib/dateUtils'
import { dayKey, formatHeure, isSameDay } from '@/lib/calendarLayout'
import { villeDepuisAdresse } from '@/lib/adresse'
import { doitDemanderConfirmation, montantPrevu, statutAffiche, type StatutAffiche } from '@/lib/cloture'
import { useTrajetsRdv } from '@/hooks/useTrajetsRdv'
import { useRendezVousFiche } from '@/hooks/useRendezVousFiche'
import { useRendezVousManuel } from '@/hooks/useRendezVousManuel'
import { useConges } from '@/hooks/useConges'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ConfirmerClotureV2 from '@/components/dashboard/ConfirmerClotureV2'
import { Feuille } from '@/components/dashboard/FeuilleV2'
import RendezVousManuelV2 from '@/components/dashboard/RendezVousManuelV2'
import ProposerCreneauV2, { type OrigineCreneau } from '@/components/dashboard/ProposerCreneauV2'
import FeuilleGoogleAgendaV2, { issueDepuisParametre } from '@/components/dashboard/FeuilleGoogleAgendaV2'
import { BandeauConge, CongesAVenir, FeuilleAjoutConge, FeuilleSuppressionConge } from '@/components/dashboard/CongesV2'
import type { Booking, CalendrierProps, Unavailability } from '@/components/dashboard/CalendrierDashboardV1'
import { JoursMasquesV2, CarteJourVerrouilleeV2 } from '@/components/dashboard/ReservationVerrouilleeV2'
import { useBloquerDefilement, useGlisserPourFermer } from '@/hooks/useFeuilleTactile'
import { annoncerApresRetour } from '@/lib/confirmationEnvoi'
import ChoixItineraireV2 from '@/components/dashboard/ChoixItineraireV2'
import { semainesDuMois, compterActifsParJour, pointsRendezVous } from '@/lib/vueMois'

// Agenda, présentation v2 — réservée à la PWA installée en mode standalone
// (voir CalendrierDashboard.tsx, le point de branchement ; décision
// d'Alexandre, 2026-09-22 : le site reste v1 sans exception). Passe 7 de la
// refonte 2026, sous-lot 3 sur 3 — voir le compte rendu de la passe pour le
// découpage complet.
//
// Planche `project/Agenda.dc.html` : une journée à la fois (bandeau de 7
// jours en haut, pas de bascule mois/semaine/jour comme en v1), une ligne de
// temps verticale, le temps de route estimé entre deux jobs, un résumé en
// bas de journée. Chaque carte de rendez-vous pointe vers `Fiche.dc.html`
// dans la maquette — le même artboard que la fiche client, réutilisé comme
// lien de prototype plutôt qu'un artboard dédié à la fiche de rendez-vous
// actionnable : aucune référence de maquette ne couvre les actions
// (statut/reprogrammation/note/facture) construites dans ce sous-lot. Elles
// suivent donc les conventions déjà établies ailleurs en v2 (feuille,
// boutons Appeler/Message de ClientProfileModalV2.tsx, « point plein + le
// mot » pour les statuts), pas une maquette précise à reproduire au pixel.
//
// Logique réutilisée telle quelle, jamais dupliquée : `cleStatut` vient de
// `@/lib/calendarLayout`. Le temps de route entre deux rendez-vous vient de
// `useTrajetsRdv` (trajet en voiture réel via Google). `Booking`/`CalendrierProps` viennent de
// CalendrierDashboardV1.tsx : une seule définition de la forme des données
// envoyées par `calendrier/page.tsx`. Les quatre actions de la fiche
// (changer de statut, reprogrammer, écrire une note, émettre une facture)
// viennent de `useRendezVousFiche` (`src/hooks/useRendezVousFiche.ts`),
// extrait de CalendrierDashboardV1.tsx pendant ce sous-lot pour que v1 ET v2
// la partagent au lieu d'en dupliquer ~400 lignes fortement couplées à la
// liste complète des rendez-vous et des congés — voir ce fichier pour le
// détail. `ConfirmerClotureV2.tsx` est la seule pièce dupliquée (présentation
// pure, même logique `doitDemanderConfirmation`), pour les mêmes raisons que
// `ClientProfileModalV1`/`V2` divergent sur les statuts : aucune source
// commune de styles entre les deux langages visuels.
//
// **Sous-lot 3 : rendez-vous manuel et congés.** Ni l'un ni l'autre n'est sur
// l'artboard `Agenda.dc.html` ; construits avec les conventions v2 déjà
// posées. La logique vient de `useRendezVousManuel` et `useConges`
// (`src/hooks/`), extraits de CalendrierDashboardV1.tsx comme
// `useRendezVousFiche` l'avait été au sous-lot 2 ; la présentation vit dans
// `FeuilleV2.tsx` (feuille du bas générique), `RendezVousManuelV2.tsx` et
// `CongesV2.tsx`.
//   - Entrée unique : un « + » en haut à droite, à côté du titre. Pas de
//     bouton flottant en bas : la barre de navigation du bas (BarreBasV2) et
//     le bouton WhatsApp l'occupent déjà, un troisième objet flottant y
//     serait touché par erreur. Le « + » ouvre une feuille à deux choix
//     (nouveau rendez-vous / bloquer une période) : un seul point d'entrée à
//     retenir, un tap de plus pour l'action la plus fréquente, mais rien à
//     deviner. Les deux actions se préremplissent avec le jour affiché.
//   - Congés : un bandeau en tête du jour concerné (avec Supprimer), un point
//     sous le jour dans le bandeau des 7 jours, et une liste « Congés à venir »
//     en bas d'écran pour tout voir sans feuilleter les semaines.
//
// **Depuis (ajout du 2026-09-24, hors sous-lot) :** un nom de ville par
// rendez-vous (`villeDepuisAdresse`, voir RendezVousCarte plus bas — `null`
// sans invention quand l'adresse ne le donne pas sans ambiguïté) et le bouton
// « Proposer » sur un créneau libre, décidé ce jour-là par Alexandre : il ouvre
// `ProposerCreneauV2.tsx`, une feuille qui liste les clients du laveur et part
// vers WhatsApp ou SMS avec un message déjà écrit — voir ce fichier pour le
// détail (aucune table, aucune route, rien envoyé automatiquement).
//
// **Vue du mois (ajout du 2026-09-24, demande d'Alexandre, modèle : le
// Calendrier d'Apple).** L'agenda garde son bandeau de 7 jours comme vue
// d'arrivée ; la vue « mois » (`MoisV2.tsx`, défilement continu de mois en mois)
// s'ouvre par-dessus, et toucher un jour y ramène l'agenda positionné sur cette
// date. Deux entrées visibles en haut : le titre du mois (« Septembre ») et un
// bouton grille à côté du « + ». Le lien `?rdv=` n'y touche pas : la vue mois ne
// s'ouvre que sur un geste, l'agenda reste toujours la page d'arrivée.
// L'agenda reste monté dessous (`inert` tant que la vue est ouverte) : rien de
// ce qu'il tient — jour affiché, trajets déjà calculés — n'est perdu ni
// recalculé au retour.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

const JOURS_INITIALE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Même convention que ClientProfileModalV2.tsx (planche Système : « les
// statuts sont un point plein + le mot, jamais une pastille pastel ») —
// Terminé en gris, pas en bleu comme l'ancienne fiche l'inventait. Dupliqué
// ici volontairement (présentation, pas calcul) : les deux écrans n'ont pas
// encore de source commune pour ce tableau de libellés/couleurs.
const STATUT: Record<StatutAffiche, { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  a_cloturer: { couleur: 'var(--v2-color-ambre)', label: 'À clôturer' },
}

// En dessous, un gain de temps n'est pas montré : la maquette ne montre
// qu'un seul créneau libre notable (2 h), pas les petits écarts entre deux
// jobs enchaînés.
const SEUIL_LIBRE_MIN = 30

function dureeLisible(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

/** Montant réellement facturé pour ce rendez-vous — même logique que le
 *  modal de détail v1 (`booked_price` prime, remise smart slot déduite). */
function montant(b: Booking): number {
  const base = b.booked_price ?? b.services?.price ?? 0
  return b.is_smart_slot && Number(b.smart_discount) > 0 ? base - Number(b.smart_discount) : base
}

function prixAffiche(b: Booking): string {
  return b.is_smart_slot && Number(b.smart_discount) > 0 ? formatPrice(montant(b)) : `${montant(b)} €`
}

/** Catégorie · nom de la prestation — même repli que le modal de détail v1
 *  (`selected.services.service_categories?.name` puis `.name`), pas le
 *  véhicule/l'option que montre la maquette au cas par cas : les déduire
 *  demanderait une règle de mise en forme différente pour chaque type de
 *  prestation, non couverte par une fonction existante. */
// Icônes reprises telles quelles de la planche `project/Agenda.dc.html`
// (mêmes tracés, mêmes épaisseurs) — la couleur passe par le jeton v2 plutôt
// que par le gris codé en dur de la maquette, pour suivre le mode sombre.
function IconeRoute() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="18" cy="5.5" r="2.5" />
      <path d="M8.5 18.5h7a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7h6" />
    </svg>
  )
}

/** Grille d'un mois (bouton d'entrée de la vue du mois) : un cadre, un bandeau
 *  en haut, deux colonnes et deux lignes. Se distingue de l'icône d'onglet
 *  « Agenda » de la barre du bas (calendrier à anneaux). */
function IconeMois() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="4" width="17" height="16.5" rx="2.5" />
      <path d="M3.5 9.5h17M9.2 9.5v11M14.8 9.5v11M3.5 15h17" />
    </svg>
  )
}

function IconeLieu() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}

/** Distance en kilomètres, à une décimale comme la maquette (« 9,2 km »). */
function km(valeur: number): string {
  return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** Modèle(s) de véhicule saisis par le client à la réservation, s'il y en a —
 *  même donnée que la fiche v1 et les emails (`vehicles_detail[].models`). */
function modeleVehicule(b: Booking): string | null {
  const modeles = (b.vehicles_detail ?? []).flatMap(v => (v.models ?? []).map(m => m.trim()).filter(Boolean))
  if (modeles.length === 0) return null
  return modeles.length === 1 ? modeles[0] : `${modeles[0]} +${modeles.length - 1}`
}

function lignePrestation(b: Booking): string {
  if (!b.services) return 'Prestation'
  // Avec un modèle, il remplace la catégorie : « Lavage complet · Tiguan » dit
  // plus au laveur que « Voiture · Lavage complet » (planche Agenda).
  const modele = modeleVehicule(b)
  if (modele) return `${b.services.name} · ${modele}`
  return b.services.service_categories?.name
    ? `${b.services.service_categories.name} · ${b.services.name}`
    : b.services.name
}

/** D'où mesurer la distance des clients : le rendez-vous qui précède le trou, ou à défaut celui
 *  qui le suit (quand le précédent n'a ni coordonnées ni adresse). */
function origineDuTrou(precedent: Booking, suivant: Booking): OrigineCreneau {
  const position = (b: Booking) => (typeof b.lat === 'number' && typeof b.lng === 'number' ? { lat: b.lat, lng: b.lng } : null)
  const adresse = (b: Booking) => b.address?.trim() || null
  // Le précédent d'abord (ses coordonnées, sinon son adresse), puis le suivant.
  for (const [b, voisin] of [[precedent, 'précédent'], [suivant, 'suivant']] as const) {
    const p = position(b)
    if (p) return { position: p, adresse: adresse(b), voisin }
    const a = adresse(b)
    if (a) return { position: null, adresse: a, voisin }
  }
  return { position: null, adresse: null, voisin: 'précédent' }
}

function finRendezVous(b: Booking): Date {
  const duree = effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count)
  return new Date(new Date(b.scheduled_at).getTime() + duree * 60_000)
}

type Trajet = { minutes: number; km: number } | null

// ── Passe bureau (2026-10-06) : la grille « semaine », écran 3 de la maquette bureau ──────────
//
// La grille a besoin d'une plage d'heures pour positionner les rendez-vous. Aucune des horaires
// d'ouverture (`availabilities`) n'est chargée par cet écran — ni par la v1, ni par la v2
// mobile — et en charger ici serait une requête nouvelle, hors du périmètre de cette passe (voir
// le rapport). La plage s'adapte donc seulement aux VRAIS rendez-vous de la semaine affichée,
// avec un plancher raisonnable (8h-19h, la plage déjà utilisée par la maquette) qu'elle élargit
// si besoin plutôt que de les couper.
const HEURE_MIN_DEFAUT = 8
const HEURE_MAX_DEFAUT = 19

function plageHeuresSemaine(joursActifs: Booking[][]): { debut: number; fin: number } {
  let debut = HEURE_MIN_DEFAUT
  let fin = HEURE_MAX_DEFAUT
  for (const jour of joursActifs) {
    for (const b of jour) {
      const d = new Date(b.scheduled_at)
      const h = d.getHours() + d.getMinutes() / 60
      if (h < debut) debut = Math.floor(h)
      const f = finRendezVous(b)
      const hf = f.getHours() + f.getMinutes() / 60
      if (hf > fin) fin = Math.ceil(hf)
    }
  }
  return { debut, fin: Math.max(fin, debut + 1) }
}

export default function CalendrierDashboardV2({ bookings: initialBookings, unavailabilities: initialUnavailabilities, teamSize, services, categories, washerId, facturationPrete, googleAgendaConnecte, joursMasques = [], masquees = [], offreDeblocage = 'Pro' }: CalendrierProps) {
  // Passe « bureau » (2026-10-06, Alexandre, 2026-10-03) : au-delà de `SEUIL_GRAND_ECRAN_PX`
  // (1024px, `grandEcran.ts`), même hook que ClientsViewV2.tsx/AccueilV2.tsx — pas un seuil
  // inventé en double. `false` au rendu serveur et jusqu'à l'hydratation : l'écran démarre donc
  // toujours en disposition téléphone, comme avant cette passe. `CalendrierDashboard.tsx` (le
  // point de branchement) a déjà décidé plus haut si cet écran v2 se montre du tout (PWA, ou
  // site + grand écran + `washer.beta_refonte`, voir `useDashboardV2.ts`) ; ici, la question est
  // seulement « ai-je la place pour une grille de semaine et un panneau de fiche à côté ».
  const grandEcran = useGrandEcran()
  // Trois onglets du châssis bureau (planche Agenda/Agenda-semaine/Agenda-mois), distincts de
  // `vue` plus bas (qui reste la mécanique mobile — bandeau de 7 jours / couche plein écran du
  // mois — inchangée). Seulement lu quand `grandEcran` est vrai.
  const [vueBureau, setVueBureau] = useState<'jour' | 'semaine' | 'mois'>('jour')
  const [today] = useState(() => new Date())
  const [dayDate, setDayDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [bookings, setBookings] = useState(initialBookings)
  const [menuAjout, setMenuAjout] = useState(false)
  // Vue d'arrivée = le bandeau de 7 jours (« semaine ») ; « mois » = la couche
  // plein écran de `MoisV2.tsx`.
  const [vue, setVue] = useState<'semaine' | 'mois'>('semaine')
  // Vrai pendant le zoom de la vue du mois vers le jour choisi : l'agenda s'avance.
  const [arrivee, setArrivee] = useState(false)
  // Créneau libre en cours de proposition à un client — voir ProposerCreneauV2.tsx.
  const [creneauPropose, setCreneauPropose] = useState<{ debut: Date; fin: Date; ville: string | null; origine: OrigineCreneau } | null>(null)

  // Congés — partagés avec CalendrierDashboardV1.tsx via `useConges`. Ils
  // possèdent l'état `unavails`, lu ensuite par les deux autres hooks pour
  // le calcul de capacité.
  const {
    unavails,
    addModal, setAddModal,
    delModal, setDelModal,
    uSaving,
    getUnavail, openAddModal, isFullyUnavailable, saveUnavail, deleteUnavail,
  } = useConges({ initialUnavailabilities, teamSize })

  // Rendez-vous manuel — partagé avec CalendrierDashboardV1.tsx via
  // `useRendezVousManuel`. `onCree` place l'agenda sur le jour du rendez-vous
  // qu'on vient de créer : sans ça, créer un rendez-vous pour un autre jour
  // que celui affiché ne montrerait rien de changé.
  const {
    manualModal, setManualModal,
    manualSaving, manualErr,
    feasibilityWarn, setFeasibilityWarn,
    setOverrideFeasibility,
    openManualModal, updateManual, submitManualBooking,
    serviceTypes,
  } = useRendezVousManuel({
    bookings, setBookings, unavailabilities: unavails, teamSize, services, categories, washerId,
    onCree: b => {
      const d = new Date(b.scheduled_at)
      setDayDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    },
  })

  // Fiche de rendez-vous actionnable (statut, reprogrammation, note,
  // facture) — partagée avec CalendrierDashboardV1.tsx, voir le grand
  // commentaire en tête de fichier et `useRendezVousFiche`.
  const {
    selected, setSelected, openBooking,
    updating,
    editNotes, setEditNotes, notesSaving, saveNotes,
    rescheduling, setRescheduling, startReschedule,
    editDate, setEditDate, editTime, setEditTime, rescheduleSaving, rescheduleErr, saveReschedule,
    updateStatus,
    clotureDemandee, setClotureDemandee,
    factureEnCours, factureMsg, emettreFactureManuelle,
  } = useRendezVousFiche({ bookings, setBookings, unavailabilities: unavails, teamSize })

  // Arrivée depuis une notification : `?rdv=<id>` ouvre la fiche tout de
  // suite, positionnée sur le bon jour — même besoin que
  // CalendrierDashboardV1.tsx (voir son commentaire sur ce même mécanisme),
  // mais propre à cet écran : l'agenda v2 n'affiche qu'un seul jour à la
  // fois, pas de mois/semaine à recaler. Contrairement à v1 (préservé à
  // l'identique, y compris son comportement existant sur ce point precis),
  // on appelle `openBooking` plutôt que d'écrire directement `setSelected` :
  // la note existante est donc bien pré-remplie dans le champ éditable dès
  // l'arrivée par ce lien — ce code est nouveau, sans contrainte de
  // non-régression, alors autant qu'il n'ait pas ce défaut.
  const searchParams = useSearchParams()
  const rdvParam = searchParams.get('rdv')
  // Retour de Google (`?google=ok|erreur|sans-jeton`) : la feuille s'ouvre d'elle-même
  // pour dire ce qui s'est passé.
  const issueGoogle = issueDepuisParametre(searchParams.get('google'))
  // `?google=ouvrir` : on arrive d'un raccourci de la configuration, la feuille s'ouvre
  // directement sur l'état de la connexion (Alexandre, 2026-09-27). Les autres valeurs sont
  // les issues du retour OAuth, qui portent en plus un message.
  const [feuilleGoogle, setFeuilleGoogle] = useState(
    issueGoogle !== null || searchParams.get('google') === 'ouvrir',
  )
  const rdvApplique = useRef(false)

  useEffect(() => {
    if (rdvApplique.current || !rdvParam) return
    const rdv = bookings.find(b => b.id === rdvParam)
    if (!rdv) return
    rdvApplique.current = true
    const d = new Date(rdv.scheduled_at)
    setDayDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
    openBooking(rdv)
  }, [rdvParam, bookings, openBooking])

  // Le bandeau de 7 jours est CENTRÉ sur le jour affiché (demande d'Alexandre, 2026-09-26) :
  // le jour choisi est toujours celui du milieu, trois jours avant, trois après. Toucher un
  // autre jour recentre le bandeau sur lui, avec un glissement (voir plus bas).
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(dayDate); d.setDate(d.getDate() + i - 3); return d }),
    [dayDate],
  )
  // Sur ORDINATEUR, la semaine est une vraie semaine : lundi → dimanche, celle qui contient
  // le jour affiché. La règle du « jour au milieu » ci-dessus vaut pour le bandeau du
  // téléphone, où elle sert à choisir un jour du bout du pouce ; une grille hebdomadaire,
  // elle, se lit comme un calendrier — et c’est ce que montre la maquette (écran 3), en
  // accord avec les sept points d’« Aujourd’hui » (semaineAccueil.ts, lundi → dimanche).
  // Sans ça, les deux écrans ne disaient pas la même chose par « cette semaine ».
  const semaineBureau = useMemo(() => {
    const lundi = new Date(dayDate)
    // getDay() : 0 = dimanche. On recule jusqu’au lundi qui précède (dimanche recule de 6).
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(lundi); d.setDate(d.getDate() + i); return d })
  }, [dayDate])
  const bandeauRef = useRef<HTMLDivElement>(null)
  // Décalage (en jours) du jour touché par rapport au milieu, posé au toucher : lu par
  // l'effet qui suit le changement de jour pour faire glisser le bandeau.
  const decalageBandeau = useRef(0)
  useLayoutEffect(() => {
    const k = decalageBandeau.current
    decalageBandeau.current = 0
    const boutons = bandeauRef.current?.querySelectorAll<HTMLElement>('button')
    if (!k || !boutons || boutons.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const pas = boutons[1].getBoundingClientRect().left - boutons[0].getBoundingClientRect().left
    boutons.forEach(b => b.animate(
      [{ transform: `translateX(${k * pas}px)` }, { transform: 'translateX(0)' }],
      { duration: 280, easing: 'cubic-bezier(.23, 1, .32, 1)' },
    ))
  }, [dayDate])

  const byDate = useMemo(() => {
    const m = new Map<string, Booking[]>()
    bookings.forEach(b => {
      const k = dayKey(new Date(b.scheduled_at))
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(b)
    })
    return m
  }, [bookings])

  const jourBrut = useMemo(
    () => [...(byDate.get(dayKey(dayDate)) ?? [])].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [byDate, dayDate],
  )
  const jour = jourBrut
  const masqueesDuJour = useMemo(
    () => masquees.filter(m => dayKey(new Date(m.scheduled_at)) === dayKey(dayDate)),
    [masquees, dayDate],
  )
  // Un rendez-vous annulé n'occupe plus de temps : il reste visible dans la
  // liste (jamais escamoté), mais n'entre dans aucun calcul de trajet, de
  // créneau libre ou de total.
  const actifs = useMemo(() => jour.filter(b => b.status !== 'cancelled'), [jour])

  // Trajet en voiture réel (Google, via `/api/trajet`) entre rendez-vous
  // consécutifs : pour le seul jour affiché, et rien n'est demandé sous deux
  // rendez-vous non annulés — chaque appel Google est facturé. Sans réponse de
  // Google, aucun trajet n'est affiché (pas de repli à vol d'oiseau : il
  // sous-estimait le temps de route de moitié).
  const trajets = useTrajetsRdv(actifs)
  const trajetEntre = (a: Booking, b: Booking): Trajet => trajets.get(`${a.id}>${b.id}`) ?? null

  const totalRoute = useMemo(() => {
    let somme = 0
    let connu = false
    for (let i = 0; i < actifs.length - 1; i++) {
      const t = trajets.get(`${actifs[i].id}>${actifs[i + 1].id}`)
      if (t) { somme += t.minutes; connu = true }
    }
    return connu ? somme : null
  }, [actifs, trajets])
  const totalPrix = useMemo(() => actifs.reduce((s, b) => s + montant(b), 0), [actifs])

  const congeDuJour = getUnavail(dayDate)
  const auJourdhui = toDateStr(today)
  const congesAVenir = useMemo(
    () => unavails.filter(u => u.end_date >= auJourdhui).sort((a, b) => a.start_date.localeCompare(b.start_date)),
    [unavails, auJourdhui],
  )

  function allerSemaine(delta: number) {
    setDayDate(d => { const n = new Date(d); n.setDate(n.getDate() + delta * 7); return n })
  }

  const estAujourdhui = dayDate.getFullYear() === today.getFullYear() && dayDate.getMonth() === today.getMonth() && dayDate.getDate() === today.getDate()
  const sousTitre = estAujourdhui
    ? `Aujourd’hui · ${dayDate.toLocaleDateString('fr-FR', { day: 'numeric' })}`
    : dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })

  // ── Passe bureau (2026-10-06) ───────────────────────────────────────────────────────────────
  //
  // Un retour séparé, AVANT le retour mobile ci-dessous (inchangé, jamais touché par cette
  // passe) — même schéma que ClientsViewV2.tsx/AccueilV2.tsx : toutes les données et actions
  // (bookings, byDate, jour, actifs, trajets, congés, les quatre hooks) sont déjà calculées
  // plus haut et partagées entre les deux branches ; seule la présentation change. Trois
  // onglets (planches Agenda / Agenda-semaine / Agenda-mois) plutôt qu'un bandeau de 7 jours +
  // une couche plein écran : le grand écran a la place de montrer une semaine entière d'un
  // coup, ce qu'un pouce ne permet pas (voir le rapport de la passe).
  if (grandEcran) {
    const nbRdvSemaine = semaineBureau.reduce(
      (s, d) => s + (byDate.get(dayKey(d)) ?? []).filter(b => b.status !== 'cancelled').length,
      0,
    )
    const sousTitreBureau = vueBureau === 'jour'
      ? `${actifs.length} rendez-vous ${estAujourdhui ? 'aujourd’hui' : dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}${totalRoute !== null ? ` · ~${totalRoute} min de route` : ''}`
      : vueBureau === 'semaine'
        ? `${semaineBureau[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${semaineBureau[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${nbRdvSemaine} rendez-vous cette semaine`
        : `${MOIS[dayDate.getMonth()]} ${dayDate.getFullYear()} · ${dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })} sélectionné · ${actifs.length} rendez-vous${totalRoute !== null ? ` · ~${totalRoute} min de route` : ''}`

    return (
      <>
      <div className={`space-y-5 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className={`text-[22px] ${titre}`}>Agenda</h1>
            <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>{sousTitreBureau}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] p-1">
              {([['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']] as const).map(([v, libelle]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVueBureau(v)}
                  aria-pressed={vueBureau === v}
                  className={`h-9 rounded-[var(--v2-radius-pilule)] px-3.5 text-[13px] ${corpsFort} transition-colors ${
                    vueBureau === v ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]' : 'text-[color:var(--v2-color-gris)]'
                  }`}
                >
                  {libelle}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMenuAjout(true)}
              aria-haspopup="dialog"
              className={`flex h-9 items-center gap-1.5 rounded-[var(--v2-radius-pilule)] px-4 text-[13.5px] ${corpsFort} text-white transition-transform active:scale-[.97]`}
              style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
            >
              <Plus size={16} strokeWidth={2.25} aria-hidden />
              Ajouter
            </button>
          </div>
        </div>

        <JoursMasquesV2 dates={joursMasques} />

        {vueBureau === 'jour' && (
          <>
            <BandeauSemaineBureauV2 weekDays={semaineBureau} dayDate={dayDate} today={today} getUnavail={getUnavail} onChoisir={setDayDate} />

            {!estAujourdhui && (
              <button
                type="button"
                onClick={() => setDayDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
                className={`text-[13px] ${corpsFort}`}
                style={{ color: 'var(--v2-color-accent)' }}
              >
                Revenir à aujourd’hui
              </button>
            )}

            {congeDuJour && (
              <BandeauConge
                conge={congeDuJour}
                teamSize={teamSize}
                complet={isFullyUnavailable(congeDuJour)}
                onSupprimer={() => setDelModal(congeDuJour)}
              />
            )}

            {/* Patron liste/fiche à côté, déjà livré par ClientsViewV2.tsx — repris tel quel
                plutôt que d'en inventer un autre (demande explicite de cette passe) : une
                colonne de 340px pour les créneaux de la journée, le reste pour la fiche du
                rendez-vous choisi, en permanence. */}
            <div className="flex gap-4" style={{ height: 'max(460px, calc(100vh - 300px))' }}>
              <div className="flex h-full w-[340px] shrink-0 flex-col overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
                <div className="flex-1 overflow-y-auto">
                  {jour.length === 0 && masqueesDuJour.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
                      <CalendarX2 size={22} strokeWidth={1.8} className="text-[color:var(--v2-color-gris)]" aria-hidden />
                      <div>
                        <p className={`text-[14px] ${corpsFort}`}>Aucun rendez-vous ce jour</p>
                        <p className={`mt-1 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                          Vos créneaux restent réservables sur votre page.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openManualModal(dayDate)}
                        className={`flex h-10 items-center gap-1.5 rounded-[var(--v2-radius-pilule)] px-4 text-[13px] ${corpsFort} text-white transition-transform active:scale-[.97]`}
                        style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
                      >
                        <Plus size={15} strokeWidth={2.25} aria-hidden />
                        Nouveau rendez-vous
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[color:var(--v2-filet)]">
                      {jour.map(b => {
                        const cancelled = b.status === 'cancelled'
                        const indexActif = actifs.indexOf(b)
                        const suivant = !cancelled && indexActif >= 0 ? actifs[indexActif + 1] : undefined
                        const gapMin = suivant ? Math.round((new Date(suivant.scheduled_at).getTime() - finRendezVous(b).getTime()) / 60_000) : null
                        const trajet = suivant ? trajetEntre(b, suivant) : null
                        const villeTrou = villeDepuisAdresse(b.address)
                        return (
                          <li key={b.id}>
                            <LigneRdvBureauV2
                              booking={b}
                              estompe={cancelled}
                              selectionnee={selected?.id === b.id}
                              onOuvrir={() => openBooking(b)}
                            />
                            {gapMin !== null && gapMin >= SEUIL_LIBRE_MIN && suivant && (
                              <div className="flex items-center justify-between gap-2 border-t border-dashed border-[color:var(--v2-filet-fort)] px-3.5 py-2">
                                <span className={`text-[12px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                                  {dureeLisible(gapMin)} de libre{villeTrou ? ` à ${villeTrou}` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCreneauPropose({ debut: finRendezVous(b), fin: new Date(suivant.scheduled_at), ville: villeTrou, origine: origineDuTrou(b, suivant) })}
                                  aria-label={`Proposer ce créneau libre de ${dureeLisible(gapMin)} à un client`}
                                  className={`text-[12px] ${corpsFort}`}
                                  style={{ color: 'var(--v2-color-accent)' }}
                                >
                                  Proposer
                                </button>
                              </div>
                            )}
                            {suivant && trajet && (
                              <div className={`flex items-center gap-1.5 border-t border-[color:var(--v2-filet)] px-3.5 py-1.5 text-[11.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                                <IconeRoute />
                                {trajet.minutes} min de route · {km(trajet.km)} km
                              </div>
                            )}
                          </li>
                        )
                      })}
                      {masqueesDuJour.map(m => (
                        <li key={m.id}><CarteJourVerrouilleeV2 reservation={m} offre={offreDeblocage} /></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="h-full min-w-0 flex-1 overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
                {selected ? (
                  <FicheRdvBureauV2
                    booking={selected}
                    updating={updating}
                    editNotes={editNotes}
                    setEditNotes={setEditNotes}
                    notesSaving={notesSaving}
                    saveNotes={saveNotes}
                    rescheduling={rescheduling}
                    setRescheduling={setRescheduling}
                    startReschedule={startReschedule}
                    editDate={editDate}
                    setEditDate={setEditDate}
                    editTime={editTime}
                    setEditTime={setEditTime}
                    rescheduleSaving={rescheduleSaving}
                    rescheduleErr={rescheduleErr}
                    saveReschedule={saveReschedule}
                    updateStatus={updateStatus}
                    clotureDemandee={clotureDemandee}
                    setClotureDemandee={setClotureDemandee}
                    facturationPrete={facturationPrete}
                    factureEnCours={factureEnCours}
                    factureMsg={factureMsg}
                    emettreFactureManuelle={emettreFactureManuelle}
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2.5 px-6 text-center">
                    <Users2 size={22} strokeWidth={1.8} className="text-[color:var(--v2-color-gris)]" aria-hidden />
                    <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                      {jour.length === 0 ? 'Créez un rendez-vous, ou choisissez un autre jour.' : 'Sélectionnez un rendez-vous pour voir sa fiche.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {actifs.length > 0 && (
              <div className="flex items-center justify-between border-t border-[color:var(--v2-filet)] pt-3.5">
                <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
                  {actifs.length} rendez-vous{totalRoute !== null ? ` · ${totalRoute} min de route` : ''}
                </span>
                <span className={`text-[14px] ${corpsFort} tabular-nums`}>{totalPrix} €</span>
              </div>
            )}

            <CongesAVenir
              conges={congesAVenir}
              teamSize={teamSize}
              estComplet={isFullyUnavailable}
              onOuvrir={setDelModal}
            />

            <button
              type="button"
              onClick={() => setFeuilleGoogle(true)}
              aria-haspopup="dialog"
              className="flex min-h-14 w-full items-center gap-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-[15px] ${corpsFort}`}>Google Agenda</span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ background: googleAgendaConnecte ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)' }}
                    aria-hidden
                  />
                  <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    {googleAgendaConnecte ? 'Connecté · vos rendez-vous s’y ajoutent' : 'Pas connecté'}
                  </span>
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
            </button>
          </>
        )}

        {vueBureau === 'semaine' && (
          <GrilleSemaineV2
            weekDays={semaineBureau}
            byDate={byDate}
            getUnavail={getUnavail}
            isFullyUnavailable={isFullyUnavailable}
            dayDate={dayDate}
            today={today}
            trajetEntre={trajetEntre}
            onOuvrirJour={d => { setDayDate(d); setVueBureau('jour') }}
            onOuvrirRdv={(b, d) => { setDayDate(d); setVueBureau('jour'); openBooking(b) }}
          />
        )}

        {vueBureau === 'mois' && (
          <MoisBureauV2
            dayDate={dayDate}
            today={today}
            byDate={byDate}
            getUnavail={getUnavail}
            isFullyUnavailable={isFullyUnavailable}
            jour={jour}
            actifs={actifs}
            totalPrix={totalPrix}
            totalRoute={totalRoute}
            onChoisirJour={setDayDate}
            onChangerMois={delta => setDayDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))}
            onOuvrirRdv={b => { setVueBureau('jour'); openBooking(b) }}
          />
        )}
      </div>

      {feuilleGoogle && (
        <FeuilleGoogleAgendaV2
          connecte={googleAgendaConnecte}
          issue={issueGoogle}
          onClose={() => {
            setFeuilleGoogle(false)
            if (issueGoogle) window.history.replaceState(null, '', '/dashboard/calendrier')
          }}
        />
      )}

      {menuAjout && (
        <Feuille titre="Ajouter" onClose={() => setMenuAjout(false)}>
          <ul>
            <li>
              <button
                type="button"
                onClick={() => { setMenuAjout(false); openManualModal(dayDate) }}
                className="flex min-h-14 w-full flex-col items-start justify-center py-2.5 text-left"
              >
                <span className={`text-[16px] ${nom}`}>Nouveau rendez-vous</span>
                <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Un client qui a appelé ou écrit</span>
              </button>
            </li>
            <li className="border-t border-[color:var(--v2-filet)]">
              <button
                type="button"
                onClick={() => { setMenuAjout(false); openAddModal(dayDate) }}
                className="flex min-h-14 w-full flex-col items-start justify-center py-2.5 text-left"
              >
                <span className={`text-[16px] ${nom}`}>Bloquer une période</span>
                <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Congés, formation, jour férié</span>
              </button>
            </li>
          </ul>
        </Feuille>
      )}

      {manualModal && (
        <RendezVousManuelV2
          form={manualModal}
          setForm={setManualModal}
          services={services}
          serviceTypes={serviceTypes}
          updateManual={updateManual}
          saving={manualSaving}
          err={manualErr}
          feasibilityWarn={feasibilityWarn}
          onAnnulerAvertissement={() => { setFeasibilityWarn(null); setOverrideFeasibility(false) }}
          onConfirmerQuandMeme={() => { setOverrideFeasibility(true); submitManualBooking(true) }}
          onSubmit={() => submitManualBooking()}
          onClose={() => setManualModal(null)}
        />
      )}

      {addModal && (
        <FeuilleAjoutConge
          form={addModal}
          setForm={setAddModal}
          teamSize={teamSize}
          saving={uSaving}
          onSave={saveUnavail}
          onClose={() => setAddModal(null)}
        />
      )}

      {delModal && (
        <FeuilleSuppressionConge
          conge={delModal}
          teamSize={teamSize}
          complet={isFullyUnavailable(delModal)}
          saving={uSaving}
          onDelete={deleteUnavail}
          onClose={() => setDelModal(null)}
        />
      )}

      {creneauPropose && (
        <ProposerCreneauV2
          bookings={bookings}
          debut={creneauPropose.debut}
          fin={creneauPropose.fin}
          ville={creneauPropose.ville}
          origine={creneauPropose.origine}
          onClose={() => setCreneauPropose(null)}
        />
      )}
      </>
    )
  }

  return (
    <>
    <div
      inert={vue === 'mois'}
      className={`${arrivee ? 'wb-agenda-arrivee ' : ''}max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          {/* Le titre du mois ouvre la vue du mois : ce qu'on lit est aussi ce
              qu'on touche (comme « ‹ Septembre » sur iPhone). Le bouton grille
              à droite est l'entrée visible ; celle-ci est le raccourci pour qui
              touche le mot. `-my-2 py-2` : cible de 44 px sans agrandir la
              ligne. */}
          <h1 className={`text-[21px] ${titre} capitalize`}>
            <button type="button" onClick={() => setVue('mois')} aria-label={`${MOIS[dayDate.getMonth()]} : ouvrir la vue du mois`} className="-my-2 block py-2 text-left">
              {MOIS[dayDate.getMonth()]}
            </button>
          </h1>
          <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] mt-1 capitalize`}>{sousTitre}</p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setVue('mois')}
            aria-label="Voir le mois"
            aria-haspopup="dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]"
            style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
          >
            <IconeMois />
          </button>
          <button
            type="button"
            onClick={() => setMenuAjout(true)}
            aria-label="Ajouter un rendez-vous ou bloquer une période"
            aria-haspopup="dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform active:scale-[.97]"
            style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
          >
            <Plus size={22} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <JoursMasquesV2 dates={joursMasques} />

      <div data-bandeau-semaine className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => allerSemaine(-1)}
          aria-label="Semaine précédente"
          className="shrink-0 flex h-11 w-8 items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <div ref={bandeauRef} className="flex flex-1 justify-between gap-1 overflow-x-auto">
          {weekDays.map((d, i) => {
            const actif = d.getFullYear() === dayDate.getFullYear() && d.getMonth() === dayDate.getMonth() && d.getDate() === dayDate.getDate()
            const estJourReel = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
            const enConge = getUnavail(d) !== null
            return (
              <button
                key={dayKey(d)}
                type="button"
                onClick={() => { decalageBandeau.current = i - 3; setDayDate(d) }}
                aria-current={actif ? 'date' : undefined}
                aria-label={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (enConge ? ', indisponible' : '')}
                className={`relative flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--v2-radius-bouton)] ${
                  actif ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]' : 'text-[color:var(--v2-color-encre)]'
                }`}
              >
                <span className={`text-[11px] ${corps} opacity-70`}>{JOURS_INITIALE[(d.getDay() + 6) % 7]}</span>
                <span className={`text-[16px] ${corpsFort} tabular-nums ${!actif && estJourReel ? 'text-[color:var(--v2-color-accent)]' : ''}`}>
                  {d.getDate()}
                </span>
                {enConge && (
                  <span
                    aria-hidden
                    className="absolute bottom-[3px] h-[5px] w-[5px] rounded-full"
                    style={{ background: actif ? 'var(--v2-color-surface)' : 'var(--v2-color-ambre)' }}
                  />
                )}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => allerSemaine(1)}
          aria-label="Semaine suivante"
          className="shrink-0 flex h-11 w-8 items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      {!estAujourdhui && (
        <button
          type="button"
          onClick={() => setDayDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}
          className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
        >
          Revenir à aujourd’hui
        </button>
      )}

      {congeDuJour && (
        <BandeauConge
          conge={congeDuJour}
          teamSize={teamSize}
          complet={isFullyUnavailable(congeDuJour)}
          onSupprimer={() => setDelModal(congeDuJour)}
        />
      )}

      {jour.length === 0 && masqueesDuJour.length === 0 ? (
        <p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] text-center py-10`}>
          Aucun rendez-vous ce jour.
        </p>
      ) : (
        <div className="flex flex-col">
          {jour.map(b => {
            const cancelled = b.status === 'cancelled'
            const indexActif = actifs.indexOf(b)
            const suivant = !cancelled && indexActif >= 0 ? actifs[indexActif + 1] : undefined
            const gapMin = suivant ? Math.round((new Date(suivant.scheduled_at).getTime() - finRendezVous(b).getTime()) / 60_000) : null
            const trajet = suivant ? trajetEntre(b, suivant) : null
            // Ville du rendez-vous qui PRÉCÈDE le trou (celui-ci, `b`) — c'est
            // là que le laveur se trouve pendant ce temps libre, pas la ville
            // du rendez-vous suivant. `null` sans invention si l'adresse ne la
            // donne pas sans ambiguïté (voir `villeDepuisAdresse`).
            const villeTrou = villeDepuisAdresse(b.address)
            return (
              <div key={b.id}>
                <RendezVousCarte booking={b} onOuvrir={() => openBooking(b)} estompe={cancelled} />
                {gapMin !== null && gapMin >= SEUIL_LIBRE_MIN && suivant && (
                  <div className="flex items-center gap-3 py-1.5">
                    <span className={`w-10 shrink-0 text-right text-[12px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
                      {formatHeure(finRendezVous(b))}
                    </span>
                    <span className="flex flex-1 items-center justify-between gap-2 rounded-[var(--v2-radius-carte)] border border-dashed border-[color:var(--v2-filet-fort)] px-3.5 py-2.5">
                      <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                        {dureeLisible(gapMin)} de libre{villeTrou ? ` à ${villeTrou}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCreneauPropose({ debut: finRendezVous(b), fin: new Date(suivant.scheduled_at), ville: villeTrou, origine: origineDuTrou(b, suivant) })}
                        aria-label={`Proposer ce créneau libre de ${dureeLisible(gapMin)} à un client`}
                        className={`-my-2.5 -mr-1.5 flex h-11 shrink-0 items-center px-2.5 text-[13px] ${corpsFort}`}
                        style={{ color: 'var(--v2-color-accent)' }}
                      >
                        Proposer
                      </button>
                    </span>
                  </div>
                )}
                {suivant && (
                  <div className="flex items-center gap-3 py-1">
                    <span className="w-10 shrink-0" />
                    <span
                      aria-hidden
                      className="h-[18px] w-px"
                      style={{
                        background: 'repeating-linear-gradient(to bottom, var(--v2-filet-fort) 0 4px, transparent 4px 8px)',
                        marginLeft: 20,
                      }}
                    />
                    {trajet && (
                      <span className={`flex items-center gap-1.5 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
                        <IconeRoute />
                        {trajet.minutes} min de route · {km(trajet.km)} km
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {masqueesDuJour.map(m => (
            <CarteJourVerrouilleeV2 key={m.id} reservation={m} offre={offreDeblocage} />
          ))}
        </div>
      )}

      {actifs.length > 0 && (
        <div className="flex items-center justify-between border-t border-[color:var(--v2-filet)] pt-3.5">
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
            {actifs.length} rendez-vous{totalRoute !== null ? ` · ${totalRoute} min de route` : ''}
          </span>
          <span className={`text-[14px] ${corpsFort} tabular-nums`}>{totalPrix} €</span>
        </div>
      )}

      <CongesAVenir
        conges={congesAVenir}
        teamSize={teamSize}
        estComplet={isFullyUnavailable}
        onOuvrir={setDelModal}
      />

      <button
        type="button"
        onClick={() => setFeuilleGoogle(true)}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] ${corpsFort}`}>Google Agenda</span>
          <span className="mt-0.5 flex items-center gap-2">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: googleAgendaConnecte ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)' }}
              aria-hidden
            />
            <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {googleAgendaConnecte ? 'Connecté · vos rendez-vous s’y ajoutent' : 'Pas connecté'}
            </span>
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
      </button>

      {feuilleGoogle && (
        <FeuilleGoogleAgendaV2
          connecte={googleAgendaConnecte}
          issue={issueGoogle}
          onClose={() => {
            setFeuilleGoogle(false)
            if (issueGoogle) window.history.replaceState(null, '', '/dashboard/calendrier')
          }}
        />
      )}

      {menuAjout && (
        <Feuille titre="Ajouter" onClose={() => setMenuAjout(false)}>
          <ul>
            <li>
              <button
                type="button"
                onClick={() => { setMenuAjout(false); openManualModal(dayDate) }}
                className="flex min-h-14 w-full flex-col items-start justify-center py-2.5 text-left"
              >
                <span className={`text-[16px] ${nom}`}>Nouveau rendez-vous</span>
                <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Un client qui a appelé ou écrit</span>
              </button>
            </li>
            <li className="border-t border-[color:var(--v2-filet)]">
              <button
                type="button"
                onClick={() => { setMenuAjout(false); openAddModal(dayDate) }}
                className="flex min-h-14 w-full flex-col items-start justify-center py-2.5 text-left"
              >
                <span className={`text-[16px] ${nom}`}>Bloquer une période</span>
                <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Congés, formation, jour férié</span>
              </button>
            </li>
          </ul>
        </Feuille>
      )}

      {manualModal && (
        <RendezVousManuelV2
          form={manualModal}
          setForm={setManualModal}
          services={services}
          serviceTypes={serviceTypes}
          updateManual={updateManual}
          saving={manualSaving}
          err={manualErr}
          feasibilityWarn={feasibilityWarn}
          onAnnulerAvertissement={() => { setFeasibilityWarn(null); setOverrideFeasibility(false) }}
          onConfirmerQuandMeme={() => { setOverrideFeasibility(true); submitManualBooking(true) }}
          onSubmit={() => submitManualBooking()}
          onClose={() => setManualModal(null)}
        />
      )}

      {addModal && (
        <FeuilleAjoutConge
          form={addModal}
          setForm={setAddModal}
          teamSize={teamSize}
          saving={uSaving}
          onSave={saveUnavail}
          onClose={() => setAddModal(null)}
        />
      )}

      {delModal && (
        <FeuilleSuppressionConge
          conge={delModal}
          teamSize={teamSize}
          complet={isFullyUnavailable(delModal)}
          saving={uSaving}
          onDelete={deleteUnavail}
          onClose={() => setDelModal(null)}
        />
      )}

      {creneauPropose && (
        <ProposerCreneauV2
          bookings={bookings}
          debut={creneauPropose.debut}
          fin={creneauPropose.fin}
          ville={creneauPropose.ville}
          origine={creneauPropose.origine}
          onClose={() => setCreneauPropose(null)}
        />
      )}

      {selected && (
        <DetailRendezVous
          booking={selected}
          onClose={() => setSelected(null)}
          updating={updating}
          editNotes={editNotes}
          setEditNotes={setEditNotes}
          notesSaving={notesSaving}
          saveNotes={saveNotes}
          rescheduling={rescheduling}
          setRescheduling={setRescheduling}
          startReschedule={startReschedule}
          editDate={editDate}
          setEditDate={setEditDate}
          editTime={editTime}
          setEditTime={setEditTime}
          rescheduleSaving={rescheduleSaving}
          rescheduleErr={rescheduleErr}
          saveReschedule={saveReschedule}
          updateStatus={updateStatus}
          clotureDemandee={clotureDemandee}
          setClotureDemandee={setClotureDemandee}
          facturationPrete={facturationPrete}
          factureEnCours={factureEnCours}
          factureMsg={factureMsg}
          emettreFactureManuelle={emettreFactureManuelle}
        />
      )}
    </div>

    {vue === 'mois' && (
      <MoisV2
        jourAffiche={dayDate}
        aujourdhui={today}
        byDate={byDate}
        getUnavail={getUnavail}
        getBandeauCentre={() => {
          const b = document.querySelector('[data-bandeau-semaine]')?.getBoundingClientRect()
          return b ? b.top + b.height / 2 : null
        }}
        onFermer={() => { setVue('semaine'); setArrivee(false) }}
        onChoisir={d => {
          setArrivee(true)
          // La vue du mois se ferme d'elle-même une fois son zoom terminé (`onFermer`) :
          // ici on cale seulement le jour, que le zoom laisse apparaître dessous.
          setDayDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
          // L'agenda a pu être défilé vers le bas (liste, congés à venir)
          // avant l'ouverture du mois : on le ramène en haut pour que le jour
          // choisi et son bandeau soient ce qu'on voit.
          window.scrollTo({ top: 0 })
        }}
      />
    )}
    </>
  )
}

function RendezVousCarte({ booking: b, onOuvrir, estompe }: { booking: Booking; onOuvrir: () => void; estompe: boolean }) {
  const statut = STATUT[statutAffiche(b)]
  const ville = villeDepuisAdresse(b.address)
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 shrink-0 flex flex-col items-end pt-3 gap-0.5">
        <span className={`text-[14px] ${corpsFort} tabular-nums`}>{formatHeure(new Date(b.scheduled_at))}</span>
        <span className={`text-[11px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>{formatHeure(finRendezVous(b))}</span>
      </div>
      <span
        aria-hidden
        className="w-[3px] self-stretch my-1.5 rounded-full"
        style={{ background: statut.couleur }}
      />
      <button
        type="button"
        onClick={onOuvrir}
        aria-label={`Voir le rendez-vous de ${b.client_name}`}
        className={`flex-1 min-w-0 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-3.5 py-3 text-left flex flex-col gap-1 ${estompe ? 'opacity-50' : ''}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className={`text-[15px] ${nom} truncate`}>{b.client_name}</span>
          <span className={`shrink-0 text-[14.5px] ${corpsFort} tabular-nums`}>{prixAffiche(b)}</span>
        </span>
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>{lignePrestation(b)}</span>
        <span className="flex items-center justify-between gap-2 pt-0.5">
          {/* La ville ne s'affiche que si l'adresse la donne sans ambiguïté
              (voir `villeDepuisAdresse`) : sinon, rien plutôt qu'un lieu faux. */}
          {ville
            ? (
              <span className={`flex min-w-0 items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                <IconeLieu />
                <span className="truncate">{ville}</span>
              </span>
            )
            : <span />}
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: statut.couleur }} aria-hidden />
            <span className={`text-[12.5px] ${corpsFort}`} style={{ color: statut.couleur }}>{statut.label}</span>
          </span>
        </span>
      </button>
    </div>
  )
}

// Fiche de rendez-vous ACTIONNABLE — statut, reprogrammation, note, facture
// (sous-lot 2 de la passe 7 ; sous-lot 1 l'avait laissée en lecture seule).
// Même mécanique d'accessibilité que ClientProfileModalV2.tsx (feuille qui
// monte du bas, Échap, piège de focus, retour du focus, masque le bouton
// WhatsApp flottant).
const SELECTEUR_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function DetailRendezVous({
  booking: b,
  onClose,
  updating,
  editNotes, setEditNotes, notesSaving, saveNotes,
  rescheduling, setRescheduling, startReschedule,
  editDate, setEditDate, editTime, setEditTime, rescheduleSaving, rescheduleErr, saveReschedule,
  updateStatus,
  clotureDemandee, setClotureDemandee,
  facturationPrete,
  factureEnCours, factureMsg, emettreFactureManuelle,
}: {
  booking: Booking
  onClose: () => void
  updating: boolean
  editNotes: string
  setEditNotes: (v: string) => void
  notesSaving: boolean
  saveNotes: () => void
  rescheduling: boolean
  setRescheduling: (v: boolean) => void
  startReschedule: (b: Booking) => void
  editDate: string
  setEditDate: (v: string) => void
  editTime: string
  setEditTime: (v: string) => void
  rescheduleSaving: boolean
  rescheduleErr: string | null
  saveReschedule: () => void
  updateStatus: (id: string, status: string, closedLate?: boolean, montantEncaisse?: number) => void
  clotureDemandee: boolean
  setClotureDemandee: (v: boolean) => void
  facturationPrete: boolean
  factureEnCours: boolean
  factureMsg: { id: string; texte: string; completer: boolean } | null
  emettreFactureManuelle: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feuilleRef = useRef<HTMLDivElement>(null)
  useBloquerDefilement()
  const glisser = useGlisserPourFermer(onClose)
  const focusPrecedent = useRef<HTMLElement | null>(null)
  const statut = STATUT[statutAffiche(b)]

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => { if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus() }
  }, [])

  useEffect(() => { closeRef.current?.focus() }, [])

  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus() }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const prix = montant(b)
  const remise = b.is_smart_slot && Number(b.smart_discount) > 0
  // Mêmes conditions que CalendrierDashboardV1.tsx : un rendez-vous
  // annulé ou déjà terminé ne se reprogramme plus et ne change plus de
  // statut.
  const modifiable = b.status !== 'cancelled' && b.status !== 'done'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Rendez-vous de ${b.client_name}`}>
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 touch-none bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      />
      <div
        ref={feuilleRef}
        className={`relative flex w-full max-h-[88dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
          visible ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', ...glisser.styleFeuille }}
      >
        {/* Bande du haut (poignée + titre) : zone de tirage pour fermer la feuille. */}
        <div className="shrink-0" {...glisser.poignee}>
<div className="flex justify-center pt-2.5 pb-3 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-5">
          <div className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 mb-1.5">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: statut.couleur }} aria-hidden />
              <span className={`text-[12.5px] ${corpsFort}`} style={{ color: statut.couleur }}>{statut.label}</span>
            </span>
            <h2 className={`truncate text-[22px] ${titre}`}>{b.client_name}</h2>

            {rescheduling ? (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    aria-label="Date du rendez-vous"
                    className={`flex-1 h-11 px-3 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[16px] ${corps} text-[color:var(--v2-color-encre)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
                  />
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    aria-label="Heure du rendez-vous"
                    className={`w-28 h-11 px-3 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[16px] ${corps} text-[color:var(--v2-color-encre)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
                  />
                </div>
                {rescheduleErr && (
                  <p className={`text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{rescheduleErr}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveReschedule}
                    disabled={rescheduleSaving}
                    className={`flex-1 h-10 rounded-[var(--v2-radius-bouton)] text-[13.5px] ${corpsFort} text-white disabled:opacity-50 transition-transform active:scale-[.97]`}
                    style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
                  >
                    {rescheduleSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduling(false)}
                    className={`px-4 h-10 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <p className={`mt-1 flex items-center justify-between gap-2 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                <span>
                  {new Date(b.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatHeure(new Date(b.scheduled_at))}–{formatHeure(finRendezVous(b))}
                </span>
                {modifiable && (
                  <button
                    type="button"
                    onClick={() => startReschedule(b)}
                    className={`shrink-0 text-[12.5px] ${corpsFort}`}
                    style={{ color: 'var(--v2-color-accent)' }}
                  >
                    Modifier
                  </button>
                )}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          <div className={`flex items-center justify-between rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3`}>
            <span className={`text-[14px] ${corps}`}>{lignePrestation(b)}</span>
            <span className={`text-[15px] ${corpsFort} tabular-nums`}>
              {remise ? formatPrice(prix) : `${prix} €`}
            </span>
          </div>

          {((b.selected_addons && b.selected_addons.length > 0) || (b.travel_fee ?? 0) > 0) && (
            <div className="mt-3 space-y-1.5 px-1">
              <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>Détail du prix</p>
              {b.selected_addons?.map(a => (
                <div key={a.id} className={`flex items-center justify-between text-[13.5px] ${corps} text-[color:var(--v2-color-encre)]`}>
                  <span>{a.label}</span>
                  <span className="tabular-nums">+{a.price} €</span>
                </div>
              ))}
              {(b.travel_fee ?? 0) > 0 && (
                <div className={`flex items-center justify-between text-[13.5px] ${corps} text-[color:var(--v2-color-encre)]`}>
                  <span>Frais de déplacement</span>
                  <span className="tabular-nums">+{b.travel_fee} €</span>
                </div>
              )}
            </div>
          )}

          <p className={`mt-4 text-[13.5px] ${corps} text-[color:var(--v2-color-encre)]`}>{b.address}</p>

          <div className="mt-4">
            <label htmlFor="rdv-notes" className={`mb-1.5 block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Notes internes
            </label>
            <textarea
              id="rdv-notes"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              onBlur={saveNotes}
              placeholder="Code portail, instructions particulières…"
              rows={2}
              className={`w-full rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3.5 py-2.5 text-[15px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40 resize-none`}
            />
            {notesSaving && (
              <p className={`mt-1 text-[11.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Enregistrement…</p>
            )}
          </div>

          {modifiable && (
            <div className="mt-5 flex gap-2.5">
              {b.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => updateStatus(b.id, 'confirmed')}
                  disabled={updating}
                  className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border text-[15px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
                  style={{ borderColor: 'var(--v2-color-vert)', color: 'var(--v2-color-vert)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
                >
                  Confirmer
                </button>
              )}
              {/* Aussi sur un rendez-vous resté « en attente », même repli
                  qu'en v1 : certains laveurs vont chez le client sans avoir
                  confirmé dans l'app. */}
              <button
                type="button"
                onClick={() => setClotureDemandee(true)}
                disabled={updating}
                className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border text-[15px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
                style={{ borderColor: 'var(--v2-color-accent)', color: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                {b.status === 'pending' ? 'Terminé' : 'Marquer terminé'}
              </button>
              <button
                type="button"
                onClick={() => updateStatus(b.id, 'cancelled')}
                disabled={updating}
                className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border text-[15px] ${corpsFort} disabled:opacity-50 transition-transform active:scale-[.97]`}
                style={{ borderColor: 'var(--v2-color-rouge)', color: 'var(--v2-color-rouge)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Annuler
              </button>
            </div>
          )}

          {clotureDemandee && (
            <ConfirmerClotureV2
              clientName={b.client_name}
              quand={`${new Date(b.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${formatHeure(new Date(b.scheduled_at))}`}
              professionnel={!!b.is_professional}
              facturationPrete={facturationPrete}
              montantPrevu={montantPrevu(b)}
              passe={doitDemanderConfirmation(b, new Date())}
              onFait={montant => {
                setClotureDemandee(false)
                updateStatus(b.id, 'done', doitDemanderConfirmation(b, new Date()) ? true : undefined, montant)
              }}
              onPasFait={() => { setClotureDemandee(false); updateStatus(b.id, 'cancelled') }}
              onClose={() => setClotureDemandee(false)}
            />
          )}

          {/* Facture : émise au passage en « Terminé », ou à la demande */}
          {b.status === 'done' && (
            <div className="mt-5">
              {b.facture_numero ? (
                <a
                  href={`/api/bookings/${b.id}/pdf`}
                  className={`flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                  style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
                >
                  Télécharger la facture {b.facture_numero}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => emettreFactureManuelle(b.id)}
                  disabled={factureEnCours}
                  className={`flex h-11 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] disabled:opacity-50 transition-transform active:scale-[.97]`}
                  style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
                >
                  {factureEnCours ? 'Émission…' : 'Émettre la facture'}
                </button>
              )}
              {factureMsg?.id === b.id && (
                <p className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-ambre)' }}>
                  {factureMsg.texte}{' '}
                  {factureMsg.completer && (
                    <a href="/dashboard/parametres/profil#facturation" className={`${corpsFort} underline`}>
                      Compléter mes informations
                    </a>
                  )}
                </p>
              )}
            </div>
          )}

          {b.client_email?.trim() && <div className={`mt-5 space-y-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            <a href={`mailto:${b.client_email}`} className="flex items-center gap-2 transition-colors hover:text-[color:var(--v2-color-encre)]">
              <Mail size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{b.client_email}</span>
            </a>
          </div>}

          {b.client_phone && (
            <div className="mt-5 flex gap-2.5">
              <a
                href={`tel:${b.client_phone}`}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                <Phone size={16} strokeWidth={2} aria-hidden />
                Appeler
              </a>
              <a
                href={`sms:${b.client_phone}`}
                onClick={() => annoncerApresRetour({ titre: 'Message envoyé', detail: `À ${b.client_name}` })}
                className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Message
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Composants de la passe bureau (2026-10-06) ──────────────────────────────────────────────
//
// Jamais utilisés en dehors de `grandEcran` (voir plus haut) : écrits à part plutôt
// qu'en modifiant `RendezVousCarte`/`DetailRendezVous` ci-dessus, pour ne prendre AUCUN risque
// sur la présentation mobile déjà livrée — elle reste touchée nulle part dans cette passe. La
// LOGIQUE (les actions passées en props : `updateStatus`, `saveNotes`, `saveReschedule`,
// `emettreFactureManuelle`...) vient des mêmes hooks que la version mobile, jamais recalculée
// ici : seule la présentation diffère.

/** Bandeau de 7 jours du haut de l'onglet « Jour » bureau — même donnée que le bandeau mobile
 *  (`weekDays`, centré sur `dayDate`), sans l'animation de glissement au clic : elle existe côté
 *  mobile pour un geste de doigt sur un bandeau étroit, elle n'a pas de sens à la souris sur une
 *  rangée qui a toute la place. */
function BandeauSemaineBureauV2({
  weekDays, dayDate, today, getUnavail, onChoisir,
}: {
  weekDays: Date[]
  dayDate: Date
  today: Date
  getUnavail: (d: Date) => Unavailability | null
  onChoisir: (d: Date) => void
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-1.5">
      {weekDays.map(d => {
        const actif = isSameDay(d, dayDate)
        const estJourReel = isSameDay(d, today)
        const enConge = getUnavail(d) !== null
        return (
          <button
            key={dayKey(d)}
            type="button"
            onClick={() => onChoisir(d)}
            aria-current={actif ? 'date' : undefined}
            aria-label={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (enConge ? ', indisponible' : '')}
            className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--v2-radius-bouton)] transition-colors motion-reduce:transition-none ${
              actif ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]' : 'text-[color:var(--v2-color-encre)] hover:bg-[color:var(--v2-filet)]'
            }`}
          >
            <span className={`text-[11px] ${corps} capitalize opacity-70`}>{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
            <span className={`text-[16px] ${corpsFort} tabular-nums ${!actif && estJourReel ? 'text-[color:var(--v2-color-accent)]' : ''}`}>
              {d.getDate()}
            </span>
            {enConge && (
              <span
                aria-hidden
                className="absolute bottom-[5px] h-[5px] w-[5px] rounded-full"
                style={{ background: actif ? 'var(--v2-color-surface)' : 'var(--v2-color-ambre)' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Ligne d'un rendez-vous dans le panneau de gauche bureau (planche Agenda, `.client-row`) —
 *  même donnée que `RendezVousCarte` (nom, prestation, prix, statut), présentation en ligne de
 *  liste plutôt qu'en carte : c'est le même patron que `LigneClient` de ClientsViewV2.tsx. */
function LigneRdvBureauV2({
  booking: b, estompe, selectionnee, onOuvrir,
}: {
  booking: Booking
  estompe: boolean
  selectionnee: boolean
  onOuvrir: () => void
}) {
  const statut = STATUT[statutAffiche(b)]
  return (
    <button
      type="button"
      onClick={onOuvrir}
      aria-label={`Voir le rendez-vous de ${b.client_name}`}
      aria-current={selectionnee ? 'true' : undefined}
      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:bg-[color:var(--v2-filet)] ${
        selectionnee ? 'bg-[color:var(--v2-filet)]' : 'hover:bg-[color:var(--v2-filet)]'
      } ${estompe ? 'opacity-50' : ''}`}
    >
      <span className={`w-11 shrink-0 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] tabular-nums`}>
        {formatHeure(new Date(b.scheduled_at))}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14.5px] ${nom} truncate`}>{b.client_name}</span>
        <span className={`block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>{lignePrestation(b)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={`text-[13px] ${corpsFort} tabular-nums`}>{prixAffiche(b)}</span>
        <span className={`text-[11px] ${corpsFort}`} style={{ color: statut.couleur }}>{statut.label}</span>
      </span>
    </button>
  )
}

/** Fiche de rendez-vous du panneau de droite bureau — mêmes ACTIONS que `DetailRendezVous` plus
 *  haut (passées en props depuis les mêmes hooks, jamais recalculées), présentation à part :
 *  posée à demeure à côté de la liste au lieu d'une feuille qui monte du bas (pas de fond, pas
 *  de piège de focus, pas de geste de fermeture — rien de tout ça n'a de sens pour un panneau
 *  permanent, même raisonnement que `ClientProfileModalV2.tsx` en mode `panneau`). Les pilules de
 *  statut remplacent les trois boutons mobiles : même action (`updateStatus`,
 *  `doitDemanderConfirmation`), present différemment — jamais de retour vers « En attente », qui
 *  n'a pas d'action dans le produit. Le bouton « Itinéraire » réutilise le choix
 *  Plans/Waze/Google Maps déjà construit pour l'accueil (`ChoixItineraireV2`/`applicationsItineraire`),
 *  pas une nouvelle logique : la maquette (planche Agenda) le montre, l'accueil l'a déjà, la
 *  fiche de rendez-vous mobile ne l'avait pas encore — ajouté ICI seulement, jamais sur la
 *  feuille mobile (`DetailRendezVous`, intouchée par cette passe). */
function FicheRdvBureauV2({
  booking: b,
  updating,
  editNotes, setEditNotes, notesSaving, saveNotes,
  rescheduling, setRescheduling, startReschedule,
  editDate, setEditDate, editTime, setEditTime, rescheduleSaving, rescheduleErr, saveReschedule,
  updateStatus,
  clotureDemandee, setClotureDemandee,
  facturationPrete,
  factureEnCours, factureMsg, emettreFactureManuelle,
}: {
  booking: Booking
  updating: boolean
  editNotes: string
  setEditNotes: (v: string) => void
  notesSaving: boolean
  saveNotes: () => void
  rescheduling: boolean
  setRescheduling: (v: boolean) => void
  startReschedule: (b: Booking) => void
  editDate: string
  setEditDate: (v: string) => void
  editTime: string
  setEditTime: (v: string) => void
  rescheduleSaving: boolean
  rescheduleErr: string | null
  saveReschedule: () => void
  updateStatus: (id: string, status: string, closedLate?: boolean, montantEncaisse?: number) => void
  clotureDemandee: boolean
  setClotureDemandee: (v: boolean) => void
  facturationPrete: boolean
  factureEnCours: boolean
  factureMsg: { id: string; texte: string; completer: boolean } | null
  emettreFactureManuelle: (id: string) => void
}) {
  const [choixItineraire, setChoixItineraire] = useState(false)
  const prix = montant(b)
  const remise = b.is_smart_slot && Number(b.smart_discount) > 0
  const modifiable = b.status !== 'cancelled' && b.status !== 'done'
  const adresse = b.address?.trim()

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[color:var(--v2-filet)] px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-[21px] ${titre}`}>{b.client_name}</h2>
            {rescheduling ? (
              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    aria-label="Date du rendez-vous"
                    className={`h-10 flex-1 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14px] ${corps} text-[color:var(--v2-color-encre)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
                  />
                  <input
                    type="time"
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    aria-label="Heure du rendez-vous"
                    className={`h-10 w-28 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14px] ${corps} text-[color:var(--v2-color-encre)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
                  />
                </div>
                {rescheduleErr && (
                  <p className={`text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{rescheduleErr}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveReschedule}
                    disabled={rescheduleSaving}
                    className={`h-9 flex-1 rounded-[var(--v2-radius-bouton)] text-[13px] ${corpsFort} text-white disabled:opacity-50 transition-transform active:scale-[.97]`}
                    style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
                  >
                    {rescheduleSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduling(false)}
                    className={`h-9 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-3 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <p className={`mt-1 flex items-center gap-2 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                <span>
                  {new Date(b.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {formatHeure(new Date(b.scheduled_at))}–{formatHeure(finRendezVous(b))} · {lignePrestation(b)} · {remise ? formatPrice(prix) : `${prix} €`}
                </span>
                {modifiable && (
                  <button
                    type="button"
                    onClick={() => startReschedule(b)}
                    className={`shrink-0 text-[12.5px] ${corpsFort}`}
                    style={{ color: 'var(--v2-color-accent)' }}
                  >
                    Modifier
                  </button>
                )}
              </p>
            )}
          </div>
          <span className={`shrink-0 text-[28px] ${titre} tabular-nums`}>{formatHeure(new Date(b.scheduled_at))}</span>
        </div>

        {/* Statuts en pilules (planche Système : « point plein + le mot ») — lecture directe du
            statut réel, jamais de retour vers « En attente » (aucune action ne l'autorise). */}
        <div className="mt-4 flex gap-2">
          {([['pending', 'En attente'], ['confirmed', 'Confirmé'], ['done', 'Terminé'], ['cancelled', 'Annulé']] as const).map(([valeur, libelle]) => {
            const actif = b.status === valeur
            const peutCliquer = modifiable && (valeur === 'done' || valeur === 'cancelled' || (valeur === 'confirmed' && b.status === 'pending'))
            return (
              <button
                key={valeur}
                type="button"
                disabled={updating || (!peutCliquer && !actif)}
                onClick={() => {
                  if (!peutCliquer) return
                  if (valeur === 'done') {
                    // Toujours par la fenêtre : c'est là que se donne le montant encaissé.
                    setClotureDemandee(true)
                  } else {
                    updateStatus(b.id, valeur)
                  }
                }}
                className={`h-9 rounded-[var(--v2-radius-pilule)] border px-3.5 text-[12.5px] ${corpsFort} transition-colors disabled:opacity-40 motion-reduce:transition-none ${
                  actif ? 'border-transparent' : 'border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]'
                }`}
                style={actif ? { background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' } : undefined}
              >
                {libelle}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {adresse && <p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-encre)]`}>{adresse}</p>}

        {(adresse || b.client_phone) && (
          <div className="mt-3 flex gap-2.5">
            {adresse && (
              <button
                type="button"
                onClick={() => setChoixItineraire(true)}
                aria-haspopup="dialog"
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] text-[13.5px] ${corpsFort} text-white transition-transform active:scale-[.97]`}
                style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                <Navigation size={15} strokeWidth={2} aria-hidden />
                Itinéraire
              </button>
            )}
            {b.client_phone && (
              <a
                href={`tel:${b.client_phone}`}
                className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                <Phone size={14} strokeWidth={2} aria-hidden />
                Appeler
              </a>
            )}
            {b.client_phone && (
              <a
                href={`sms:${b.client_phone}`}
                onClick={() => annoncerApresRetour({ titre: 'Message envoyé', detail: `À ${b.client_name}` })}
                className={`flex h-10 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Message
              </a>
            )}
          </div>
        )}

        {choixItineraire && adresse && (
          <ChoixItineraireV2 adresse={adresse} onClose={() => setChoixItineraire(false)} />
        )}

        <div className="mt-4">
          <label htmlFor="rdv-notes-bureau" className={`mb-1.5 block text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Notes internes
          </label>
          <textarea
            id="rdv-notes-bureau"
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Code portail, instructions particulières…"
            rows={3}
            className={`w-full resize-none rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3.5 py-2.5 text-[14px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
          />
          {notesSaving && (
            <p className={`mt-1 text-[11.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Enregistrement…</p>
          )}
        </div>

        {clotureDemandee && (
          <div className="mt-4">
            <ConfirmerClotureV2
              clientName={b.client_name}
              quand={`${new Date(b.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${formatHeure(new Date(b.scheduled_at))}`}
              professionnel={!!b.is_professional}
              facturationPrete={facturationPrete}
              montantPrevu={montantPrevu(b)}
              passe={doitDemanderConfirmation(b, new Date())}
              onFait={montant => {
                setClotureDemandee(false)
                updateStatus(b.id, 'done', doitDemanderConfirmation(b, new Date()) ? true : undefined, montant)
              }}
              onPasFait={() => { setClotureDemandee(false); updateStatus(b.id, 'cancelled') }}
              onClose={() => setClotureDemandee(false)}
            />
          </div>
        )}

        {b.status === 'done' && (
          <div className="mt-4">
            {b.facture_numero ? (
              <a
                href={`/api/bookings/${b.id}/pdf`}
                className={`flex h-10 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Télécharger la facture {b.facture_numero}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => emettreFactureManuelle(b.id)}
                disabled={factureEnCours}
                className={`flex h-10 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] disabled:opacity-50 transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                {factureEnCours ? 'Émission…' : 'Émettre la facture'}
              </button>
            )}
            {factureMsg?.id === b.id && (
              <p className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-ambre)' }}>
                {factureMsg.texte}{' '}
                {factureMsg.completer && (
                  <a href="/dashboard/parametres/profil#facturation" className={`${corpsFort} underline`}>
                    Compléter mes informations
                  </a>
                )}
              </p>
            )}
          </div>
        )}

        {b.client_email?.trim() && <p className={`mt-4 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>{b.client_email}</p>}
      </div>
    </div>
  )
}

/** Grille de 7 colonnes de l'onglet « Semaine » bureau (planche Agenda-semaine) — occupe la
 *  hauteur restante (pourcentages dans une colonne `flex-1`), jamais figée en pixels comme le
 *  cadre à 912px de la maquette (voir le rapport). La plage d'heures vient de
 *  `plageHeuresSemaine` (les vrais rendez-vous de la semaine affichée, aucune horaire
 *  d'ouverture chargée). Un jour entièrement indisponible (`isFullyUnavailable`) s'affiche
 *  « Fermé » ; un congé partiel (équipe > 1) reste ouvert, marqué d'un point ambre sous sa date —
 *  les deux viennent de `useConges`, rien n'est inventé. Le temps de route n'est affiché que
 *  pour la colonne du jour SÉLECTIONNÉ (`dayDate`) : lui seul a déjà ses trajets chargés
 *  (`trajetEntre`, partagé avec l'onglet Jour) — en demander pour les six autres colonnes aurait
 *  multiplié par sept les appels à `/api/trajet` (Google Distance Matrix, facturé) à chaque
 *  ouverture de cet onglet, pour un gain que l'onglet Jour donne déjà sur le jour qui compte. */
function GrilleSemaineV2({
  weekDays, byDate, getUnavail, isFullyUnavailable, dayDate, today, trajetEntre,
  onOuvrirJour, onOuvrirRdv,
}: {
  weekDays: Date[]
  byDate: Map<string, Booking[]>
  getUnavail: (d: Date) => Unavailability | null
  isFullyUnavailable: (u: Unavailability) => boolean
  dayDate: Date
  today: Date
  trajetEntre: (a: Booking, b: Booking) => Trajet
  onOuvrirJour: (d: Date) => void
  onOuvrirRdv: (b: Booking, d: Date) => void
}) {
  const joursActifs = useMemo(
    () => weekDays.map(d => (byDate.get(dayKey(d)) ?? []).filter(b => b.status !== 'cancelled').sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))),
    [weekDays, byDate],
  )
  const { debut, fin } = useMemo(() => plageHeuresSemaine(joursActifs), [joursActifs])
  const heures = useMemo(() => Array.from({ length: fin - debut }, (_, i) => debut + i), [debut, fin])
  const pct = (h: number) => ((h - debut) / (fin - debut)) * 100

  return (
    <div
      className="flex min-h-0 flex-1 overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]"
      style={{ height: 'max(460px, calc(100vh - 300px))' }}
    >
      <div className="flex w-12 shrink-0 flex-col border-r border-[color:var(--v2-filet)]">
        <div className="h-[52px] shrink-0 border-b border-[color:var(--v2-filet)]" />
        <div className="relative flex-1">
          {heures.map(h => (
            <span
              key={h}
              aria-hidden
              className={`absolute right-2 -translate-y-1/2 text-[11px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}
              style={{ top: `${pct(h)}%` }}
            >
              {h}h
            </span>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-7 divide-x divide-[color:var(--v2-filet)]">
        {weekDays.map((d, i) => {
          const actifsJour = joursActifs[i]
          const estAffiche = isSameDay(d, dayDate)
          const estAujourdhui = isSameDay(d, today)
          const conge = getUnavail(d)
          const ferme = conge ? isFullyUnavailable(conge) : false
          return (
            <div key={dayKey(d)} className="flex flex-col">
              <button
                type="button"
                onClick={() => onOuvrirJour(d)}
                aria-current={estAffiche ? 'date' : undefined}
                className={`flex h-[52px] shrink-0 flex-col items-center justify-center gap-0.5 border-b border-[color:var(--v2-filet)] transition-colors motion-reduce:transition-none ${
                  estAffiche ? 'bg-[color:var(--v2-filet)]' : 'hover:bg-[color:var(--v2-filet)]'
                }`}
              >
                <span className={`text-[11px] ${corps} capitalize text-[color:var(--v2-color-gris)]`}>
                  {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </span>
                <span className={`flex items-center gap-1 text-[14px] ${corpsFort} tabular-nums ${!estAffiche && estAujourdhui ? 'text-[color:var(--v2-color-accent)]' : ''}`}>
                  {d.getDate()}
                  {conge && !ferme && (
                    <span aria-hidden className="h-[5px] w-[5px] rounded-full" style={{ background: 'var(--v2-color-ambre)' }} />
                  )}
                </span>
              </button>
              <div
                className="relative flex-1"
                style={ferme ? { background: 'color-mix(in srgb, var(--v2-color-ambre) 7%, transparent)' } : undefined}
              >
                {heures.map(h => (
                  <div key={h} aria-hidden className="absolute inset-x-0 border-t border-[color:var(--v2-filet)]" style={{ top: `${pct(h)}%` }} />
                ))}
                {ferme ? (
                  <span className={`absolute inset-0 flex items-center justify-center text-[11px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                    Fermé
                  </span>
                ) : (
                  actifsJour.map((b, idx) => {
                    const deb = new Date(b.scheduled_at)
                    const h0 = deb.getHours() + deb.getMinutes() / 60
                    const finB = finRendezVous(b)
                    const hf = finB.getHours() + finB.getMinutes() / 60
                    const top = pct(h0)
                    const hauteur = Math.max(pct(hf) - top, 5)
                    const statut = STATUT[statutAffiche(b)]
                    const suivant = estAffiche ? actifsJour[idx + 1] : undefined
                    const trajet = suivant ? trajetEntre(b, suivant) : null
                    return (
                      <span key={b.id} className="absolute inset-x-[2px]" style={{ top: `${top}%`, height: `${hauteur}%` }}>
                        <button
                          type="button"
                          onClick={() => onOuvrirRdv(b, d)}
                          aria-label={`${formatHeure(deb)} ${b.client_name}, ${lignePrestation(b)}`}
                          className="flex h-full w-full flex-col overflow-hidden rounded-[6px] px-1.5 py-1 text-left transition-transform active:scale-[.98] motion-reduce:transition-none"
                          style={{ background: `color-mix(in srgb, ${statut.couleur} 16%, var(--v2-color-surface))`, borderLeft: `2.5px solid ${statut.couleur}` }}
                        >
                          <span className={`block truncate text-[10.5px] ${corpsFort}`}>{formatHeure(deb)} {b.client_name}</span>
                        </button>
                        {trajet && (
                          <span
                            aria-hidden
                            className={`absolute left-1 top-full z-10 mt-0.5 whitespace-nowrap rounded-[4px] bg-[color:var(--v2-color-surface)] px-1 text-[9.5px] ${corpsFort} text-[color:var(--v2-color-gris)] shadow-sm`}
                          >
                            {trajet.minutes} min
                          </span>
                        )}
                      </span>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Vue du mois bureau (planche Agenda-mois) — grille statique du mois de `dayDate` + une
 *  colonne latérale qui montre le jour sélectionné, à la façon de l'écran « Clients » (liste à
 *  gauche, détail à droite). Volontairement DIFFÉRENTE de `MoisV2.tsx` (la couche plein écran à
 *  défilement continu de la PWA) : ce n'est pas le même geste — à la souris, naviguer mois par
 *  mois avec deux flèches est la convention, pas un défilement vertical sans fin fait pour un
 *  pouce. `semainesDuMois`/`compterActifsParJour`/`pointsRendezVous` viennent de `lib/vueMois.ts`,
 *  réutilisés tels quels (même calcul que la PWA, seul l'habillage change). */
function MoisBureauV2({
  dayDate, today, byDate, getUnavail, isFullyUnavailable, jour, actifs, totalPrix, totalRoute,
  onChoisirJour, onChangerMois, onOuvrirRdv,
}: {
  dayDate: Date
  today: Date
  byDate: Map<string, Booking[]>
  getUnavail: (d: Date) => Unavailability | null
  isFullyUnavailable: (u: Unavailability) => boolean
  jour: Booking[]
  actifs: Booking[]
  totalPrix: number
  totalRoute: number | null
  onChoisirJour: (d: Date) => void
  onChangerMois: (delta: number) => void
  onOuvrirRdv: (b: Booking) => void
}) {
  const annee = dayDate.getFullYear()
  const mois = dayDate.getMonth()
  const semaines = useMemo(() => semainesDuMois(annee, mois), [annee, mois])
  const compte = useMemo(() => compterActifsParJour(byDate), [byDate])

  return (
    <div className="grid grid-cols-[1fr_320px] items-start gap-4">
      <div className="flex flex-col overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
        <div className="flex items-center justify-between border-b border-[color:var(--v2-filet)] px-4 py-3">
          <button
            type="button"
            onClick={() => onChangerMois(-1)}
            aria-label="Mois précédent"
            className="flex h-9 w-9 items-center justify-center text-[color:var(--v2-color-gris)] transition-colors hover:text-[color:var(--v2-color-encre)]"
          >
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <span className={`text-[15px] ${corpsFort} capitalize`}>{MOIS[mois]} {annee}</span>
          <button
            type="button"
            onClick={() => onChangerMois(1)}
            aria-label="Mois suivant"
            className="flex h-9 w-9 items-center justify-center text-[color:var(--v2-color-gris)] transition-colors hover:text-[color:var(--v2-color-encre)]"
          >
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-[color:var(--v2-filet)] text-center">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(j => (
            <span key={j} className={`py-2 text-[11px] ${corps} text-[color:var(--v2-color-gris)]`}>{j}</span>
          ))}
        </div>
        <div>
          {semaines.map((semaine, i) => (
            <div key={i} className="grid grid-cols-7 border-b border-[color:var(--v2-filet)] last:border-b-0">
              {semaine.map((j, c) => {
                if (!j) {
                  return <span key={c} aria-hidden className="min-h-[72px] border-r border-[color:var(--v2-filet)] last:border-r-0" />
                }
                const conge = getUnavail(j)
                const ferme = conge ? isFullyUnavailable(conge) : false
                const { points, plus } = pointsRendezVous(compte.get(dayKey(j)) ?? 0)
                const estAffiche = isSameDay(j, dayDate)
                const estAujourdhui = isSameDay(j, today)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onChoisirJour(j)}
                    aria-current={estAffiche ? 'date' : undefined}
                    aria-label={j.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (ferme ? ', fermé' : conge ? ', congé partiel' : '')}
                    className="flex min-h-[72px] flex-col items-center gap-1 border-r border-[color:var(--v2-filet)] py-2 text-center transition-colors last:border-r-0 hover:bg-[color:var(--v2-filet)] motion-reduce:transition-none"
                    style={ferme ? { background: 'color-mix(in srgb, var(--v2-color-ambre) 6%, transparent)' } : undefined}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${corpsFort} tabular-nums`}
                      style={estAujourdhui
                        ? { background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }
                        : estAffiche
                          ? { background: 'var(--v2-color-encre)', color: 'var(--v2-color-surface)' }
                          : undefined}
                    >
                      {j.getDate()}
                    </span>
                    <span className="flex h-2 items-center gap-[3px]" aria-hidden>
                      {Array.from({ length: points }, (_, k) => (
                        <span key={k} className="h-[5px] w-[5px] rounded-full bg-[color:var(--v2-color-encre)]" />
                      ))}
                      {plus && <span className={`text-[9px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>+</span>}
                      {/* Point ambre du congé, SÉPARÉ des points de rendez-vous (même erreur à ne
                          pas refaire que la première version de cet écran, voir le rapport de la
                          passe) — sinon un jour en congé SANS rendez-vous (congé partiel un jour
                          calme) n'affichait aucun point du tout. Même convention que
                          `MoisV2.tsx` (mobile), `CaseJour`. */}
                      {conge && <span className="h-[5px] w-[5px] rounded-full" style={{ background: 'var(--v2-color-ambre)' }} />}
                    </span>
                    {estAffiche && actifs.length > 0 && (
                      <span className={`text-[10px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>{totalPrix} €</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
        <div className="shrink-0 border-b border-[color:var(--v2-filet)] px-4 py-3">
          <p className={`text-[15px] ${corpsFort} capitalize`}>
            {dayDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className={`mt-0.5 text-[12px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
            {actifs.length} rendez-vous{actifs.length > 0 ? ` · ${totalPrix} €` : ''}{totalRoute !== null ? ` · ~${totalRoute} min de route` : ''}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {jour.length === 0 ? (
            <p className={`px-4 py-6 text-center text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Aucun rendez-vous ce jour.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--v2-filet)]">
              {jour.map(b => (
                <li key={b.id}>
                  <LigneRdvBureauV2 booking={b} estompe={b.status === 'cancelled'} selectionnee={false} onOuvrir={() => onOuvrirRdv(b)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
