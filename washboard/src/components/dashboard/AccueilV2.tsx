'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { MapPin, MoreHorizontal, Navigation, Phone } from 'lucide-react'
import { formatHeure } from '@/lib/dateUtils'
import { formatPrice, finalDisplayPrice } from '@/lib/pricing'
import { effectivePrice } from '@/lib/crmStats'
import { estimateTravelMinutes, haversineKm } from '@/lib/geo'
import { cleStatut, type StatutClef } from '@/lib/calendarLayout'
import { formatConversionRate } from '@/lib/funnelStats'
import { DEPARTMENTS } from '@/lib/france-departments'
import type { WidgetKey } from '@/lib/dashboardWidgets'
import type { ZoneConfig } from '@/types'
import PersonnaliserV2 from '@/components/dashboard/PersonnaliserV2'

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

// Troisième copie de ce tableau dans le projet (CalendrierDashboardV2.tsx,
// ClientProfileModalV2.tsx) — présentation, jamais du calcul, et volontairement
// pas extraite dans cette passe : l'extraction toucherait deux écrans v2 que je
// ne peux pas recapturer faute d'accès à la base sur cette machine. À faire
// quand un quatrième écran en aura besoin, avec les trois captures qui vont
// avec. Convention de la planche Système : un point plein + le mot, jamais une
// pastille pastel.
const STATUT: Record<StatutClef, { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  closed_late: { couleur: 'var(--v2-color-ambre)', label: 'Délai dépassé' },
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
  services: { name: string; price: number; service_categories?: { name: string } | null } | null
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

/** Lien d'itinéraire vers l'adresse du client. URL universelle Google Maps
 *  (aucune clé d'API, ouvre l'application installée quand il y en a une) —
 *  même esprit que `lib/contact.ts`, qui ouvre déjà Gmail et WhatsApp par une
 *  URL. Non vérifié sur un vrai téléphone (voir le compte rendu de passe). */
function lienItineraire(adresse: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`
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
}: Props) {
  const [personnaliser, setPersonnaliser] = useState(false)

  // Le héros : le prochain rendez-vous du jour, et à défaut le prochain tout
  // court. Un écran vide un jour de repos n'aiderait personne à savoir où il
  // va ; la date s'affiche alors dans la carte pour qu'aucune confusion ne
  // soit possible.
  const prochain = rdvAujourdhui[0] ?? rdvProchains[0] ?? null
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

  return (
    <div
      className={`max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      {demarrage}

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

      {aConfirmer.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between gap-2 px-0.5 pb-2">
            <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>À confirmer</span>
            <span className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)] tabular-nums`}>
              {aConfirmer.length} demande{aConfirmer.length > 1 ? 's' : ''}
            </span>
          </div>
          <CarteListe>
            {aConfirmer.map(b => (
              <LigneRdv key={b.id} rdv={b} avecDate />
            ))}
          </CarteListe>
        </section>
      )}

      <BlocsOptionnels
        widgets={widgets}
        rdvProchains={rdvProchains}
        stats={stats}
        clients={clients}
        trafic={trafic}
        prestationTop={prestationTop}
        zone={zone}
      />

      {personnaliser && <PersonnaliserV2 visibles={widgets} onClose={() => setPersonnaliser(false)} />}
    </div>
  )
}

function TitreSection({ children }: { children: ReactNode }) {
  return <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>{children}</p>
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
  const statut = STATUT[cleStatut(b)]
  const estAujourdhui = new Date(b.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) === dateDuJour
  const adresse = b.address?.trim()
  const telephone = b.client_phone?.trim()

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
            <a
              href={lienItineraire(adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex h-[47px] flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] text-[15px] ${corpsFort} text-white transition-transform active:scale-[.97] motion-reduce:transition-none`}
              style={{
                background: 'var(--v2-color-accent)',
                transitionDuration: 'var(--v2-duration-press)',
                transitionTimingFunction: 'var(--v2-ease-out)',
              }}
            >
              <Navigation size={18} strokeWidth={2} aria-hidden />
              Itinéraire
            </a>
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
    </div>
  )
}

/** Une ligne de rendez-vous : heure (ou jour), nom, prestation, prix, statut.
 *  Même destination que les widgets v1 — la fiche de l'agenda. */
function LigneRdv({ rdv: b, avecDate = false }: { rdv: RdvAccueil; avecDate?: boolean }) {
  const statut = STATUT[cleStatut(b)]
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
            href="/dashboard/admin#prestations"
          />
        )
      case 'zone':
        return <LigneBloc key={cle} label="Zone d’intervention" valeur={resumeZone(zone)} href="/dashboard/admin#zone" />
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
