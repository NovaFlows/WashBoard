'use client'

import { useEffect, useSyncExternalStore, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { Spinner } from '@/components/ui/Spinner'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import {
  ETAPES_VISITE, abonnerVisite, ecrireVisite, etapeSuivante, etatAuChargement,
  lireEtat, lireVisite, serialiserEtat, terminerVisite,
} from '@/lib/visiteGuidee'

// Carte de la visite guidée, montée par DashboardShell sur toutes les pages du
// tableau de bord (voir lib/visiteGuidee.ts pour la logique).
//
// Placement : en bas, au-dessus de la bulle WhatsApp sur téléphone (site) ou de
// la barre du bas (application installée), à gauche sur grand écran — jamais
// sur le coin de la bulle. z-[15] : sous le menu latéral (z-20/30) et les
// fenêtres (z-50), qui restent prioritaires quand le laveur les ouvre.

// Plusieurs éléments peuvent porter la même cible : le premier de la page
// l'emporte. Ex. PrestationsV2 : le « + » d'en-tête, et à défaut (aucune
// catégorie encore) « + Ajouter une catégorie ».
function surligner(cible: string): () => void {
  let element: Element | null = null
  let minuteur: ReturnType<typeof setTimeout> | undefined

  const trouver = () => {
    element = document.querySelector(`[data-visite-cible="${cible}"]`)
    if (!element) return false
    element.setAttribute('data-visite-active', '')
    const sobre = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ block: 'center', behavior: sobre ? 'auto' : 'smooth' })
    return true
  }

  // L'élément arrive souvent après la carte : écran v2 qui attend de savoir s'il
  // est dans l'application, onglet d'AdminTabs choisi après montage, renvoi du
  // site vers son écran v1. Introuvable au bout de 5 s (offre sans cet écran,
  // catalogue plein…) : la carte seule suffit.
  const observateur = new MutationObserver(() => {
    if (trouver()) { observateur.disconnect(); clearTimeout(minuteur) }
  })
  if (!trouver()) {
    observateur.observe(document.body, { childList: true, subtree: true })
    minuteur = setTimeout(() => observateur.disconnect(), 5000)
  }

  return () => {
    observateur.disconnect()
    clearTimeout(minuteur)
    element?.removeAttribute('data-visite-active')
  }
}

export default function VisiteGuidee({ aFaire }: { aFaire?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const isPwa = usePwaStandalone()
  const [navigation, naviguer] = useTransition()
  const etat = lireEtat(useSyncExternalStore(abonnerVisite, lireVisite, () => null))

  useEffect(() => {
    const stocke = lireEtat(lireVisite())
    const suivant = etatAuChargement(stocke, aFaire)
    if (serialiserEtat(suivant) !== serialiserEtat(stocke)) ecrireVisite(suivant)
  }, [aFaire])

  const etape = etat.statut === 'en_cours' ? etat.etape : null
  const cible = etape === null ? undefined : ETAPES_VISITE[etape].cible

  useEffect(() => {
    if (cible) return surligner(cible)
  }, [cible, pathname])

  if (etape === null) return null

  const suivante = etapeSuivante(etape)

  function avancer() {
    if (suivante === null) { terminerVisite(); return }
    // Écrit tout de suite, jamais après coup : `DashboardShell` est rendu par
    // chaque page séparément (pas un layout partagé), donc cette instance ne
    // survit pas à la navigation — un état « en attente » gardé dans le
    // composant se perdrait avec lui, et la carte resterait bloquée sur
    // l'arrêt de départ. Le flottement visuel pendant le chargement se traite
    // à l'affichage (bouton en chargement ci-dessous), pas en retardant l'écriture.
    ecrireVisite({ statut: 'en_cours', etape: suivante })
    naviguer(() => router.push(ETAPES_VISITE[suivante].route))
  }

  const s = isPwa
    ? {
        carte: `rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] shadow-[0_12px_32px_rgba(0,0,0,.16)]`,
        etape: `text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`,
        texte: `text-[15px] leading-snug ${corps}`,
        passer: `text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`,
        suivant: `rounded-[var(--v2-radius-bouton)] text-[15px] ${corpsFort} text-white bg-[color:var(--v2-color-accent)]`,
        piste: 'bg-[color:var(--v2-filet)]',
        jauge: 'bg-[color:var(--v2-color-accent)]',
      }
    : {
        carte: 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg shadow-slate-900/10',
        etape: 'text-xs font-black uppercase tracking-[0.18em] text-[#1651E8] dark:text-[#00C4D4]',
        texte: 'text-sm leading-snug',
        passer: 'text-xs font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300',
        suivant: 'rounded-xl text-sm font-semibold text-white bg-[#1651E8] hover:bg-[#0F4ACC] shadow-lg shadow-[#1651E8]/20',
        piste: 'bg-slate-100 dark:bg-slate-800',
        jauge: 'bg-[#1651E8] dark:bg-[#00C4D4]',
      }

  return (
    <>
      {/* Réserve sous le contenu : sans elle, la carte couvrirait le bas de la
          page sans qu'on puisse le faire défiler au-dessus. */}
      <div aria-hidden className="h-44" />
      <section
        aria-label="Visite guidée"
        className={`fixed z-[15] left-3 right-20 sm:right-auto sm:w-[23rem] p-4 ${
          isPwa ? '' : 'sm:left-6 bottom-[calc(4rem_+_env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))]'
        } ${s.carte}`}
        style={isPwa ? { bottom: 'calc(14px + 66px + 10px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={s.etape}>Étape {etape + 1}/{ETAPES_VISITE.length}</p>
          <button type="button" onClick={terminerVisite} className={`-my-2 -mr-2 px-2 py-2 transition-colors ${s.passer}`}>
            Passer
          </button>
        </div>
        <div className={`mt-2 h-1 rounded-full overflow-hidden ${s.piste}`} aria-hidden>
          <div
            className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${s.jauge}`}
            style={{ width: `${((etape + 1) / ETAPES_VISITE.length) * 100}%` }}
          />
        </div>
        <p aria-live="polite" className={`mt-3 ${s.texte}`}>{ETAPES_VISITE[etape].texte}</p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={avancer}
            disabled={navigation}
            className={`h-10 px-5 transition-colors disabled:opacity-50 ${s.suivant}`}
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
