'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Check, Lock, MapPin, MoreHorizontal, Navigation, Phone, Store } from 'lucide-react'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { formatHeure } from '@/lib/dateUtils'
import { formatPrice, finalDisplayPrice } from '@/lib/pricing'
import { effectivePrice } from '@/lib/crmStats'
import { estimateTravelMinutes, haversineKm } from '@/lib/geo'
import { statutAffiche, type StatutAffiche } from '@/lib/cloture'
import { jourParisDe } from '@/lib/chiffresPeriode'
import { formatConversionRate } from '@/lib/funnelStats'
import { DEPARTMENTS } from '@/lib/france-departments'
import type { WidgetKey } from '@/lib/dashboardWidgets'
import type { ZoneConfig } from '@/types'
import PersonnaliserV2 from '@/components/dashboard/PersonnaliserV2'
import ChoixItineraireV2 from '@/components/dashboard/ChoixItineraireV2'
import { LigneRdvVerrouilleeV2, type ReservationMasquee } from '@/components/dashboard/ReservationVerrouilleeV2'
import { PLAN_LABELS, PLAN_COULEURS, PLAN_PRICES, PLAN_CARDS, type Plan } from '@/lib/plan'
import type { JourSemaine } from '@/lib/semaineAccueil'

// « Aujourd'hui », présentation v2 — réservée à la PWA installée en mode
// standalone (voir Accueil.tsx, le point de branchement ; décision
// d'Alexandre, 2026-09-22 : le site reste v1 sans exception). Passe 8 de la
// refonte 2026, la dernière du plan de vol.
//
// Planche `project/Main.dc.html` : un héros « prochain rendez-vous » (heure en
// gros, nom, adresse, deux actions), puis « La journée », puis « À faire »,
// puis « À confirmer ».
//
// CE QUE CET ÉCRAN FAIT DU SYSTÈME DE WIDGETS D'ALEX ET RYAN
// ----------------------------------------------------------
// Il s'appuie dessus, il ne le remplace pas : même colonne en base
// (`washers.dashboard_widgets`), même registre (`lib/dashboardWidgets.ts`),
// même fonction de lecture (`widgetsVisibles`), même route d'enregistrement
// (`PATCH /api/washer`), et donc le même réglage d'un appareil à l'autre. Un
// widget masqué côté site reste masqué ici, et l'ordre choisi par le laveur
// est respecté à l'identique.
//
// Deux différences, assumées, et une seule raison pour les deux — la v2 a
// gagné des destinations que la v1 n'avait pas :
//
//  1. La COLONNE VERTÉBRALE (héros + la journée + à confirmer) n'est pas
//     gouvernée par la clé `today`. En v1, masquer le widget « Aujourd'hui »
//     laissait la liste « À venir » juste en dessous : on masquait un doublon.
//     En v2, la journée EST l'écran — appliquer cette clé ici viderait la
//     destination de son seul rôle (« où je vais maintenant »), ce que
//     personne n'a demandé en cochant cette case. La clé n'est donc pas lue
//     ici ; elle continue de piloter le widget du site, inchangée, et la
//     feuille « Personnaliser » (PersonnaliserV2) le dit noir sur blanc au
//     lieu d'offrir un interrupteur sans effet.
//  2. Les six autres widgets deviennent des LIGNES, pas des tuiles — « un
//     héros par écran, le reste en ligne » (planche Système). Chacun garde sa
//     donnée, son libellé et sa destination ; il perd sa carte et son gros
//     chiffre coloré.
//
// Aucune donnée nouvelle, aucune requête ajoutée : tout ce qui est affiché
// ici est déjà calculé par `dashboard/page.tsx` pour la v1.
//
// TROIS COUPES ASSUMÉES par rapport à la planche (même réflexe qu'aux passes
// 5, 6 et 7 : signalées, jamais approximées) :
//  - « À faire » (les trois tâches cochables) : les tâches n'existent nulle
//    part dans le produit — ni table, ni route, ni champ. Rien à afficher.
//  - « 12 min de route » sur le héros : c'est le trajet depuis l'endroit où se
//    trouve le laveur maintenant. Le produit ne stocke aucune coordonnée de
//    départ (`washers.base_address` est un texte libre, jamais géocodé et
//    conservé), et un vrai temps de trajet demande un appel Google Distance
//    Matrix côté serveur. Le temps de route n'apparaît donc QUE là où il est
//    calculable et déjà éprouvé (passe 7) : entre deux rendez-vous du jour,
//    à vol d'oiseau, en total de journée.
//  - « portail 1234 » : aucun champ « code d'accès » n'existe sur une
//    réservation (`notes` est la note interne du laveur, pas une consigne
//    structurée).
//
// Le lien de chaque rendez-vous pointe vers `/dashboard/calendrier?rdv=<id>`,
// exactement comme les widgets v1 : dans la PWA, c'est la fiche ACTIONNABLE
// de l'agenda v2 (passe 7, sous-lot 2) qui s'ouvre — changer un statut,
// reprogrammer, noter, facturer. Rien n'est dupliqué ici.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)]`

/** Où en est le laveur de son plafond mensuel : plein, dernière place, ou encore de la marge.
 *  Extrait de `JaugeReservationsV2` (passe « bureau ») pour que la carte de montée en offre du
 *  second écran déclenche exactement la même condition que le lien « Changer d'offre » de la
 *  jauge, sans la deviner à côté — un seul calcul, deux présentations. */
function etatJauge(utilisees: number, quota: number | null): { depasse: boolean; derniere: boolean } {
  if (quota === null || quota <= 0) return { depasse: false, derniere: false }
  const restantes = Math.max(0, quota - utilisees)
  return { depasse: utilisees >= quota, derniere: restantes === 1 }
}

/** Où en est le laveur de son quota du mois — équivalent v2 de `JaugeReservations.tsx` (site),
 *  même logique, jetons v2. Ne s'affiche pas sur une offre sans plafond : il n'y a alors rien à
 *  compter, une jauge pleine à 3 % serait un rappel gratuit qu'on paie. */
