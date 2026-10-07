'use client'

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
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

/** Signaux des trois arrêts `interactif` — voir `EtapeVisite.interactif`. */
type Avancement = { servicesCount?: number; availabilitiesCount?: number; baseAddressRempli?: boolean }

function valeurInteractif(etape: EtapeVisite | undefined, avancement: Avancement | undefined): boolean | undefined {
  switch (etape?.interactif) {
    case 'services': return (avancement?.servicesCount ?? 0) > 0
    case 'availabilities': return (avancement?.availabilitiesCount ?? 0) > 0
    case 'baseAddress': return !!avancement?.baseAddressRempli
    default: return undefined
  }
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

  function avancer() {
    if (suivante === null) { terminerVisite(); return }
    // Écrit tout de suite, jamais après coup : `DashboardShell` est rendu par
    // chaque page séparément (pas un layout partagé), donc cette instance ne
    // survit pas à la navigation — un état « en attente » gardé dans le
    // composant se perdrait avec lui, et la carte resterait bloquée sur
    // l'arrêt de départ. Le flottement visuel pendant le chargement se traite
    // à l'affichage (bouton en chargement ci-dessous), pas en retardant l'écriture.
    ecrireVisite({ statut: 'en_cours', etape: suivante })
    const route = etapes[suivante].route
    // Arrêt sans route (ex. « regarde cet onglet ») : on reste sur la page,
    // rien à attendre — naviguer vers `undefined` n'aurait aucun sens.
    if (route) naviguer(() => router.push(route))
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
  const dejaSatisfait = valeurInteractif(etapeActuelle, avancement) === true
  const [vientDeReussir, setVientDeReussir] = useState(false)
  useEffect(() => {
    const cle = etapeActuelle?.interactif
    if (!cle) { setVientDeReussir(false); return }
    // Déjà fait avant même d'arriver (ex. « Revoir le tuto » sur un compte
    // configuré) : le MÊME état « Fait ✓ » que lorsque ça vient de se
    // produire, jamais un saut silencieux à l'arrêt suivant — un arrêt qui
    // disparaît sans rien montrer se lit comme un bug, pas comme un pas de
    // plus (vu chez Ryan le 2026-10-08 : « passé de l'étape 3 à l'étape 10 »,
    // trois arrêts déjà satisfaits avalés d'un coup, sans un seul rendu entre
    // les deux pour le montrer).
    if (dejaSatisfait) {
      setVientDeReussir(true)
      const t = setTimeout(() => avancerRef.current(), 900)
      return () => clearTimeout(t)
    }
    setVientDeReussir(false)
    return abonnerAvancement((c) => {
      if (c !== cle) return
      setVientDeReussir(true)
      setTimeout(() => avancerRef.current(), 900)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `etapeActuelle` est dérivée de `etape` (même tableau `etapes`) : le réécouter à chaque rendu resouscrirait sans raison.
  }, [etape, dejaSatisfait])

  if (etape === null || !etapeActuelle) return null

  if (isPwa && estInteractif) {
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
          className="wb-visite-carte pointer-events-auto absolute left-3 right-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] shadow-[0_12px_32px_rgba(0,0,0,.35)] p-4"
          style={{ bottom: 'calc(14px + 66px + 10px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
              Étape {etape + 1}/{etapes.length}
            </p>
            <button
              type="button"
              onClick={fermerPourLInstant}
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
              {vientDeReussir ? 'On continue…' : "L'écran reste à toi — la visite avance dès que c'est fait."}
            </p>
            <button
              type="button"
              onClick={avancer}
              disabled={navigation || vientDeReussir}
              className={`h-9 shrink-0 px-4 rounded-[var(--v2-radius-bouton)] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-accent)] border border-[color:var(--v2-filet-fort)] disabled:opacity-50 transition-opacity`}
            >
              {navigation ? <Spinner /> : 'Plus tard'}
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
              boxShadow: '0 0 0 9999px rgba(10,10,12,.78)',
            }}
          />
        ) : (
          <div aria-hidden className="wb-visite-fond absolute inset-0" style={{ background: 'rgba(10,10,12,.78)' }} />
        )}

        <div
          className="wb-visite-carte absolute left-3 right-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] shadow-[0_12px_32px_rgba(0,0,0,.35)] p-4"
          style={{ bottom: 'calc(14px + 66px + 10px + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
              Étape {etape + 1}/{etapes.length}
            </p>
            <button
              type="button"
              onClick={fermerPourLInstant}
              className={`-my-2 -mr-2 px-2 py-2 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
            >
              Passer
            </button>
          </div>
          <div className="mt-2 h-1 rounded-full overflow-hidden bg-[color:var(--v2-filet)]" aria-hidden>
            <div
              className="h-full rounded-full bg-[color:var(--v2-color-accent)] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${((etape + 1) / etapes.length) * 100}%` }}
            />
          </div>
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
