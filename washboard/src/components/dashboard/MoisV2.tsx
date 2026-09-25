'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronLeft } from 'lucide-react'
import { dayKey, isSameDay } from '@/lib/calendarLayout'
import { cleMois, colonnePremierJour, compterActifsParJour, plageDeMois, pointsRendezVous, semainesDuMois } from '@/lib/vueMois'
import { police, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import type { Booking, Unavailability } from '@/components/dashboard/CalendrierDashboardV1'

// Vue « mois » de l'agenda v2 — réservée à la PWA installée en mode standalone
// (voir CalendrierDashboardV2.tsx, qui la rend ; le site reste en v1, décision
// d'Alexandre 2026-09-22). Passe 7 de la refonte 2026, demande d'Alexandre du
// 2026-09-24 : « une vue du mois comme Apple le propose, on change de mois en
// scrollant, on peut choisir une date et ça se met sur la semaine ».
//
// Modèle : le Calendrier d'Apple sur iPhone, vue du mois. Pas d'artboard dans
// la maquette pour cet écran — valeurs reprises des conventions v2 déjà posées
// (jetons `--v2-*`, Archivo, « point plein + le mot », cible tactile 44 px).
//
// **Une couche plein écran, pas un bloc de page.** L'agenda reste monté dessous
// (rien n'est perdu : jour affiché, feuilles, trajets déjà calculés), marqué
// `inert` par l'appelant pendant que la vue est ouverte. Position fixe plutôt
// que dans le flux, pour que l'en-tête collant ne dépende pas de la présence de
// la barre d'en-tête de l'appli (en cours de retrait dans la PWA) : il colle au
// haut de l'écran quoi qu'il y ait au-dessus. Sous la barre du bas (z-15), sous
// le menu latéral (z-20/30), au-dessus de l'en-tête de page (z-10).
//
// **Le verre est un matériau de châssis, jamais de contenu** (refonte.md) :
// seul l'en-tête, sous lequel les mois défilent, est translucide — voile de la
// couleur de fond + flou, sans ajouter de jeton. La grille, elle, est posée sur
// le fond papier opaque.
//
// **Défilement continu et coût.** 37 mois (−12/+24) ≈ 1 100 cases de jour.
// Chaque mois est un bloc à hauteur EXACTE connue d'avance (HAUT_TITRE +
// semaines × HAUT_LIGNE), ce qui permet deux choses. 1) Ne rendre le contenu
// d'un mois que lorsqu'il approche de l'écran (IntersectionObserver, un écran
// d'avance) : les blocs restent tous là, vides, à leur vraie hauteur, donc la
// géométrie du défilement ne bouge pas. Mesuré : le coût d'ouverture vient du
// rendu React des boutons, pas de la mise en page — `content-visibility` seul
// ne le réduisait pas. 2) `content-visibility: auto` en complément, pour les
// mois déjà rendus qu'on a dépassés (défilement long). Hauteurs fixes en px :
// elles ne suivent pas l'agrandissement du texte du système — voir « ce qui
// n'est pas vérifié » du compte rendu.
//
// Aucune donnée n'est chargée ici : `byDate` et les congés viennent de l'agenda.

const MOIS_AVANT = 12
const MOIS_APRES = 24
const HAUT_TITRE = 52
const HAUT_LIGNE = 60
// Barre du bas (66 px) + son écart (14 px) + de l'air : le dernier mois doit
// pouvoir remonter entièrement au-dessus d'elle.
const BAS_RESERVE = 'calc(66px + 14px + 24px + env(safe-area-inset-bottom, 0px))'

const MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const JOURS_INITIALE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Un seul formateur pour les ~1 300 étiquettes : `toLocaleDateString` en
// recrée un à chaque appel, ce qui se compte en dizaines de millisecondes sur
// un téléphone modeste.
const FORMAT_JOUR = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

function reduireMouvement(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type Props = {
  /** Jour actuellement affiché dans l'agenda : la vue s'ouvre sur son mois. */
  jourAffiche: Date
  aujourdhui: Date
  /** Rendez-vous par jour (clés `dayKey`), tel que l'agenda le tient déjà. */
  byDate: Map<string, Booking[]>
  getUnavail: (d: Date) => Unavailability | null
  /** Le jour choisi : l'agenda se cale dessus PENDANT le zoom, la vue se ferme ensuite (`onFermer`). */
  onChoisir: (d: Date) => void
  onFermer: () => void
  /** Ordonnée (px, écran) du centre du bandeau de 7 jours de l'agenda : la semaine
   *  choisie glisse jusque-là. `null` si le bandeau n'est pas mesurable. */
  getBandeauCentre?: () => number | null
}

// Transition mois ⇄ jour, copiée sur le Calendrier d'Apple (vidéo d'Alexandre,
// 2026-09-25) : la RANGÉE de la semaine touchée reste, et glisse jusqu'à la place
// du bandeau de la semaine ; les rangées au-dessus partent vers le haut, celles
// du dessous vers le bas, en s'effaçant ; le fond se dissout sur l'agenda du jour.
// L'ouverture du mois joue la même chose à l'envers. Web Animations plutôt que du
// CSS : la géométrie (position de la rangée, du bandeau) n'est connue qu'à
// l'exécution.
const DUREE_TRANSITION_MS = 360
const DECALAGE_AUTRES_PX = 90
const EASE_SORTIE = 'cubic-bezier(.23, 1, .32, 1)'

function animerTransition(
  couche: HTMLElement,
  entete: HTMLElement | null,
  rangeeChoisie: HTMLElement,
  bandeauCentre: number | null,
  sens: 'sortie' | 'entree',
) {
  const opts: KeyframeAnimationOptions = {
    duration: DUREE_TRANSITION_MS,
    easing: EASE_SORTIE,
    fill: 'both',
    direction: sens === 'sortie' ? 'normal' : 'reverse',
  }
  const boite = rangeeChoisie.getBoundingClientRect()
  const centre = boite.top + boite.height / 2
  const deplacement = bandeauCentre === null ? 0 : bandeauCentre - centre
  const hauteurEcran = window.innerHeight
  for (const el of couche.querySelectorAll<HTMLElement>('[data-semaine], [data-titre-mois]')) {
    const r = el.getBoundingClientRect()
    if (r.bottom < -120 || r.top > hauteurEcran + 120) continue
    if (el === rangeeChoisie) {
      el.animate([
        { transform: 'translateY(0)', opacity: 1 },
        { transform: `translateY(${deplacement}px)`, opacity: 1, offset: 0.6 },
        { transform: `translateY(${deplacement}px)`, opacity: 0 },
      ], opts)
    } else {
      const versLeHaut = r.top < boite.top
      el.animate([
        { transform: 'translateY(0)', opacity: 1 },
        { transform: `translateY(${versLeHaut ? -DECALAGE_AUTRES_PX : DECALAGE_AUTRES_PX}px)`, opacity: 0 },
      ], opts)
    }
  }
  entete?.animate([{ opacity: 1 }, { opacity: 0 }], opts)
  // Le fond ne se dissout qu'après un tiers du trajet : les rangées ne flottent
  // pas d'emblée sur l'agenda.
  const fond = getComputedStyle(couche).backgroundColor
  couche.animate([
    { backgroundColor: fond },
    { backgroundColor: fond, offset: 0.3 },
    { backgroundColor: 'rgba(0, 0, 0, 0)' },
  ], opts)
}

export default function MoisV2({ jourAffiche, aujourdhui, byDate, getUnavail, onChoisir, onFermer, getBandeauCentre }: Props) {
  const coucheRef = useRef<HTMLDivElement>(null)
  const enteteRef = useRef<HTMLDivElement>(null)
  const retourRef = useRef<HTMLButtonElement>(null)
  // Un jour vient d'être choisi : la transition de sortie est en cours, plus aucun
  // toucher n'est pris en compte.
  const [sortant, setSortant] = useState(false)
  const minuterieSortie = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (minuterieSortie.current) clearTimeout(minuterieSortie.current) }, [])

  function choisir(jour: Date, caseJour: HTMLElement) {
    if (sortant) return
    // L'agenda se cale sur le jour (et remonte en haut) AVANT la mesure du bandeau.
    onChoisir(jour)
    const couche = coucheRef.current
    const rangee = caseJour.closest<HTMLElement>('[data-semaine]')
    if (reduireMouvement() || !couche || !rangee) { onFermer(); return }
    setSortant(true)
    animerTransition(couche, enteteRef.current, rangee, getBandeauCentre?.() ?? null, 'sortie')
    minuterieSortie.current = setTimeout(onFermer, DUREE_TRANSITION_MS)
  }

  const plage = useMemo(() => plageDeMois(aujourdhui, MOIS_AVANT, MOIS_APRES, jourAffiche), [aujourdhui, jourAffiche])
  const compte = useMemo(() => compterActifsParJour(byDate), [byDate])

  // Mois vers lequel la vue est (ou va être) calée : à l'ouverture, celui du jour
  // affiché ; ensuite, celui de « Aujourd'hui ». `n` fait qu'un second tap sur
  // « Aujourd'hui » relance le défilement même si la cible est la même.
  const [cible, setCible] = useState({ annee: jourAffiche.getFullYear(), mois: jourAffiche.getMonth(), doux: false, n: 0 })
  const rangCible = cible.annee * 12 + cible.mois

  // Le bloc cible et ses quatre voisins (deux de chaque côté : la transition de l’agenda anime tout ce qui est à l’écran) sont rendus AVANT le défilement : sans
  // ça, un saut lointain (« Aujourd'hui » depuis 18 mois plus loin) atterrirait
  // sur du vide le temps qu'ils se rendent.
  useLayoutEffect(() => {
    const couche = coucheRef.current
    const bloc = couche?.querySelector<HTMLElement>(`[data-mois="${cleMois(cible.annee, cible.mois)}"]`)
    if (!couche || !bloc) return
    // Le bloc se cale juste sous l'en-tête collant, qui fait partie du flux
    // (donc de `offsetTop`) : on retire sa hauteur.
    const haut = bloc.offsetTop - (enteteRef.current?.offsetHeight ?? 0)
    // Un défilement animé sur 20 000 px n'a pas de sens : au-delà d'un écran et
    // demi on saute. Idem pour qui a demandé moins de mouvement.
    const loin = Math.abs(haut - couche.scrollTop) > window.innerHeight * 1.5
    couche.scrollTo({ top: haut, behavior: cible.doux && !loin && !reduireMouvement() ? 'smooth' : 'auto' })
  }, [cible])

  // Ouverture : la même transition, à l'envers, à partir de la semaine du jour
  // affiché. Après le calage du défilement ci-dessus (même ordre de déclaration).
  useLayoutEffect(() => {
    const couche = coucheRef.current
    const rangee = couche?.querySelector<HTMLElement>('[aria-current="date"]')?.closest<HTMLElement>('[data-semaine]')
    if (!couche || !rangee || reduireMouvement()) return
    animerTransition(couche, enteteRef.current, rangee, getBandeauCentre?.() ?? null, 'entree')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'ouverture
  }, [])

  // Le focus va au bouton de retour (jamais dans la grille : 1 300 boutons), et
  // revient à l'élément d'origine à la fermeture.
  useEffect(() => {
    const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null
    retourRef.current?.focus({ preventScroll: true })
    return () => { if (precedent?.isConnected) precedent.focus({ preventScroll: true }) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFermer])

  return (
    <div
      ref={coucheRef}
      role="region"
      aria-label="Vue du mois"
      className={`fixed inset-0 z-[12] overflow-y-auto overscroll-contain bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
      style={sortant ? { pointerEvents: 'none' } : undefined}
    >
      <div
        ref={enteteRef}
        className="sticky top-0 z-10 border-b border-[color:var(--v2-filet)]"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'color-mix(in srgb, var(--v2-color-fond) 78%, transparent)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        }}
      >
        <div className="mx-auto max-w-lg px-3 sm:px-4">
          <div className="flex items-center justify-between">
            <button
              ref={retourRef}
              type="button"
              onClick={onFermer}
              aria-label="Retour à la semaine"
              className={`-ml-2 flex h-11 items-center gap-0.5 pl-1 pr-3 text-[16px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
            >
              <ChevronLeft size={22} strokeWidth={2.25} aria-hidden />
              Semaine
            </button>
            <button
              type="button"
              onClick={() => setCible(c => ({ annee: aujourdhui.getFullYear(), mois: aujourdhui.getMonth(), doux: true, n: c.n + 1 }))}
              className={`-mr-2 flex h-11 items-center px-3 text-[16px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
            >
              Aujourd’hui
            </button>
          </div>
          <div className="grid grid-cols-7 pb-1.5" aria-hidden>
            {JOURS_INITIALE.map((l, i) => (
              <span key={i} className={`text-center text-[12px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-3 sm:px-4" style={{ paddingBottom: BAS_RESERVE }}>
        {plage.map(({ annee, mois }) => (
          <BlocMois
            key={cleMois(annee, mois)}
            annee={annee}
            mois={mois}
            coucheRef={coucheRef}
            proche={Math.abs(annee * 12 + mois - rangCible) <= 2}
            aujourdhui={aujourdhui}
            jourAffiche={jourAffiche}
            compte={compte}
            getUnavail={getUnavail}
            onChoisir={choisir}
          />
        ))}
      </div>
    </div>
  )
}

function BlocMois({
  annee, mois, coucheRef, proche, aujourdhui, jourAffiche, compte, getUnavail, onChoisir,
}: {
  annee: number
  mois: number
  coucheRef: RefObject<HTMLDivElement | null>
  /** Le mois cible du défilement ou l'un de ses voisins : rendu d'emblée. */
  proche: boolean
  aujourdhui: Date
  jourAffiche: Date
  compte: Map<string, number>
  getUnavail: (d: Date) => Unavailability | null
  onChoisir: (d: Date, caseJour: HTMLElement) => void
}) {
  const semaines = semainesDuMois(annee, mois)
  const hauteur = HAUT_TITRE + semaines.length * HAUT_LIGNE
  const col = colonnePremierJour(annee, mois)

  // Un mois n'est rendu que lorsqu'il approche de l'écran (un écran d'avance),
  // puis reste rendu. Les 37 blocs existent toujours, à leur hauteur exacte :
  // la géométrie du défilement ne bouge pas, seul le contenu arrive à temps.
  // Mesuré (voir compte rendu) : `content-visibility` seul ne diminuait pas le
  // coût d'ouverture — c'est le rendu React de ~1 100 boutons qui pèse, pas la
  // mise en page.
  const [vu, setVu] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const noeud = ref.current
    if (vu || !noeud) return
    const obs = new IntersectionObserver(
      entrees => { if (entrees.some(e => e.isIntersecting)) setVu(true) },
      { root: coucheRef.current, rootMargin: '100% 0px' },
    )
    obs.observe(noeud)
    return () => obs.disconnect()
  }, [vu, coucheRef])
  const rendu = proche || vu

  return (
    <section
      ref={ref}
      data-mois={cleMois(annee, mois)}
      aria-label={`${MOIS[mois]} ${annee}`}
      style={{ height: hauteur, contentVisibility: 'auto', containIntrinsicSize: `auto ${hauteur}px` }}
    >
      {rendu && <>
      {/* Le nom du mois s'aligne sur la colonne du 1er, comme sur iPhone ; on le
          ramène vers la gauche quand ce serait trop près du bord pour tenir. */}
      <h2
        data-titre-mois
        className={`flex items-end pb-2 text-[22px] ${titre}`}
        style={{ height: HAUT_TITRE, paddingLeft: `min(calc(${col} * 100% / 7), calc(100% - 12rem))` }}
      >
        <span>
          {MOIS[mois]}
          {annee !== aujourdhui.getFullYear() && (
            <span className={`ml-1.5 text-[color:var(--v2-color-gris)] ${corps}`}>{annee}</span>
          )}
        </span>
      </h2>
      {semaines.map((semaine, i) => (
        <div key={i} data-semaine className="grid grid-cols-7 border-t border-[color:var(--v2-filet)]" style={{ height: HAUT_LIGNE }}>
          {semaine.map((jour, c) => jour
            ? (
              <CaseJour
                key={c}
                jour={jour}
                weekend={c >= 5}
                estAujourdhui={isSameDay(jour, aujourdhui)}
                estAffiche={isSameDay(jour, jourAffiche)}
                rendezVous={compte.get(dayKey(jour)) ?? 0}
                enConge={getUnavail(jour) !== null}
                onChoisir={onChoisir}
              />
            )
            : <span key={c} aria-hidden />)}
        </div>
      ))}
      </>}
    </section>
  )
}

function CaseJour({
  jour, weekend, estAujourdhui, estAffiche, rendezVous, enConge, onChoisir,
}: {
  jour: Date
  weekend: boolean
  estAujourdhui: boolean
  estAffiche: boolean
  rendezVous: number
  enConge: boolean
  onChoisir: (d: Date, caseJour: HTMLElement) => void
}) {
  const { points, plus } = pointsRendezVous(rendezVous)
  // Aujourd'hui : rond plein d'accent. Le jour affiché dans l'agenda, s'il en
  // est un autre : rond encre — même convention que le bandeau de 7 jours. Le
  // week-end s'estompe (gris) tant qu'aucun rond ne le porte.
  const rond = estAujourdhui
    ? 'bg-[color:var(--v2-color-accent)] text-white'
    : estAffiche
      ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)]'
      : weekend ? 'text-[color:var(--v2-color-gris)]' : 'text-[color:var(--v2-color-encre)]'
  const etiquette = [
    estAujourdhui ? 'Aujourd’hui' : null,
    FORMAT_JOUR.format(jour),
    rendezVous > 0 ? `${rendezVous} rendez-vous` : null,
    enConge ? 'indisponible' : null,
  ].filter(Boolean).join(', ')
  return (
    <button
      type="button"
      onClick={e => onChoisir(jour, e.currentTarget)}
      aria-label={etiquette}
      aria-current={estAffiche ? 'date' : undefined}
      className="flex flex-col items-center gap-1 rounded-[var(--v2-radius-bouton)] pt-[7px] transition-colors active:bg-[color:var(--v2-filet)]"
      style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
    >
      <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[17px] tabular-nums ${corpsFort} ${rond}`}>
        {jour.getDate()}
      </span>
      <span className="flex h-2 items-center gap-[3px]" aria-hidden>
        {Array.from({ length: points }, (_, k) => (
          <span key={k} className="h-[6px] w-[6px] rounded-full bg-[color:var(--v2-color-encre)]" />
        ))}
        {plus && <span className={`text-[10px] leading-none ${corpsFort} text-[color:var(--v2-color-gris)]`}>+</span>}
        {enConge && <span className="h-[6px] w-[6px] rounded-full" style={{ background: 'var(--v2-color-ambre)' }} />}
      </span>
    </button>
  )
}
