'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { Spinner } from '@/components/ui/Spinner'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import {
  etapesPour, abonnerVisite, abonnerAvancement, ecrireVisite, etapeSuivante, etatAuChargement,
  fermerPourLInstant, lireEtat, lireVisite, serialiserEtat, terminerVisite,
  type EtapeVisite,
} from '@/lib/visiteGuidee'

// Carte de la visite guidée, montée par DashboardShell sur toutes les pages du
// tableau de bord (voir lib/visiteGuidee.ts pour la logique et la liste des arrêts).
//
// Trois présentations, pas des variantes de couleurs de plus :
//  - Site : carte posée en bas de l'écran, contour pulsé sur l'élément visé
//    (comme avant). `data-visite-cible`/`data-visite-active`, voir globals.css.
//  - Application installée, arrêt « regarde » : fond assombri + découpe
//    lumineuse autour de l'élément, carte en bas — bloquant, l'écran réel
//    n'est pas cliquable en dessous (rien à y faire pendant qu'on explique).
//  - Application installée, arrêt `interactif` (Prestations, Horaires,
//    Adresse de départ) : pas de fond sombre, juste un halo qui respire
//    autour de l'élément, carte en bas (comme l'arrêt « regarde » : l'espace y
//    est déjà réservé, DashboardShell), et l'écran réel reste cliquable —
//    le laveur agit pour de vrai, la visite avance toute seule quand c'est
//    fait (voir l'effet « avancement » plus bas).

// Plusieurs éléments peuvent porter la même cible : le premier de la page
// l'emporte. Ex. PrestationsV2 : le « + » d'en-tête, et à défaut (aucune
// catégorie encore) « + Ajouter une catégorie ».
//
// ÉVÉNEMENTIEL, jamais de sondage en boucle (`requestAnimationFrame` à 60
// img/s a d'abord semblé la solution la plus simple pour suivre une cible
// qui bouge après coup — bandeaux chargés plus tard, carte qui finit par la
// recouvrir — mais c'est exactement ce qui saccadait tout le reste sur un
// vrai téléphone : `getBoundingClientRect()` en continu, pour toujours, sur
// TOUTE la durée d'un arrêt, entrait en concurrence avec les animations CSS
// et le thread principal n'en ressortait jamais tout à fait libre — Ryan,
// 2026-10-08 : « aucune fluidité, mode saccadé »). À la place : un
// `ResizeObserver` sur l'ÉLÉMENT (se déclenche s'il change de taille), un
// écouteur de défilement/redimensionnement (se déclenche si la page bouge),
// et une poignée de mesures espacées (200 ms à 3 s) pour rattraper un
// décalage de mise en page qui ne change NI la taille de la cible NI le
// défilement — un bandeau qui charge au-dessus, par exemple (repéré sur
// l'étape « lien », poussée de ~240px sans qu'aucun des deux ne bouge).
//
// Même logique pour l'élément lui-même : sur un arrêt `interactif`, l'écran
// réel reste cliquable, et PrestationsV2 bascule du menu (« Prestations »)
// à l'éditeur (le « + ») SANS changer de route (juste `?vue=` en plus,
// `pathname` ne bouge pas) — l'élément d'origine quitte le DOM, il faut en
// retrouver un nouveau portant la même cible. L'observateur de mutations,
// lui, reste branché toute la durée de l'arrêt (pas seulement le temps de
// la première apparition) pour couvrir ce cas — événementiel aussi : son
// coût est nul tant que rien ne change.
function surligner(cible: string, contourSite: boolean, surRect: (r: DOMRect | null) => void): () => void {
  let element: Element | null = null
  let observateurTaille: ResizeObserver | undefined
  let dernierRect: DOMRect | null = null
  let dernierRecentrage = 0

  const identiques = (a: DOMRect | null, b: DOMRect | null) =>
    a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

  const recouvreLaCarte = (r: DOMRect) => {
    const carte = document.querySelector('.wb-visite-carte')
    return !!carte && r.bottom > carte.getBoundingClientRect().top && r.top < carte.getBoundingClientRect().bottom
  }

  const rapporter = () => {
    const r = element ? element.getBoundingClientRect() : null
    if (!identiques(r, dernierRect)) { dernierRect = r; surRect(r) }
    // Au plus un recentrage par demi-seconde : une correction ponctuelle,
    // jamais un bras de fer avec un défilement manuel.
    const maintenant = performance.now()
    if (r && element && maintenant - dernierRecentrage > 500 && recouvreLaCarte(r)) {
      dernierRecentrage = maintenant
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }

  // `contourSite` : uniquement le site (`!isPwa`, voir l'appel plus bas).
  // L'application a ses propres repères (découpe ou halo) — poser EN PLUS
  // le contour pulsé du site les désalignait (marge de la découpe contre
  // bord exact de l'élément, remarqué par Ryan le 2026-10-07).
  const essayer = (): boolean => {
    if (element && document.contains(element)) return true
    const trouve = document.querySelector(`[data-visite-cible="${cible}"]`)
    if (!trouve) { element = null; return false }
    observateurTaille?.disconnect()
    element = trouve
    if (contourSite) element.setAttribute('data-visite-active', '')
    observateurTaille = new ResizeObserver(rapporter)
    observateurTaille.observe(element)
    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ block: 'center', behavior: sobre ? 'auto' : 'smooth' })
    rapporter()
    return true
  }

  // Couvre à la fois « l'élément arrive après coup » (écran v2 qui attend de
  // savoir s'il est dans l'application, offre sans cet écran…) et « l'élément
  // est remplacé par un autre portant la même cible » (PrestationsV2,
  // menu → éditeur). Reste branché toute la durée de l'arrêt.
  const observateurDom = new MutationObserver(essayer)
  observateurDom.observe(document.body, { childList: true, subtree: true })
  essayer()

  const minuteurs = [200, 500, 1000, 1800, 3000].map(delai => setTimeout(rapporter, delai))
  window.addEventListener('scroll', rapporter, true)
  window.addEventListener('resize', rapporter)

  return () => {
    observateurDom.disconnect()
    observateurTaille?.disconnect()
    minuteurs.forEach(clearTimeout)
    window.removeEventListener('scroll', rapporter, true)
    window.removeEventListener('resize', rapporter)
    element?.removeAttribute('data-visite-active')
    surRect(null)
  }
}