function JaugeReservationsV2({ utilisees, quota, offre, remiseAZero }: { utilisees: number; quota: number | null; offre: Plan; remiseAZero?: string }) {
  if (quota === null || quota <= 0) return null

  const restantes = Math.max(0, quota - utilisees)
  const { depasse, derniere } = etatJauge(utilisees, quota)
  const couleur = depasse ? 'var(--v2-color-rouge)' : derniere ? 'var(--v2-color-ambre)' : 'var(--v2-color-accent)'
  const pourcent = Math.min(100, Math.round((utilisees / quota) * 100))
  const message = depasse
    ? `Plafond atteint — les suivantes sont masquées${remiseAZero ? ` jusqu’au ${remiseAZero}` : ''}`
    : derniere
      ? 'Plus qu’une réservation avant le plafond'
      : `Encore ${restantes} réservations avant le ${remiseAZero ?? 'prochain palier'}`

  return (
    <div className="mb-4 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-[14px] ${corpsFort}`}>
          <span style={{ color: couleur }}>{utilisees}</span>
          <span className="text-[color:var(--v2-color-gris)]"> / {quota}</span>
          <span className={`${corps} text-[color:var(--v2-color-gris)]`}> réservations ce mois</span>
        </p>
        <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--v2-color-gris)]">
          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PLAN_COULEURS[offre] }} aria-hidden />
          {PLAN_LABELS[offre]}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--v2-filet)]" aria-hidden>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pourcent}%`, backgroundColor: couleur }} />
      </div>
      {/* En colonne sur téléphone : côte à côte, « Plafond atteint — les suivantes
          sont masquées jusqu'au 16 octobre » se pliait sur quatre lignes étroites
          contre le lien. La largeur de l'écran est le vrai arbitre, pas la place
          que prend le lien. */}
      <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{message}</p>
        {(derniere || depasse) && (
          <Link href="/dashboard/abonnement" className="shrink-0 text-[11px] font-black uppercase tracking-[0.18em] hover:underline" style={{ color: couleur }}>
            Changer d’offre →
          </Link>
        )}
      </div>
    </div>
  )
}

// Troisième copie de ce tableau dans le projet (CalendrierDashboardV2.tsx,
// ClientProfileModalV2.tsx) — présentation, jamais du calcul, et volontairement
// pas extraite dans cette passe : l'extraction toucherait deux écrans v2 que je
// ne peux pas recapturer faute d'accès à la base sur cette machine. À faire
// quand un quatrième écran en aura besoin, avec les trois captures qui vont
// avec. Convention de la planche Système : un point plein + le mot, jamais une
// pastille pastel.
const STATUT: Record<StatutAffiche, { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  a_cloturer: { couleur: 'var(--v2-color-ambre)', label: 'À clôturer' },
}

const NOM_DEPT = new Map(DEPARTMENTS.map(d => [d.code, d.name]))

/** Forme minimale d'un rendez-vous pour cet écran. `dashboard/page.tsx` envoie
 *  des lignes complètes (`select('*, services(...)')`) : ce type dit seulement
 *  ce qui est lu ici. */
export type RdvAccueil = {
  id: string
  client_name: string
  client_phone: string | null
  address: string | null
  lat: number | null
  lng: number | null
  scheduled_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  closed_late?: boolean | null
  is_smart_slot: boolean
  smart_discount: number
  booked_price: number | null
  // La durée est déjà chargée par la page (voir la requête) : elle manquait dans ce type,
  // et sert à savoir si le créneau est fini (« À clôturer »).
  services: { name: string; price: number; duration_minutes?: number | null; service_categories?: { name: string } | null } | null
}

/** Montant réellement facturé — les deux fonctions du projet, sans copie
 *  locale : le prix retenu (`effectivePrice`, lib/crmStats) puis la remise
 *  « créneau optimisé » (`finalDisplayPrice`, lib/pricing). */
function montant(b: RdvAccueil): number {
  return finalDisplayPrice(effectivePrice(b), b.is_smart_slot, Number(b.smart_discount ?? 0))
}

function prixAffiche(b: RdvAccueil): string {
  return b.is_smart_slot && Number(b.smart_discount) > 0 ? formatPrice(montant(b)) : `${montant(b)} €`
}

/** Catégorie · prestation — même repli que l'agenda v2 et que le modal de
 *  détail v1. Pas le véhicule ni l'option affichés au cas par cas dans la
 *  planche : aucune règle de mise en forme fiable ne les couvre. */
function lignePrestation(b: RdvAccueil): string {
  if (!b.services) return 'Prestation'
  return b.services.service_categories?.name
    ? `${b.services.service_categories.name} · ${b.services.name}`
    : b.services.name
}

/** Temps de route du jour : la somme des trajets entre deux rendez-vous
 *  successifs, à vol d'oiseau (`haversineKm`) puis convertie en minutes
 *  (`estimateTravelMinutes`) — exactement le calcul de l'agenda v2, repris
 *  sans copie. `null` dès qu'aucun couple n'a de coordonnées : mieux vaut
 *  rien qu'un « 0 min » faux. */
function minutesDeRoute(liste: RdvAccueil[]): number | null {
  let somme = 0
  let connu = false
  for (let i = 0; i < liste.length - 1; i++) {
    const a = liste[i]
    const b = liste[i + 1]
    if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) continue
    somme += estimateTravelMinutes(haversineKm(a.lat, a.lng, b.lat, b.lng))
    connu = true
  }
  return connu ? somme : null
}

/** Le jour d'un rendez-vous qui n'est pas aujourd'hui.
 *
 *  « sam. 26 » tant qu'on reste dans la semaine qui vient : c'est la forme de
 *  la planche, et celle qu'on lit le plus vite. Au-delà — ou dans le passé,
 *  ce qui arrive pour un rendez-vous jamais clôturé — le jour de la semaine
 *  ne suffit plus à situer la date : « 3 nov. » à la place. Sans cette
 *  bascule, une demande en attente pour dans six semaines s'afficherait
 *  « mar. 3 », impossible à situer. */
