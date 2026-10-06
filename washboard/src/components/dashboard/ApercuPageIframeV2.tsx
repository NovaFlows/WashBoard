'use client'

import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react'
import { corps } from '@/components/dashboard/FeuilleV2'

// `useSyncExternalStore` plutôt que « état + effet » (même raisonnement que
// `usePwaStandalone.ts`/`useGrandEcran.ts`) : le serveur n'a pas de `document`, et un
// `setState` dans un effet pour la première lecture déclenche un rendu de plus pour rien
// (et l'avertissement ESLint `react-hooks/set-state-in-effect`). Capacité du navigateur,
// donnée une fois pour toutes : pas d'abonnement réel.
const sAbonnerRien = () => () => {}
function pleinEcranDisponibleSnapshot(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true
}

// Celui-ci change réellement en cours de session (Échap, le bouton, le bascule de
// `basculerPleinEcran`) : un vrai abonnement à l'évènement `fullscreenchange`.
function sAbonnerFullscreen(callback: () => void) {
  document.addEventListener('fullscreenchange', callback)
  return () => document.removeEventListener('fullscreenchange', callback)
}

// Aperçu EN DIRECT de la page de réservation publique, en tête de l'écran « Apparence de
// ma page » (ApparenceV2.tsx — PWA et bureau). Jusqu'au 2026-10-07, cet emplacement
// montrait une approximation dessinée à la main de l'en-tête (`ApercuPageV2.tsx`) :
// Alexandre voyait une bande, pas sa page. Sa demande, dans ses mots : « je veux que l'on
// voie toute la page, pas qu'un extrait, avec un bouton rafraîchir... et un bouton pour
// mettre en plein écran ».
//
// Un <iframe> sur `/book/<slug>` plutôt qu'une deuxième approximation (qui aurait, comme
// la première, dérivé de la vraie page à la prochaine évolution) : même origine, et la
// page de réservation est volontairement INCLUABLE — `next.config.ts`, `ENTETES_DASHBOARD`
// (X-Frame-Options/CSP) ne vise QUE `/dashboard/:path*` ; le commentaire à côté dit
// explicitement « la page de réservation... reste incluable : un laveur peut vouloir
// l'intégrer à son propre site, et cette page ne contient aucune action sensible ».
// Aucune requête de plus côté tableau de bord : le slug est déjà en main (prop).
//
// RÉSERVÉ à cet écran, qui EST l'outil. `ApercuPageV2.tsx` (l'approximation) reste en
// place pour les vignettes purement décoratives qui montrent la même idée en passant :
// la colonne de droite de l'accueil bureau au premier jour (`AccueilV2.tsx` — une fonction
// LOCALE du même nom, sans rapport avec ce composant partagé, à ne pas confondre) et la
// colonne de droite de « Plus » en grand écran (`ParametresFormV2.tsx`). Un iframe qui
// charge Google Maps, les polices et les images de la vraie page n'a rien à faire dans un
// rappel qu'on croise en réglant sa zone ou ses prestations.
//
// Poids : chargement EAGER, sans garde « visible à l'écran » — ce cadre est la raison
// d'être de cet écran, le cacher jusqu'au défilement retarderait ce que le laveur est venu
// voir. `loading="lazy"` reste posé par précaution : si une évolution future pousse ce
// cadre plus bas dans la page, le navigateur différera son chargement réseau sans qu'on
// ait à y repenser.
//
// Plein écran sur le CONTENEUR (barre d'outils + cadre), pas sur l'iframe seule : pour que
// « Rafraîchir » reste joignable une fois en plein écran, et surtout parce qu'Échap
// n'existe pas au doigt sur téléphone — le bouton devient « Quitter le plein écran »
// plutôt que de compter sur une touche absente.
export default function ApercuPageIframeV2({ slug }: { slug: string }) {
  const [cle, setCle] = useState(0)
  const [charge, setCharge] = useState(false)
  const conteneurRef = useRef<HTMLDivElement>(null)

  const pleinEcranDisponible = useSyncExternalStore(sAbonnerRien, pleinEcranDisponibleSnapshot, () => false)
  const estPleinEcran = useCallback(
    () => typeof document !== 'undefined' && document.fullscreenElement === conteneurRef.current,
    [],
  )
  const pleinEcran = useSyncExternalStore(sAbonnerFullscreen, estPleinEcran, () => false)

  const rafraichir = useCallback(() => {
    // Remonter l'iframe (plutôt que `contentWindow.location.reload()`) la ramène sur
    // `/book/<slug>` même si un clic à l'intérieur l'avait fait naviguer ailleurs — le
    // cas du lien « Retour à l'accueil » de la page 404 (voir plus bas, cadre sur un
    // slug qui n'existe pas encore, comme `/demo`).
    setCharge(false)
    setCle(c => c + 1)
  }, [])

  const basculerPleinEcran = useCallback(() => {
    const el = conteneurRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {})
    }
  }, [])

  return (
    <div
      ref={conteneurRef}
      className={
        pleinEcran
          ? 'flex h-full w-full flex-col overflow-hidden bg-[color:var(--v2-color-surface)]'
          : 'overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)]'
      }
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--v2-filet)] px-3 py-2">
        <span className={`truncate text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
          Ce que voient vos clients, en direct
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={rafraichir}
            aria-label="Rafraîchir l’aperçu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--v2-color-encre)] transition-colors hover:bg-[color:var(--v2-filet)]"
          >
            <RefreshCw size={16} strokeWidth={1.75} />
          </button>
          {pleinEcranDisponible && (
            <button
              type="button"
              onClick={basculerPleinEcran}
              aria-label={pleinEcran ? 'Quitter le plein écran' : 'Voir en plein écran'}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--v2-color-encre)] transition-colors hover:bg-[color:var(--v2-filet)]"
            >
              {pleinEcran ? <Minimize2 size={16} strokeWidth={1.75} /> : <Maximize2 size={16} strokeWidth={1.75} />}
            </button>
          )}
        </div>
      </div>

      <div
        className={`relative bg-[color:var(--v2-color-fond)] ${pleinEcran ? 'flex-1' : ''}`}
        style={pleinEcran ? undefined : { height: 520 }}
      >
        {!charge && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="h-6 w-6 rounded-full border-2 border-[color:var(--v2-filet-fort)] border-t-[color:var(--v2-color-encre)] motion-safe:animate-spin" />
          </div>
        )}
        <iframe
          key={cle}
          src={`/book/${slug}`}
          title="Aperçu de votre page de réservation"
          loading="lazy"
          onLoad={() => setCharge(true)}
          className="h-full w-full border-0"
          style={{ opacity: charge ? 1 : 0, transition: 'opacity 200ms var(--v2-ease-out)' }}
        />
      </div>
    </div>
  )
}
