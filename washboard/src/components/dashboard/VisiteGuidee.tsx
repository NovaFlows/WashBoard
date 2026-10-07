'use client'

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { Spinner } from '@/components/ui/Spinner'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import {
  etapesPour, abonnerVisite, ecrireVisite, etapeSuivante, etatAuChargement,
  fermerPourLInstant, lireEtat, lireVisite, serialiserEtat, terminerVisite,
} from '@/lib/visiteGuidee'

// Carte de la visite guidée, montée par DashboardShell sur toutes les pages du
// tableau de bord (voir lib/visiteGuidee.ts pour la logique et la liste des arrêts).
//
// Deux présentations, pas une variante de couleurs de plus :
//  - Site : carte posée en bas de l'écran, contour pulsé sur l'élément visé
//    (comme avant). `data-visite-cible`/`data-visite-active`, voir globals.css.
//  - Application installée : fond assombri + découpe lumineuse autour de
//    l'élément (le même mécanisme que l'ancien TutoPwaV2, fusionné ici le
//    2026-10-07) — la barre du bas s'explique au fil de l'eau, entre deux
//    arrêts sur de vraies pages, plutôt qu'à part.

// Plusieurs éléments peuvent porter la même cible : le premier de la page
// l'emporte. Ex. PrestationsV2 : le « + » d'en-tête, et à défaut (aucune
// catégorie encore) « + Ajouter une catégorie ».
//
// Le rectangle est repris image par image (requestAnimationFrame) tant que
// l'étape reste affichée, pas seulement sur scroll/resize : des bandeaux
// (nouveautés, bêta) ou une donnée chargée plus haut sur la page poussent
// souvent la cible sans qu'aucun des deux ne se déclenche — repéré sur
// l'étape « lien », poussée de ~240px par les bandeaux une fois la carte
// déjà affichée, qui laissait la découpe figée sur une position obsolète.
//
// Même chose quand c'est la carte (en bas de l'écran, PWA) qui finit par
// recouvrir la cible après ce genre de poussée : un recentrage silencieux,
// borné dans le temps pour ne jamais fighter avec un défilement manuel une
// fois la page stabilisée.
function surligner(cible: string, surRect: (r: DOMRect | null) => void): () => void {
  let element: Element | null = null
  let minuteur: ReturnType<typeof setTimeout> | undefined
  let cadre: number | undefined
  let dernierRect: DOMRect | null = null
  let trouveA = 0
  let dernierRecentrage = 0

  const identiques = (a: DOMRect | null, b: DOMRect | null) =>
    a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height)

  const recouvreLaCarte = (r: DOMRect) => {
    const carte = document.querySelector('.wb-visite-carte')
    return !!carte && r.bottom > carte.getBoundingClientRect().top
  }

  const suivre = () => {
    const r = element ? element.getBoundingClientRect() : null
    if (!identiques(r, dernierRect)) { dernierRect = r; surRect(r) }
    const maintenant = performance.now()
    // 400 ms de battement : laisse le scroll initial (smooth) se terminer
    // avant de juger qu'il faut recentrer, et au plus un recentrage par
    // demi-seconde ensuite — une correction ponctuelle, pas un bras de fer.
    if (r && element && maintenant - trouveA > 400 && maintenant - dernierRecentrage > 500 && recouvreLaCarte(r)) {
      dernierRecentrage = maintenant
      element.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    cadre = requestAnimationFrame(suivre)
  }

  const trouver = () => {
    element = document.querySelector(`[data-visite-cible="${cible}"]`)
    if (!element) return false
    element.setAttribute('data-visite-active', '')
    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ block: 'center', behavior: sobre ? 'auto' : 'smooth' })
    trouveA = performance.now()
    cadre = requestAnimationFrame(suivre)
    return true
  }

  // L'élément arrive souvent après la carte : écran v2 qui attend de savoir s'il
  // est dans l'application, onglet d'AdminTabs choisi après montage, renvoi du
  // site vers son écran v1. Introuvable au bout de 5 s (offre sans cet écran,
  // catalogue plein…) : la carte seule suffit.
  const observateurArrivee = new MutationObserver(() => {
    if (trouver()) { observateurArrivee.disconnect(); clearTimeout(minuteur) }
  })
  if (!trouver()) {
    observateurArrivee.observe(document.body, { childList: true, subtree: true })
    minuteur = setTimeout(() => observateurArrivee.disconnect(), 5000)
  }

  return () => {
    observateurArrivee.disconnect()
    clearTimeout(minuteur)
    if (cadre !== undefined) cancelAnimationFrame(cadre)
    element?.removeAttribute('data-visite-active')
    surRect(null)
  }
}

const MARGE_DECOUPE = 8

export default function VisiteGuidee({ aFaire }: { aFaire?: boolean }) {
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
  const cible = etape === null ? undefined : etapes[etape].cible

  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!cible) { setRect(null); return }
    return surligner(cible, setRect)
  }, [cible, pathname])

  if (etape === null) return null

  const suivante = etapeSuivante(etape, etapes.length)
  const etapeActuelle = etapes[etape]

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