function jourCourt(iso: string): string {
  const d = new Date(iso)
  const maintenant = Date.now()
  const proche = d.getTime() >= maintenant - 86_400_000 && d.getTime() <= maintenant + 7 * 86_400_000
  return proche
    ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

type Props = {
  /** La carte de démarrage (`DemarrageCard`), rendue côté serveur et passée
   *  telle quelle : un compte neuf a besoin de ses étapes de configuration
   *  dans la PWA comme sur le site. Habillage v1 assumé — elle disparaît
   *  d'elle-même dès que le compte peut encaisser un rendez-vous. */
  demarrage: ReactNode
  /** Ce qui reste à faire aujourd'hui (ni terminé, ni annulé), trié par heure
   *  — la même liste que le widget « Aujourd'hui » du site. */
  rdvAujourdhui: RdvAccueil[]
  /** Les trois prochains après aujourd'hui, déjà calculés pour le widget
   *  « Prochains rendez-vous » du site. */
  rdvProchains: RdvAccueil[]
  /** Demandes en attente APRÈS aujourd'hui : celles du jour sont déjà dans la
   *  journée juste au-dessus, les répéter serait du bruit. */
  aConfirmer: RdvAccueil[]
  /** Au moins un rendez-vous a été clôturé aujourd'hui : « journée terminée »
   *  plutôt que « rien de prévu » quand il ne reste rien. */
  journeeCommencee: boolean
  /** Aujourd'hui à Paris, au format AAAA-MM-JJ — calculé une seule fois côté
   *  serveur (`FUSEAU`), pas redérivé ici. */
  dateDuJour: string
  /** Widgets visibles, dans l'ordre choisi par le laveur (`widgetsVisibles`). */
  widgets: WidgetKey[]
  /** `null` quand le widget correspondant est masqué : la donnée n'a alors
   *  même pas été demandée à la base (voir `dashboard/page.tsx`). */
  stats: { terminesCeMois: number; caCeMois: number | null } | null
  clients: { total: number; nouveauxCetteSemaine: number } | null
  trafic: { visiteurs: number; conversions: number } | null
  prestationTop: { nom: string; nombre: number } | null
  zone: ZoneConfig
  /** Où en est le laveur de son quota de réservations du mois (fusionné le 2026-09-28, voir
   *  `JaugeReservations.tsx`, la version site) — `quota: null` sur une offre sans plafond, rien
   *  ne s'affiche alors. */
  jauge: { utilisees: number; quota: number | null; offre: Plan; remiseAZero?: string }
  /** Demandes en attente masquées par le plafond : elles se rangent dans « À confirmer », en
   *  carte floutée avec un cadenas (l'id et le jour seulement — voir `dashboard/page.tsx`). */
  verrouillees: ReservationMasquee[]
  /** L'offre la moins chère qui les débloque, nommée sur chaque carte. */
  offreDeblocage: string
  /** « Cette semaine » (colonne de droite, bureau uniquement) — sept jours,
   *  lundi → dimanche, voir `lib/semaineAccueil.ts`. Un repère discret, pas
   *  une deuxième vedette : le héros de l'écran reste le prochain
   *  rendez-vous. Jamais affiché sur téléphone (voir plus bas). */
  semaine: JourSemaine[]
  /** « Demain » (même colonne, juste au-dessus de « Cette semaine ») — déjà
   *  filtré et démasqué par `dashboard/page.tsx` (sous-ensemble de la même
   *  liste que « À confirmer »/« La journée »), aucun traitement de plus ici.
   *  Vide un jour calme : la section disparaît alors plutôt que de montrer
   *  un encart sans rien dedans. */
  rdvDemain: RdvAccueil[]
  /** Demain, `AAAA-MM-JJ` à l'heure de Paris — pour l'intitulé de la section
   *  (« Demain, vendredi 4 »), jamais recalculé depuis l'horloge du
   *  navigateur. */
  demainStr: string
  /** Au moins une étape BLOQUANTE de la configuration manque encore (`etapeDemarrage(progress)
   *  !== null`) — voir `Accueil.tsx` pour pourquoi ni `essentialsDone` ni une liste de
   *  rendez-vous vide ne suffisent à le deviner. Sans effet sur l'écran à une colonne
   *  (téléphone) : `demarrage` y disparaît déjà seul quand il n'a plus rien à réclamer, inchangé
   *  par cette passe. */
  configurationIncomplete: boolean
}

export default function AccueilV2({
  demarrage,
  rdvAujourdhui,
  rdvProchains,
  aConfirmer,
  journeeCommencee,
  dateDuJour,
  widgets,
  stats,
  clients,
  trafic,
  prestationTop,
  zone,
  jauge,
  verrouillees,
  offreDeblocage,
  semaine,
  rdvDemain,
  demainStr,
  configurationIncomplete,
}: Props) {
  const [personnaliser, setPersonnaliser] = useState(false)
  // Passe « bureau » (2026-10-05, Alexandre, 2026-10-03) : deux colonnes au-delà de
  // `SEUIL_GRAND_ECRAN_PX` (1024px), même hook que ClientsViewV2.tsx — pas un seuil inventé en
  // double. `false` au rendu serveur et jusqu'à l'hydratation : l'écran démarre donc toujours en
  // disposition à une colonne, comme avant cette passe (voir ce même hook, ClientsViewV2.tsx).
  const grandEcran = useGrandEcran()

  // « Prochain » veut dire À VENIR. Le serveur met dans `rdvProchains` tout ce qui n'est ni
  // terminé ni annulé, sans borne de date : un rendez-vous d'avant-hier jamais clôturé s'y
  // trouve encore, et s'affichait ici comme prochain rendez-vous, daté du passé (signalé par
  // Alexandre, 2026-09-26). On ne garde que les jours postérieurs à aujourd'hui — les
  // rendez-vous du jour, eux, sont dans `rdvAujourdhui`. Le site, lui, ne change pas.
  const prochainsAVenir = useMemo(
    () => rdvProchains.filter(b => (jourParisDe(b.scheduled_at) ?? '') > dateDuJour),
    [rdvProchains, dateDuJour],
  )

  // Le héros : le prochain rendez-vous du jour, et à défaut le prochain tout
  // court. Un écran vide un jour de repos n'aiderait personne à savoir où il
  // va ; la date s'affiche alors dans la carte pour qu'aucune confusion ne
  // soit possible.
  const prochain = rdvAujourdhui[0] ?? prochainsAVenir[0] ?? null
  const reste = rdvAujourdhui.slice(1)
  const routeDuJour = useMemo(() => minutesDeRoute(rdvAujourdhui), [rdvAujourdhui])
  const totalDuJour = useMemo(() => rdvAujourdhui.reduce((s, b) => s + montant(b), 0), [rdvAujourdhui])

  const aujourdhui = new Date()
  const titreJour = aujourdhui.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const sousTitre =
    rdvAujourdhui.length > 0
      ? `${rdvAujourdhui.length} rendez-vous · ${totalDuJour} €`
      : journeeCommencee
        ? 'Journée terminée'
        : 'Rien de prévu aujourd’hui'

  // Écran 45 de la maquette bureau (« premier jour ») : la configuration manque ET il n'y a
  // réellement rien à montrer aujourd'hui — le `&& !prochain` protège le cas, rare mais possible
  // (services supprimés après coup), où un rendez-vous existe déjà malgré un compte « incomplet »
  // : mieux vaut alors montrer ce rendez-vous que la carte de configuration par-dessus.
  const premierJour = grandEcran && configurationIncomplete && !prochain
  // Écran 46 (« quota atteint ») : exactement la même condition que le lien « Changer d'offre »
  // de la jauge (`etatJauge`, partagé) — jamais une seconde lecture du seuil.
  const { depasse: quotaDepasse, derniere: quotaDerniere } = etatJauge(jauge.utilisees, jauge.quota)
  const upsell = grandEcran && !premierJour && (quotaDepasse || quotaDerniere)

  // La colonne « activité » du jour : héros, le reste de la journée, à confirmer — strictement
  // le même JSX qu'avant cette passe. En variable plutôt qu'inline pour pouvoir la poser SOIT
  // seule (écran à une colonne, comportement d'avant), SOIT à gauche du panneau de droite du
  // châssis bureau (`grandEcran`, plus bas) — aucune logique n'a bougé, seul l'endroit où ce
  // résultat est posé dans la page change (même principe que `contenuListe` de ClientsViewV2.tsx).
  const colonneActivite = (
    <>
      {prochain ? (
        <section className="mt-6">
          <TitreSection>Prochain rendez-vous</TitreSection>
          <CarteHeros rdv={prochain} dateDuJour={dateDuJour} />
        </section>
      ) : (
        <p className={`mt-10 text-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
          {journeeCommencee ? 'Tout est fait pour aujourd’hui.' : 'Aucun rendez-vous à venir.'}
        </p>
      )}

      {reste.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-2 px-0.5 pb-2">
            <Link href="/dashboard/calendrier" className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
              La journée
            </Link>
            {routeDuJour !== null && (
              <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>
                ~{routeDuJour} min de route
              </span>
            )}
          </div>
          <CarteListe>
            {reste.map(b => (
              <LigneRdv key={b.id} rdv={b} />
            ))}
          </CarteListe>
        </section>
      )}

      {aConfirmer.length + verrouillees.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-2 px-0.5 pb-2">
            <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>À confirmer</span>
            <span className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)] tabular-nums`}>
              {aConfirmer.length + verrouillees.length} demande{aConfirmer.length + verrouillees.length > 1 ? 's' : ''}
            </span>
          </div>
          <CarteListe>
            {aConfirmer.map(b => (
              <LigneRdv key={b.id} rdv={b} avecDate />
            ))}
            {verrouillees.map(r => (
              <LigneRdvVerrouilleeV2 key={r.id} reservation={r} offre={offreDeblocage} />
            ))}
          </CarteListe>
        </section>
      )}
    </>
  )

  // La colonne « widgets » (ce mois, clients, visiteurs, la plus demandée, zone, ensuite...) —
  // même composant, même props, posé SOIT en dessous de la colonne d'activité (une colonne),
  // SOIT dans le panneau de droite du châssis bureau (plus bas).
  const colonneWidgets = (
    <BlocsOptionnels
      widgets={widgets}
      rdvProchains={prochainsAVenir}
      stats={stats}
      clients={clients}
      trafic={trafic}
      prestationTop={prestationTop}
      zone={zone}
    />
  )

  return (
    <div
      className={`${grandEcran ? '' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6'} pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <JaugeReservationsV2 {...jauge} />
      {/* En écran 45 (bureau, premier jour), la carte de configuration se pose dans la colonne de
          gauche, à la place du héros — pas ICI en plus, par-dessus (voir plus bas). */}
      {!premierJour && demarrage}

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {/* first-letter, pas capitalize : « Mercredi 23 septembre », et non
              « Mercredi 23 Septembre » — un nom de mois ne prend pas de
              majuscule en français. */}
          <h1 className={`text-[21px] ${titre} first-letter:uppercase`}>{titreJour}</h1>
          <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] mt-1 tabular-nums`}>{sousTitre}</p>
        </div>
        <button
          type="button"
          onClick={() => setPersonnaliser(true)}
          aria-label="Personnaliser l’accueil"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-encre)] transition-colors hover:bg-[color:var(--v2-filet)]"
        >
          <MoreHorizontal size={21} strokeWidth={1.75} />
        </button>
      </div>

      {grandEcran ? (
        // Châssis bureau (passe « bureau », 2026-10-05) : planche `Main.dc.html` — deux colonnes,
        // 1fr/340px, 26px d'écart, alignées en haut (exactement la grille de la maquette, pas une
        // valeur à l'oeil). La colonne de droite change de contenu selon l'état de l'écran, les
        // trois mêmes que ceux dessinés par la maquette (écrans 1, 45, 46) :
        //   - premierJour  → la carte de configuration à gauche, l'aperçu de la page à droite ;
        //   - upsell       → l'activité du jour à gauche (avec les lignes verrouillées, cliquables
        //     — c'est elles qui ouvrent la fiche de l'écran 48), la carte de montée en offre à
        //     droite ;
        //   - sinon        → l'activité du jour à gauche ; à droite, « Demain » puis « Cette
        //     semaine » (passe du 2026-10-06, Alexandre a tranché de les construire pour de vrai —
        //     voir DemainV2/CetteSemaineV2 plus bas), puis les widgets du laveur, inchangés.
        //     Uniquement ici : sur téléphone (colonne unique, plus bas), ni « Demain » ni
        //     « Cette semaine » ne s'affichent — la colonne de droite est une disposition de
        //     grand écran, pas un contenu qui manquerait sur un téléphone qui ne l'a jamais eu.
        <div className="mt-6 grid grid-cols-[1fr_340px] gap-[26px] items-start">
          <div>{premierJour ? demarrage : colonneActivite}</div>
          <div>
            {premierJour ? (
              <ApercuPageV2 />
            ) : upsell ? (
              <CarteMonteeOffreV2 jauge={jauge} offreDeblocage={offreDeblocage} />
            ) : (
              <>
                {rdvDemain.length > 0 && <DemainV2 rdv={rdvDemain} demainStr={demainStr} />}
                <CetteSemaineV2 jours={semaine} />
                {colonneWidgets}
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {colonneActivite}
          {colonneWidgets}
        </>
      )}

      {personnaliser && <PersonnaliserV2 visibles={widgets} onClose={() => setPersonnaliser(false)} />}
    </div>
  )
}

function TitreSection({ children }: { children: ReactNode }) {
  return <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>{children}</p>
}

/** « Lundi 29 septembre » à partir d'un jour `AAAA-MM-JJ`, sans dépendre du
 *  fuseau de la machine qui exécute ce code (minuit UTC, lu en UTC) — même
 *  idée que `formatJour` dans `chiffresPeriode.ts`, non exportée de là-bas,
 *  mais seulement le jour et le quantième : la planche n'affiche jamais le
 *  mois sur ces deux blocs (« Demain, vendredi 4 »). */
function jourLong(jourStr: string): string {
  return new Date(`${jourStr}T00:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', timeZone: 'UTC' })
}

/** Colonne de droite de l'écran 1 (bureau) : les rendez-vous de demain, pour
 *  que le laveur voie le soir ce que le pouce, sur téléphone, ne montre
 *  jamais (planche `Main.dc.html`). Une ligne confirmée s'affiche normalement
 *  ; une demande en attente s'affiche en gris, sans sa prestation — « si
 *  confirmée » à la place, pour ne pas donner l'impression qu'elle est déjà
 *  acquise. Jamais de lien : un simple coup d'œil, pas une action (même
 *  registre que « Cette semaine » juste en dessous). */
function DemainV2({ rdv, demainStr }: { rdv: RdvAccueil[]; demainStr: string }) {
  return (
    <div>
      <TitreSection>Demain, {jourLong(demainStr)}</TitreSection>
      <CarteListe>
        {rdv.map(b => {
          const enAttente = b.status === 'pending'
          return (
            <div key={b.id} className="flex items-start gap-3 py-[11px]">
              <span className={`shrink-0 w-[42px] pt-0.5 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)] tabular-nums`}>
                {formatHeure(new Date(b.scheduled_at))}
              </span>
              <span
                className={`min-w-0 flex-1 pt-0.5 text-[13.5px] ${nom} truncate`}
                style={enAttente ? { color: 'var(--v2-color-gris)' } : undefined}
              >
                {b.client_name} — {enAttente ? 'si confirmée' : lignePrestation(b)}
              </span>
            </div>
          )
        })}
      </CarteListe>
    </div>
  )
}

/** Colonne de droite de l'écran 1 (bureau), juste sous « Demain » : un point
 *  par jour de la semaine en cours — un repère discret, pas une deuxième
 *  vedette (planche Système, « un seul héros par écran »). La donnée vient de
 *  `semaineAccueil` (fonction pure testée, `lib/semaineAccueil.ts`) : ce
 *  composant ne fait que choisir une couleur par état, jamais un calcul.
 *
 *  Couleurs reprises de `STATUT` plus haut dans ce fichier — même sémantique
 *  que le point posé à côté de chaque rendez-vous (ambre = en attente, vert =
 *  confirmé) — plutôt qu'un gris unique pour « il y a quelque chose » : la
 *  planche ne montrait qu'un exemple sans jour en attente dans cette grille
 *  précise, mais la règle posée ailleurs sur ce même écran est plus juste que
 *  de la refondre en un seul ton ici. */
function CetteSemaineV2({ jours }: { jours: JourSemaine[] }) {
  return (
    <div>
      <TitreSection>Cette semaine</TitreSection>
      <div
        className="rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3 grid grid-cols-7 gap-1 text-center"
      >
        {jours.map(j => (
          <div key={j.jour} title={descriptionJourSemaine(j)}>
            <div
              className={`text-[10.5px] ${j.aujourdhui ? corpsFort : corps}`}
              style={{ color: j.aujourdhui ? undefined : 'var(--v2-color-gris)' }}
            >
              {j.lettre}
            </div>
            <PointJourSemaine jour={j} />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Le point lui-même : aujourd'hui prime sur tout (accent, légèrement plus
 *  gros — exactement la planche), sinon la couleur dit l'état du jour. Un
 *  jour FERMÉ se distingue d'un jour simplement vide par un anneau creux
 *  plutôt qu'un point plein : discret, jamais une seconde couleur de plus. */
function PointJourSemaine({ jour }: { jour: JourSemaine }) {
  if (jour.aujourdhui) {
    return <span aria-hidden className="mx-auto mt-1 block h-[7px] w-[7px] rounded-full" style={{ background: 'var(--v2-color-accent)' }} />
  }
  if (jour.etat === 'attente') {
    return <span aria-hidden className="mx-auto mt-[5px] block h-[6px] w-[6px] rounded-full" style={{ background: 'var(--v2-color-ambre)' }} />
  }
  if (jour.etat === 'confirme') {
    return <span aria-hidden className="mx-auto mt-[5px] block h-[6px] w-[6px] rounded-full" style={{ background: 'var(--v2-color-vert)' }} />
  }
  if (jour.etat === 'ferme') {
    return (
      <span
        aria-hidden
        className="mx-auto mt-[5px] block h-[6px] w-[6px] rounded-full border"
        style={{ borderColor: 'var(--v2-filet-fort)' }}
      />
    )
  }
  return <span aria-hidden className="mx-auto mt-[5px] block h-[6px] w-[6px] rounded-full" style={{ background: 'var(--v2-filet-fort)' }} />
}

/** Texte du survol (`title`) d'un jour de « Cette semaine » — la seule
 *  explication offerte en dehors de la couleur, utile tant qu'il n'y a pas de
 *  légende sur l'écran (planche Système : pas de légende répétée sur chaque
 *  widget, « un point plein + le mot » veut dire au niveau de l'écran, pas de
 *  chaque widget pris seul). */
function descriptionJourSemaine(j: JourSemaine): string {
  const jour = j.aujourdhui ? `Aujourd’hui, ${jourLong(j.jour)}` : jourLong(j.jour)
  const etat =
    j.etat === 'attente' ? 'une demande en attente'
      : j.etat === 'confirme' ? 'des rendez-vous confirmés'
        : j.etat === 'ferme' ? 'fermé'
          : 'rien de prévu'
  return `${jour} : ${etat}`
}

/** Colonne de droite de l'écran 45 (bureau, « premier jour ») : l'aperçu de la page publique,
 *  pour montrer CE QUE la configuration va débloquer plutôt que de laisser la colonne vide.
 *  Décorative et inerte, même convention que `UpgradePrompt.tsx` (`apercu`) — pas une capture de
 *  la vraie page : on n'a reçu ici ni le nom du laveur ni son slug, et rien n'est à inventer.
 *  Couleurs écrites en dur, exception déjà en place dans la maquette bureau (CONTRAT.md) : cette
 *  vignette montre une page publique, TOUJOURS claire, quel que soit le thème du tableau de
 *  bord — les jetons `--v2-*` suivraient le thème sombre, ce que cette vignette ne doit jamais
 *  faire. */
function ApercuPageV2() {
  return (
    <div>
      <TitreSection>Aperçu de votre page</TitreSection>
      <div
        className="overflow-hidden rounded-[16px] border"
        style={{ borderColor: 'var(--v2-filet-fort)', boxShadow: '0 10px 28px rgba(22,22,26,.12)' }}
      >
        <div style={{ height: 26, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: '#e7e6e3' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ed6a5e' }} aria-hidden />
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f4bf4f' }} aria-hidden />
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#61c454' }} aria-hidden />
          <span style={{ margin: '0 auto', fontSize: 9.5, color: '#6b6b76' }}>Votre page de réservation</span>
        </div>
        <div style={{ background: '#f8fafc' }}>
          <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              aria-hidden
              style={{
                width: 42, height: 42, borderRadius: 11, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flex: 'none', background: '#f1f5f9', color: '#64748b',
              }}
            >
              <Store size={18} strokeWidth={1.8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.15, color: '#0f172a' }}>Votre entreprise</div>
              <div style={{ fontSize: 11.5, marginTop: 3, color: '#94a3b8' }}>Bienvenue sur votre espace de réservation !</div>
            </div>
          </div>
          <div style={{ padding: '6px 18px 24px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: '#0f172a' }}>Choisissez votre prestation</div>
            <div style={{ borderRadius: 12, padding: '18px 14px', textAlign: 'center', border: '1.5px dashed #e2e8f0' }}>
              <span style={{ fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>Aucune prestation disponible pour le moment.</span>
            </div>
          </div>
        </div>
      </div>
      <p className={`mt-2.5 text-[12px] leading-[1.6] ${corps} text-[color:var(--v2-color-gris)]`}>
        C’est ce que voit un client sur votre page tant qu’aucune prestation n’est en ligne.
      </p>
    </div>
  )
}

/** Colonne de droite de l'écran 46 (bureau, « quota atteint ») : la carte de montée en offre,
 *  planche `Main.dc.html`. Prix et contenu lus dans `lib/plan.ts` (`PLAN_PRICES`, `PLAN_CARDS`) —
 *  jamais un « 49 € » écrit en dur, exactement la règle du contrat de la maquette (« pas de
 *  chiffre inventé présenté comme réel »). `offreDeblocage` est déjà la bonne offre, calculée par
 *  `dashboard/page.tsx` (`offreQuiCouvre`) : la moins chère qui couvre le volume du mois. */
function CarteMonteeOffreV2({ jauge, offreDeblocage }: {
  jauge: { utilisees: number; quota: number | null; offre: Plan }
  offreDeblocage: string
}) {
  const cle = (Object.entries(PLAN_LABELS).find(([, label]) => label === offreDeblocage)?.[0] as Plan | undefined) ?? 'pro'
  const carte = PLAN_CARDS.find(c => c.key === cle)
  const avantages = (carte?.features ?? []).slice(0, 3)

  return (
    <div>
      <TitreSection>Débloquer plus de réservations</TitreSection>
      <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-5">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
            <Lock size={12} strokeWidth={2} aria-hidden />
            Offre {offreDeblocage}
          </span>
          <span className={`text-[18px] ${hero} tabular-nums`}>
            {PLAN_PRICES[cle]} €<span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>/mois</span>
          </span>
        </div>

        <p className={`mt-3.5 text-[18px] ${titre}`}>Plus de place pour vos clients</p>
        <p className={`mt-1.5 text-[13px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`}>
          Votre offre {PLAN_LABELS[jauge.offre]} s’arrête à {jauge.quota} réservations par mois. Au-delà, vos clients
          continuent d’arriver — ils restent juste invisibles.
        </p>

        {avantages.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--v2-filet)] pt-3.5">
            {avantages.map(a => (
              <div key={a} className={`flex items-start gap-2 text-[13px] ${corps}`}>
                <Check size={16} strokeWidth={2.6} className="mt-[3px] shrink-0 text-[color:var(--v2-color-vert)]" aria-hidden />
                {a}
              </div>
            ))}
          </div>
        )}

        <Link
          href="/dashboard/abonnement"
          className={`mt-4 flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] text-[14px] ${corpsFort} text-[color:var(--v2-color-sur-accent)] transition-transform active:scale-[.97] motion-reduce:transition-none`}
          style={{ background: 'var(--v2-color-accent)', transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
        >
          Passer à {PLAN_LABELS[cle]} — {PLAN_PRICES[cle]} €/mois
        </Link>
        <Link
          href="/dashboard/abonnement"
          className={`mt-2.5 block text-center text-[12px] ${corps} text-[color:var(--v2-color-gris)] hover:underline`}
        >
          Comparer toutes les offres
        </Link>
      </div>
    </div>
  )
}

// Une carte-liste : surface opaque, filet de 1 px, lignes séparées par un
// filet fin — jamais de verre sous du contenu qu'on doit lire vite (planche
// Système). Mêmes jetons que ParametresFormV2.tsx.
function CarteListe({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
      <div className="px-4 divide-y divide-[color:var(--v2-filet)]">{children}</div>
    </div>
  )
}

/** Le héros de l'écran : l'heure en très gros, le nom, l'adresse, et deux
 *  actions — itinéraire et appel. Tout le reste de l'écran est en ligne. */
function CarteHeros({ rdv: b, dateDuJour }: { rdv: RdvAccueil; dateDuJour: string }) {
  const statut = STATUT[statutAffiche(b)]
  const estAujourdhui = new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === dateDuJour
  const adresse = b.address?.trim()
  const telephone = b.client_phone?.trim()
  // Choix de l'application d'itinéraire (Plans, Waze, Google Maps), ouvert au
  // toucher du bouton — voir ChoixItineraireV2.tsx.
  const [choixItineraire, setChoixItineraire] = useState(false)

  return (
    <div className="rounded-[18px] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
      <Link href={`/dashboard/calendrier?rdv=${b.id}`} className="flex items-start gap-4 px-[18px] pt-[17px] pb-[13px]">
        <span className="flex flex-col">
          {!estAujourdhui && (
            <span className={`text-[12px] ${corpsFort} text-[color:var(--v2-color-gris)] capitalize`}>{jourCourt(b.scheduled_at)}</span>
          )}
          <span className={`text-[44px] leading-none ${hero} tabular-nums`}>{formatHeure(new Date(b.scheduled_at))}</span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px] pt-[3px]">
          <span className={`text-[17px] ${corpsFort} truncate`}>{b.client_name}</span>
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>
            {lignePrestation(b)}
          </span>
          {/* Le prix vit sur la ligne du statut, pas au bout de la prestation :
              une prestation à nom long (« Terrasse 45 m² + hydrofuge ») faisait
              disparaître le montant dans les points de suspension. */}
          <span className="flex items-center justify-between gap-2 pt-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: statut.couleur }} aria-hidden />
              <span className={`truncate text-[12.5px] ${corpsFort}`} style={{ color: statut.couleur }}>
                {statut.label}
              </span>
            </span>
            <span className={`shrink-0 text-[14.5px] ${corpsFort} tabular-nums`}>{prixAffiche(b)}</span>
          </span>
        </span>
      </Link>

      {adresse && (
        <>
          <div className="h-px bg-[color:var(--v2-filet)]" />
          <p className={`flex items-center gap-[9px] px-[18px] py-3 text-[14px] ${corpsFort}`}>
            <MapPin size={16} strokeWidth={1.75} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
            <span className="min-w-0 flex-1">{adresse}</span>
          </p>
        </>
      )}

      {(adresse || telephone) && (
        <div className="flex gap-[9px] px-[14px] pb-[14px]">
          {adresse && (
            <button
              type="button"
              onClick={() => setChoixItineraire(true)}
              aria-haspopup="dialog"
              className={`flex h-[47px] flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] text-[15px] ${corpsFort} text-white transition-transform active:scale-[.97] motion-reduce:transition-none`}
              style={{
                background: 'var(--v2-color-accent)',
                transitionDuration: 'var(--v2-duration-press)',
                transitionTimingFunction: 'var(--v2-ease-out)',
              }}
            >
              <Navigation size={18} strokeWidth={2} aria-hidden />
              Itinéraire
            </button>
          )}
          {telephone && (
            <a
              href={`tel:${telephone}`}
              className={`flex h-[47px] flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97] motion-reduce:transition-none`}
              style={{
                transitionDuration: 'var(--v2-duration-press)',
                transitionTimingFunction: 'var(--v2-ease-out)',
              }}
            >
              <Phone size={18} strokeWidth={2} aria-hidden />
              Appeler
            </a>
          )}
        </div>
      )}

      {choixItineraire && adresse && (
        <ChoixItineraireV2 adresse={adresse} onClose={() => setChoixItineraire(false)} />
      )}
    </div>
  )
}

/** Une ligne de rendez-vous : heure (ou jour), nom, prestation, prix, statut.
 *  Même destination que les widgets v1 — la fiche de l'agenda. */
function LigneRdv({ rdv: b, avecDate = false }: { rdv: RdvAccueil; avecDate?: boolean }) {
  const statut = STATUT[statutAffiche(b)]
  return (
    <Link href={`/dashboard/calendrier?rdv=${b.id}`} className="flex min-h-[46px] items-start gap-3.5 py-[11px]">
      <span
        className={`shrink-0 pt-0.5 text-[15px] ${corpsFort} text-[color:var(--v2-color-gris)] tabular-nums ${
          // Un jour abrégé (« Sam. 26 ») ne tient pas dans la colonne d'heures
          // de 40 px de la planche : il passait à la ligne.
          avecDate ? 'w-[58px] capitalize' : 'w-10'
        }`}
      >
        {avecDate ? jourCourt(b.scheduled_at) : formatHeure(new Date(b.scheduled_at))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={`text-[15px] ${nom} truncate`}>{b.client_name}</span>
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] truncate`}>{lignePrestation(b)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={`text-[15px] ${corpsFort} tabular-nums`}>{prixAffiche(b)}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: statut.couleur }} aria-hidden />
          <span className={`text-[12.5px] ${corpsFort}`} style={{ color: statut.couleur }}>
            {statut.label}
          </span>
        </span>
      </span>
    </Link>
  )
}