const MARGE_DECOUPE = 8

/** Signaux des cinq arrêts `interactif` — voir `EtapeVisite.interactif`. */
type Avancement = {
  servicesCount?: number
  availabilitiesCount?: number
  baseAddressRempli?: boolean
  phoneRempli?: boolean
  logoRempli?: boolean
}

function valeurInteractif(etape: EtapeVisite | undefined, avancement: Avancement | undefined): boolean | undefined {
  switch (etape?.interactif) {
    case 'services': return (avancement?.servicesCount ?? 0) > 0
    case 'availabilities': return (avancement?.availabilitiesCount ?? 0) > 0
    case 'baseAddress': return !!avancement?.baseAddressRempli
    case 'phone': return !!avancement?.phoneRempli
    case 'logo': return !!avancement?.logoRempli
    default: return undefined
  }
}

/** Position horizontale du pointeur triangulaire (`.wb-visite-fleche`), en
 *  pourcentage de la largeur de la carte, centré sur la cible et resserré
 *  pour ne jamais sortir de la carte (marge de 20px de chaque bord — la
 *  pointe du triangle fait 14px). `null` : pas de cible, pas de flèche. */
function positionFleche(rect: DOMRect | null, carte: HTMLElement | null): number | null {
  if (!rect || !carte) return null
  const carteRect = carte.getBoundingClientRect()
  if (carteRect.width === 0) return null
  const centreCible = rect.left + rect.width / 2
  const xDansLaCarte = centreCible - carteRect.left
  const borne = Math.min(Math.max(xDansLaCarte, 20), carteRect.width - 20)
  return (borne / carteRect.width) * 100
}

