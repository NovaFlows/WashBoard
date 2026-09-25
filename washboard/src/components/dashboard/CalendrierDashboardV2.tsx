'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Mail, Phone, Plus, X } from 'lucide-react'
import MoisV2 from '@/components/dashboard/MoisV2'
import { effectiveDuration, addonsDuration, formatPrice } from '@/lib/pricing'
import { toDateStr } from '@/lib/dateUtils'
import { getWeekStart, dayKey, formatHeure, cleStatut, type StatutClef } from '@/lib/calendarLayout'
import { villeDepuisAdresse } from '@/lib/adresse'
import { doitDemanderConfirmation } from '@/lib/cloture'
import { useTrajetsRdv } from '@/hooks/useTrajetsRdv'
import { useRendezVousFiche } from '@/hooks/useRendezVousFiche'
import { useRendezVousManuel } from '@/hooks/useRendezVousManuel'
import { useConges } from '@/hooks/useConges'
import ConfirmerClotureV2 from '@/components/dashboard/ConfirmerClotureV2'
import { Feuille } from '@/components/dashboard/FeuilleV2'
import RendezVousManuelV2 from '@/components/dashboard/RendezVousManuelV2'
import ProposerCreneauV2 from '@/components/dashboard/ProposerCreneauV2'
import FeuilleGoogleAgendaV2, { issueDepuisParametre } from '@/components/dashboard/FeuilleGoogleAgendaV2'
import { BandeauConge, CongesAVenir, FeuilleAjoutConge, FeuilleSuppressionConge } from '@/components/dashboard/CongesV2'
import type { Booking, CalendrierProps } from '@/components/dashboard/CalendrierDashboardV1'
import { useBloquerDefilement, useGlisserPourFermer } from '@/hooks/useFeuilleTactile'

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
const STATUT: Record<StatutClef, { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  closed_late: { couleur: 'var(--v2-color-ambre)', label: 'Délai dépassé' },
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

function finRendezVous(b: Booking): Date {
  const duree = effectiveDuration((b.services?.duration_minutes ?? 60) + addonsDuration(b.selected_addons), b.vehicle_count)
  return new Date(new Date(b.scheduled_at).getTime() + duree * 60_000)
}

type Trajet = { minutes: number; km: number } | null

export default function CalendrierDashboardV2({ bookings: initialBookings, unavailabilities: initialUnavailabilities, teamSize, services, categories, washerId, facturationPrete, googleAgendaConnecte }: CalendrierProps) {
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
  const [creneauPropose, setCreneauPropose] = useState<{ debut: Date; fin: Date; ville: string | null } | null>(null)

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
  const [feuilleGoogle, setFeuilleGoogle] = useState(issueGoogle !== null)
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

  const weekStart = useMemo(() => getWeekStart(dayDate), [dayDate])
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d }),
    [weekStart],
  )

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

      <div data-bandeau-semaine className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => allerSemaine(-1)}
          aria-label="Semaine précédente"
          className="shrink-0 flex h-11 w-8 items-center justify-center text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>
        <div className="flex flex-1 justify-between gap-1 overflow-x-auto">
          {weekDays.map((d, i) => {
            const actif = d.getFullYear() === dayDate.getFullYear() && d.getMonth() === dayDate.getMonth() && d.getDate() === dayDate.getDate()
            const estJourReel = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
            const enConge = getUnavail(d) !== null
            return (
              <button
                key={dayKey(d)}
                type="button"
                onClick={() => setDayDate(d)}
                aria-current={actif ? 'date' : undefined}
                aria-label={d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + (enConge ? ', indisponible' : '')}
                className={`relative flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--v2-radius-bouton)] ${
                  actif ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]' : 'text-[color:var(--v2-color-encre)]'
                }`}
              >
                <span className={`text-[11px] ${corps} opacity-70`}>{JOURS_INITIALE[i]}</span>
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

      {jour.length === 0 ? (
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
                        onClick={() => setCreneauPropose({ debut: finRendezVous(b), fin: new Date(suivant.scheduled_at), ville: villeTrou })}
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
  const statut = STATUT[cleStatut(b)]
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
  updateStatus: (id: string, status: string, closedLate?: boolean) => void
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
  const statut = STATUT[cleStatut(b)]

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
                onClick={() => doitDemanderConfirmation(b, new Date()) ? setClotureDemandee(true) : updateStatus(b.id, 'done')}
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
              onFait={() => { setClotureDemandee(false); updateStatus(b.id, 'done', true) }}
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
                    <a href="/dashboard/parametres/tout#facturation" className={`${corpsFort} underline`}>
                      Compléter mes informations
                    </a>
                  )}
                </p>
              )}
            </div>
          )}

          <div className={`mt-5 space-y-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            <a href={`mailto:${b.client_email}`} className="flex items-center gap-2 transition-colors hover:text-[color:var(--v2-color-encre)]">
              <Mail size={14} className="shrink-0" aria-hidden />
              <span className="truncate">{b.client_email}</span>
            </a>
          </div>

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