/** Une ligne de bloc optionnel : libellé à gauche, valeur à droite, chevron
 *  quand elle mène quelque part. Même forme que le menu « Plus » (passe 6). */
function LigneBloc({ label, valeur, href }: { label: string; valeur: string; href?: string }) {
  const contenu = (
    <>
      <span className={`flex-1 text-[15px] ${corps}`}>{label}</span>
      <span className={`shrink-0 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)] tabular-nums`}>{valeur}</span>
      {href && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
          <path
            d="m9.5 5.5 6.5 6.5-6.5 6.5"
            stroke="var(--v2-color-gris)"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </>
  )
  const classe = 'flex items-center gap-2.5 min-h-[46px] py-1.5 w-full text-left'
  return href ? (
    <Link href={href} className={classe}>
      {contenu}
    </Link>
  ) : (
    <span className={classe}>{contenu}</span>
  )
}

/** Les widgets du laveur, dans SON ordre. `upcoming` reste une section à part
 *  entière (une liste de rendez-vous n'est pas une ligne) ; les cinq autres
 *  sont des lignes, regroupées dans une même carte tant qu'elles se suivent —
 *  sans quoi cinq cartes d'une ligne chacune rempliraient l'écran de vide. */
function BlocsOptionnels({
  widgets,
  rdvProchains,
  stats,
  clients,
  trafic,
  prestationTop,
  zone,
}: {
  widgets: WidgetKey[]
  rdvProchains: RdvAccueil[]
  stats: { terminesCeMois: number; caCeMois: number | null } | null
  clients: { total: number; nouveauxCetteSemaine: number } | null
  trafic: { visiteurs: number; conversions: number } | null
  prestationTop: { nom: string; nombre: number } | null
  zone: ZoneConfig
}) {
  function ligne(cle: WidgetKey): ReactNode {
    switch (cle) {
      case 'stats': {
        if (!stats) return null
        const ca = stats.caCeMois !== null ? ` · ${formatPrice(stats.caCeMois)}` : ''
        return (
          <LigneBloc
            key={cle}
            label="Ce mois"
            valeur={`${stats.terminesCeMois} terminé${stats.terminesCeMois > 1 ? 's' : ''}${ca}`}
            href="/dashboard/chiffres"
          />
        )
      }
      case 'clients': {
        if (!clients) return null
        const nouveaux = clients.nouveauxCetteSemaine > 0 ? ` · +${clients.nouveauxCetteSemaine} cette semaine` : ''
        return <LigneBloc key={cle} label="Clients" valeur={`${clients.total}${nouveaux}`} href="/dashboard/clients" />
      }
      case 'traffic': {
        if (!trafic) return null
        const valeur =
          trafic.visiteurs === 0
            ? 'Aucun cette semaine'
            : `${trafic.visiteurs} · ${formatConversionRate(trafic.conversions, trafic.visiteurs)} ont réservé`
        return <LigneBloc key={cle} label="Visiteurs" valeur={valeur} href="/dashboard/chiffres" />
      }
      case 'services':
        return (
          <LigneBloc
            key={cle}
            label="La plus demandée"
            valeur={prestationTop ? `${prestationTop.nom} · ${prestationTop.nombre}` : 'Aucune ce mois-ci'}
            href="/dashboard/parametres/prestations"
          />
        )
      case 'zone':
        // v2 seulement (cet écran n'existe pas côté site) : la zone se règle
        // depuis le 2026-09-25 dans « Prestations et prix », section `#zone`.
        return <LigneBloc key={cle} label="Zone d’intervention" valeur={resumeZone(zone)} href="/dashboard/parametres/prestations#zone" />
      default:
        return null
    }
  }

  // Les clés en lignes, découpées en paquets successifs : chaque paquet fait
  // une carte. `upcoming` coupe le paquet en cours et rend sa propre section,
  // `today` est la colonne vertébrale et n'est jamais relue ici (voir l'entête
  // du fichier).
  const blocs: ReactNode[] = []
  let paquet: ReactNode[] = []
  const viderPaquet = () => {
    if (paquet.length === 0) return
    blocs.push(
      <section key={`paquet-${blocs.length}`} className="mt-6">
        <CarteListe>{paquet}</CarteListe>
      </section>,
    )
    paquet = []
  }

  for (const cle of widgets) {
    if (cle === 'today') continue
    if (cle === 'upcoming') {
      viderPaquet()
      if (rdvProchains.length > 0) {
        blocs.push(
          <section key="upcoming" className="mt-6">
            <div className="flex items-baseline justify-between gap-2 px-0.5 pb-2">
              <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Ensuite</span>
              <Link href="/dashboard/calendrier" className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
                Tout voir
              </Link>
            </div>
            <CarteListe>
              {rdvProchains.map(b => (
                <LigneRdv key={b.id} rdv={b} avecDate />
              ))}
            </CarteListe>
          </section>,
        )
      }
      continue
    }
    const l = ligne(cle)
    if (l) paquet.push(l)
  }
  viderPaquet()

  return <>{blocs}</>
}

/** Résumé de la zone — simple lecture de `zone_config`, exactement comme le
 *  widget v1 et le menu « Plus », sans règle nouvelle. */
function resumeZone(zone: ZoneConfig): string {
  if (!zone || !zone.enabled) return 'Aucune limite'
  if (zone.type === 'departments') {
    if (zone.departments.length === 1) return NOM_DEPT.get(zone.departments[0]) ?? zone.departments[0]
    return `${zone.departments.length} départements`
  }
  return `${zone.radius_km} km`
}