/** Barre « Stories » : un segment par arrêt, rempli pour tout arrêt déjà
 *  passé (index < etape) ou en cours (index === etape) — jamais pour les
 *  arrêts à venir. Remplace la barre continue unique : reste lisible même
 *  avec beaucoup d'arrêts (Ryan a cité ce style dès la toute première
 *  demande de ce tuto). */
function BarreProgres({ etape, total }: { etape: number; total: number }) {
  return (
    <div className="wb-visite-progres mt-2" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`wb-visite-segment ${i <= etape ? 'wb-visite-segment--fait' : ''}`}>
          <span />
        </div>
      ))}
    </div>
  )
}

export default function VisiteGuidee({ aFaire, avancement }: { aFaire?: boolean; avancement?: Avancement }) {
  const router = useRouter()
  const pathname = usePathname()
  const isPwa = usePwaStandalone()
  const [navigation, naviguer] = useTransition()
  const etapes = etapesPour(isPwa)
  const etat = lireEtat(useSyncExternalStore(abonnerVisite, lireVisite, () => null), etapes.length)

  useEffect(() => {
    const stocke = lireEtat(lireVisite(), etapes.length)
    const suivant = etatAuChargement(stocke, aFaire)
    if (serialiserEtat(suivant) !== serialiserEtat(stocke)) ecrireVisite(suivant)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `etapes` change seulement avec `isPwa`, pas à chaque rendu
  }, [aFaire])

  const etape = etat.statut === 'en_cours' ? etat.etape : null
  const etapeActuelle = etape === null ? undefined : etapes[etape]
  const cible = etapeActuelle?.cible
  const estInteractif = isPwa && !!etapeActuelle?.interactif

  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!cible) { setRect(null); return }
    return surligner(cible, !isPwa, setRect)
  }, [cible, pathname, isPwa])

  const suivante = etape === null ? null : etapeSuivante(etape, etapes.length)
  const routeSuivante = suivante === null ? undefined : etapes[suivante].route

  // Préchargée dès que l'arrêt s'affiche, pas au clic sur « Suivant » :
  // `router.push` seul, sans ce `prefetch`, va chercher la page au moment du
  // clic — un aller-retour complet (rendu serveur + hydratation) pendant
  // lequel la carte glisse déjà, visiblement saccadé sur un téléphone pas
  // très puissant (mesuré : jusqu'à 530 ms de blocage sur une image, contre
  // ~110 ms une fois préchargée — Ryan, 2026-10-08). `router.prefetch`
  // n'est qu'un indice pour Next ; rien à défaire si l'arrêt change avant.
  useEffect(() => {
    if (routeSuivante) router.prefetch(routeSuivante)
  }, [routeSuivante, router])

  // « Un beau déplacement » : la View Transition native du navigateur anime
  // elle-même le passage d'une découpe à l'autre — position ET apparence
  // (dark-découpe ↔ halo clair) comprises — plutôt que le simple `transition`
  // CSS précédent qui ne savait que glisser top/left/width/height (Ryan,
  // 2026-10-09 : « fais-moi des beaux déplacements, fluides » après un
  // premier passage jugé trop timide). `view-transition-name: wb-visite-spot`
  // (globals.css) marque la cible comme un seul élément continu d'un arrêt à
  // l'autre ; le navigateur se charge de la morpher. Non supporté (Safari
  // < 18) : la fonction retombe sur `naviguer()` seule, et la transition CSS
  // déjà en place (surligner()/.wb-visite-decoupe) prend le relais comme
  // avant — aucune régression, juste moins de magie.
  //
  // Le callback de `startViewTransition` doit durer jusqu'à ce que le NOUVEL
  // état soit vraiment peint, pas juste déclenché : une navigation Next.js
  // est asynchrone (aller chercher le rendu serveur), donc on ne résout que
  // lorsque `navigation` (l'indicateur de `useTransition`) redevient faux —
  // avec un filet de 1,5 s pour ne jamais bloquer la page si ça traîne.
  const resoudreTransitionRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!navigation && resoudreTransitionRef.current) {
      const resoudre = resoudreTransitionRef.current
      resoudreTransitionRef.current = null
      resoudre()
    }
  }, [navigation])

  // Enveloppe une mise à jour SYNCHRONE (pas de navigation à attendre) dans
  // la View Transition native : `flushSync` la fait aboutir avant que le
  // navigateur ne prenne son instantané « après » (le contrat de
  // `startViewTransition`). Sert à « Passer » et « Terminé » autant qu'aux
  // arrêts sans route — fermer le tuto mérite le même soin qu'avancer dedans,
  // pas une disparition sèche.
  function synchroVue(fn: () => void) {
    const sobre = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (sobre || typeof document === 'undefined' || !document.startViewTransition) { fn(); return }
    document.startViewTransition(() => flushSync(fn))
  }

  function fermer() {
    synchroVue(fermerPourLInstant)
  }

  function avancer() {
    if (suivante === null) { synchroVue(terminerVisite); return }
    const route = etapes[suivante].route
    // Écrit tout de suite, jamais après coup : `DashboardShell` est rendu par
    // chaque page séparément (pas un layout partagé), donc cette instance ne
    // survit pas à la navigation — un état « en attente » gardé dans le
    // composant se perdrait avec lui, et la carte resterait bloquée sur
    // l'arrêt de départ. Le flottement visuel pendant le chargement se traite
    // à l'affichage (bouton en chargement ci-dessous), pas en retardant l'écriture.
    const appliquer = () => {
      ecrireVisite({ statut: 'en_cours', etape: suivante })
      // Arrêt sans route (ex. « regarde cet onglet ») : on reste sur la page,
      // rien à attendre — naviguer vers `undefined` n'aurait aucun sens.
      if (route) naviguer(() => router.push(route))
    }
    if (!route) { synchroVue(appliquer); return }

    const sobre = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (sobre || typeof document === 'undefined' || !document.startViewTransition) { appliquer(); return }
    document.startViewTransition(
      () =>
        new Promise<void>(resoudre => {
          resoudreTransitionRef.current = resoudre
          appliquer()
          setTimeout(() => {
            if (resoudreTransitionRef.current === resoudre) { resoudreTransitionRef.current = null; resoudre() }
          }, 1500)
        }),
    )
  }

  // Avance toute seule quand le laveur fait l'action réelle. `avancement` (les
  // props servies par la page au premier rendu) dit seulement si c'était DÉJÀ
  // fait en arrivant — PrestationsV2/HorairesV2 gardent leur propre état local
  // après une écriture sans rappeler le serveur (`usePrestationsV2`,
  // `useHorairesV2` : affichage optimiste assumé), donc cette prop ne bouge
  // plus ensuite. Une écriture EN COURS de visite arrive par
  // `signalerAvancement` (visiteGuidee.ts), posé juste après chaque écriture
  // réussie dans ces deux hooks et dans `ProfilV2`.
  const avancerRef = useRef(avancer)
  useEffect(() => { avancerRef.current = avancer })

  // Position horizontale de la flèche, recalculée à chaque changement de
  // cible/rect (pas en continu : `rect` ne change que sur un vrai
  // déplacement, voir `surligner()`).
  const carteRef = useRef<HTMLDivElement>(null)
  const [flecheX, setFlecheX] = useState<number | null>(null)
  useEffect(() => {
    setFlecheX(positionFleche(rect, carteRef.current))
  }, [rect])
  const styleCarte: CSSProperties = { bottom: 'calc(14px + 66px + 10px + env(safe-area-inset-bottom, 0px))' }
  if (flecheX !== null) (styleCarte as Record<string, string>)['--wb-fleche-x'] = `${flecheX}%`

  // Trois états, pas un booléen : « déjà fait en arrivant » (compte déjà
  // configuré, ex. en rejouant le tuto depuis le Guide) et « vient d'être
  // fait PENDANT cette visite » se ressemblaient avant le 2026-10-09 — même
  // minuterie de 900ms, même texte éclair « Fait ✓ ». Ryan, en testant sur
  // un compte déjà configuré : « ça va très vite... on a l'impression que ça
  // bug ». Séparés maintenant : le premier montre l'explication COMPLÈTE,
  // sans avancer tout seul (comme n'importe quel arrêt « regarde ») ; le
  // second garde la confirmation éclair + l'avance automatique, le seul cas
  // où aller vite communique quelque chose (« je viens de voir ce que tu as
  // fait »).
  const dejaSatisfait = valeurInteractif(etapeActuelle, avancement) === true
  const [etatInteractif, setEtatInteractif] = useState<'attente' | 'deja_fait' | 'vient_de_reussir'>('attente')
  useEffect(() => {
    const cle = etapeActuelle?.interactif
    if (!cle) { setEtatInteractif('attente'); return }
    if (dejaSatisfait) { setEtatInteractif('deja_fait'); return }
    setEtatInteractif('attente')
    return abonnerAvancement((c) => {
      if (c !== cle) return
      setEtatInteractif('vient_de_reussir')
      // Un petit coup, pas une sonnerie : confirme l'action sans la fêter.
      // Seulement ici (l'action vient vraiment d'arriver), jamais pour
      // « déjà fait » — vibrer pour quelque chose déjà fait avant d'arriver
      // n'aurait rien à confirmer. Android/Chrome uniquement (PWA installée) ;
      // `navigator.vibrate` n'existe simplement pas ailleurs, no-op silencieux.
      navigator.vibrate?.(15)
      setTimeout(() => avancerRef.current(), 900)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `etapeActuelle` est dérivée de `etape` (même tableau `etapes`) : le réécouter à chaque rendu resouscrirait sans raison.
  }, [etape, dejaSatisfait])

  if (etape === null || !etapeActuelle) return null

  if (estInteractif) {
    const vientDeReussir = etatInteractif === 'vient_de_reussir'
    const dejaFaitAffiche = etatInteractif === 'deja_fait'
    return (
      <div className="fixed inset-0 z-[70] pointer-events-none" role="status" aria-label="Visite guidée">
        {rect && (
          <div
            aria-hidden
            className={`wb-visite-halo absolute rounded-2xl ${vientDeReussir ? 'wb-visite-halo-ok' : ''}`}
            style={{
              top: rect.top - MARGE_DECOUPE, left: rect.left - MARGE_DECOUPE,
              width: rect.width + MARGE_DECOUPE * 2, height: rect.height + MARGE_DECOUPE * 2,
            }}
          />
        )}
        <div
          ref={carteRef}
          className="wb-visite-verre wb-visite-carte pointer-events-auto absolute left-3 right-3 rounded-[var(--v2-radius-surface)] text-[color:var(--v2-color-encre)] p-4"
          style={styleCarte}
        >
          {flecheX !== null && <div className="wb-visite-fleche" aria-hidden />}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
                Étape {etape + 1}/{etapes.length}
              </p>
              {dejaFaitAffiche && <span className={`wb-visite-badge-fait text-[11px] ${corpsFort}`}>✓ Déjà fait</span>}
            </div>
            <button
              type="button"
              onClick={fermer}
              className={`-my-2 -mr-2 px-2 py-2 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
            >
              Passer
            </button>
          </div>
          <p key={etape} aria-live="polite" className={`wb-visite-texte mt-2.5 text-[15px] leading-snug ${corps}`}>
            {vientDeReussir ? 'Fait ✓' : etapeActuelle.texte}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              {vientDeReussir
                ? 'On continue…'
                : dejaFaitAffiche
                  ? 'Déjà configuré — tu peux continuer.'
                  : "L'écran reste à toi — la visite avance dès que c'est fait."}
            </p>
            <button
              type="button"
              onClick={avancer}
              disabled={navigation || vientDeReussir}
              className={`h-9 shrink-0 px-4 rounded-[var(--v2-radius-bouton)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-accent)] border border-[color:var(--v2-filet-fort)] disabled:opacity-50 transition-opacity`}
            >
              {navigation ? <Spinner /> : dejaFaitAffiche ? 'Suivant' : 'Plus tard'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isPwa) {
    return (
      <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Visite guidée">
        {rect ? (
          <div
            aria-hidden
            className="wb-visite-decoupe absolute rounded-2xl"
            style={{
              top: rect.top - MARGE_DECOUPE,
              left: rect.left - MARGE_DECOUPE,
              width: rect.width + MARGE_DECOUPE * 2,
              height: rect.height + MARGE_DECOUPE * 2,
              boxShadow: '0 0 0 9999px rgba(10,10,12,.35)',
            }}
          />
        ) : (
          <div aria-hidden className="wb-visite-fond absolute inset-0" style={{ background: 'rgba(10,10,12,.35)' }} />
        )}

        <div
          ref={carteRef}
          className="wb-visite-verre wb-visite-carte absolute left-3 right-3 rounded-[var(--v2-radius-surface)] text-[color:var(--v2-color-encre)] p-4"
          style={styleCarte}
        >
          {flecheX !== null && <div className="wb-visite-fleche" aria-hidden />}
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
              Étape {etape + 1}/{etapes.length}
            </p>
            <button
              type="button"
              onClick={fermer}
              className={`-my-2 -mr-2 px-2 py-2 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
            >
              Passer
            </button>
          </div>
          <BarreProgres etape={etape} total={etapes.length} />
          <p key={etape} aria-live="polite" className={`wb-visite-texte mt-3 text-[15px] leading-snug ${corps}`}>
            {etapeActuelle.texte}
          </p>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={avancer}
              disabled={navigation}
              className={`h-10 px-5 rounded-[var(--v2-radius-bouton)] text-[15px] ${corpsFort} text-white bg-[color:var(--v2-color-accent)] disabled:opacity-50 transition-opacity`}
            >
              {navigation ? (
                <span className="flex items-center justify-center gap-2"><Spinner />Chargement…</span>
              ) : suivante === null ? 'Terminé' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Réserve sous le contenu : sans elle, la carte couvrirait le bas de la
          page sans qu'on puisse le faire défiler au-dessus. */}
      <div aria-hidden className="h-44" />
      <section
        aria-label="Visite guidée"
        className="fixed z-[15] left-3 right-20 sm:right-auto sm:w-[23rem] p-4 sm:left-6 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg shadow-slate-900/10"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#1651E8] dark:text-[#00C4D4]">Étape {etape + 1}/{etapes.length}</p>
          <button
            type="button"
            onClick={fermerPourLInstant}
            className="-my-2 -mr-2 px-2 py-2 transition-colors text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            Passer
          </button>
        </div>
        <div className="mt-2 h-1 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800" aria-hidden>
          <div
            className="h-full rounded-full bg-[#1651E8] dark:bg-[#00C4D4] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((etape + 1) / etapes.length) * 100}%` }}
          />
        </div>
        <p aria-live="polite" className="mt-3 text-sm leading-snug">{etapeActuelle.texte}</p>
        {etapeActuelle.chemin && (
          <p className="mt-1.5 text-xs leading-snug text-slate-400 dark:text-slate-500">{etapeActuelle.chemin}</p>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={avancer}
            disabled={navigation}
            className="h-10 px-5 transition-colors disabled:opacity-50 rounded-xl text-sm font-semibold text-white bg-[#1651E8] hover:bg-[#0F4ACC] shadow-lg shadow-[#1651E8]/20"
          >
            {navigation ? (
              <span className="flex items-center justify-center gap-2"><Spinner />Chargement…</span>
            ) : suivante === null ? 'Terminé' : 'Suivant'}
          </button>
        </div>
      </section>
    </>
  )
}
