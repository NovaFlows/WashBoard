'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
//
// Correction du 2026-10-07 (Alexandre : « je ne veux pas qu'on puisse slider, je veux voir
// vraiment toute la page... et surtout je ne peux plus rien changer ou modifier »). Deux
// défauts corrigés ensemble, parce que la cause est la même :
//
// 1. PAGE ENTIÈRE, SANS DÉFILEMENT INTERNE — hors plein écran, le cadre n'a plus de
//    hauteur fixe à 520px (qui coupait la page et laissait le navigateur interne défiler).
//    La largeur du cadre reste celle de sa colonne (l'iframe garde `width: 100%`) ; on lit
//    la hauteur RÉELLE du document une fois chargé (`contentDocument.documentElement.
//    scrollHeight` — même origine, voir plus haut) et on la pose sur un conteneur
//    intermédiaire qu'on réduit avec `transform: scale()`. Comme ce conteneur fait déjà
//    100 % de la largeur du cadre AVANT réduction, l'échelle n'a plus qu'à absorber le
//    débord vertical : page plus haute que `HAUTEUR_MAX_CADRE` → elle rétrécit en entier
//    (largeur et hauteur ensemble, proportions gardées, comme une vignette) ; page plus
//    courte → aucune réduction, pas de bande vide forcée. `transformOrigin: 'top center'`
//    recentre le rétrécissement horizontalement sans qu'un `justify-content` ait quoi que
//    ce soit à faire (la boîte, avant réduction, fait déjà 100 % de large). On refait cette
//    mesure à chaque fois que LA PAGE MONTRÉE change de taille (`demarrerObservationInterne`,
//    plus bas — un `ResizeObserver` posé DANS l'iframe, pas sur son cadre) : la page publique
//    est responsive, sa hauteur à une largeur donnée change avec cette largeur — important
//    pour le passage bureau/téléphone (390px, où le cadre garde sa largeur de colonne,
//    proche de celle d'un téléphone : rien à corriger côté largeur, voir plus haut).
//
// 2. CADRE INERTE — c'est ce qui débloquait les réglages du dessous. L'iframe n'est qu'une
//    IMAGE de ce que voient les clients, jamais un endroit où agir : `pointer-events: none`
//    l'empêche de capter le moindre geste (c'est lui qui réglait le vol de molette — la
//    molette, n'ayant plus de cible à l'intérieur, fait défiler le tableau de bord comme
//    n'importe où ailleurs sur l'écran) et `inert` (attribut HTML standard, propagé par le
//    navigateur À L'INTÉRIEUR de l'iframe — React 19 le pose/retire comme `disabled`) la
//    retire en plus du clavier et de l'arborescence d'accessibilité : un lecteur d'écran ne
//    tombe jamais sur le bouton « Réserver » de l'aperçu par erreur. En PLEIN ÉCRAN, à
//    l'inverse, l'aperçu redevient un endroit légitime où agir (vérifier un vrai parcours
//    de réservation) : ni l'échelle ni l'inertie ne s'y appliquent, l'iframe y est pleine
//    résolution et interactive, comme avant ce correctif.
const HAUTEUR_MAX_CADRE = 520

export default function ApercuPageIframeV2({ slug }: { slug: string }) {
  const [cle, setCle] = useState(0)
  const [charge, setCharge] = useState(false)
  const [hauteurNaturelle, setHauteurNaturelle] = useState<number | null>(null)
  const conteneurRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const scenaRef = useRef<HTMLDivElement>(null)
  // L'observateur interne vit le temps d'UN chargement de `doc.documentElement` (voir
  // `demarrerObservationInterne`) : une ref, pas un state, il n'a jamais à provoquer de rendu.
  const observateurInterneRef = useRef<ResizeObserver | null>(null)

  const pleinEcranDisponible = useSyncExternalStore(sAbonnerRien, pleinEcranDisponibleSnapshot, () => false)
  const estPleinEcran = useCallback(
    () => typeof document !== 'undefined' && document.fullscreenElement === conteneurRef.current,
    [],
  )
  const pleinEcran = useSyncExternalStore(sAbonnerFullscreen, estPleinEcran, () => false)

  // Relit la hauteur réelle du document du cadre. `scrollHeight` peut valoir 0 sur un
  // document pas encore navigué (`about:blank`) : un `0` reste sans effet plus bas
  // (`hauteurNaturelle ? … : …`, `0` est faux) plutôt que de produire une échelle infinie
  // (`520 / 0`).
  //
  // Premier piège trouvé en vérifiant : la page publique pose `min-height: 100vh` (succès ET
  // 404, `(public)/book/[slug]/page.tsx`), et ce `vh` se calcule par rapport au viewport DE
  // L'IFRAME — celui-là même qu'on dimensionne nous-mêmes via la hauteur posée sur « scène ».
  // En lisant `scrollHeight` sans y toucher, on ne mesure jamais la page : on confirme la
  // hauteur qu'on venait de lui donner (`max(notre hauteur, vrai contenu)`, et notre hauteur
  // gagne dès que le vrai contenu est plus court). D'où le creux-puis-lit : on réduit la
  // scène à 1px juste avant de lire (le `min-height: 100vh` d'un viewport de 1px ne pèse
  // rien face au contenu réel, qui l'emporte), puis on restaure aussitôt — avant le prochain
  // rendu, donc sans flash visible.
  const mesurer = useCallback(() => {
    const scena = scenaRef.current
    const doc = iframeRef.current?.contentDocument
    if (!scena || !doc?.documentElement) return
    const hauteurPosee = scena.style.height
    scena.style.height = '1px'
    const hauteur = doc.documentElement.scrollHeight
    scena.style.height = hauteurPosee
    setHauteurNaturelle(hauteur)
  }, [])

  // Second piège, plus sournois : `onLoad` de l'iframe se déclenche dès que SON document
  // atteint `readyState: complete` — ce qui, pour une page Next.js, arrive AVANT que
  // l'hydratation React n'ait peuplé le corps. Mesurer pile à cet instant lit un
  // `<body>` encore vide (observé en vérifiant : `scrollHeight` collé à 8px, la même valeur
  // qu'un `about:blank`, alors que l'URL chargée était déjà la bonne). Observer la COLONNE
  // qui contient le cadre (son redimensionnement à elle) ne change rien à ce problème : rien,
  // à l'extérieur, ne bouge quand l'intérieur s'hydrate.
  //
  // D'où un second `ResizeObserver`, attaché cette fois DANS l'iframe, sur
  // `doc.documentElement` lui-même — même origine, donc permis. Il se redéclenche à chaque
  // fois que LA PAGE QU'IL MONTRE change de taille, pour n'importe quelle raison : la colonne
  // qui se redimensionne (elle change la largeur de l'iframe, donc sa mise en page interne),
  // mais tout autant l'hydratation qui peuple un HTML initial presque vide, une police qui
  // finit de charger, une image qui arrive. Posé au chargement (`onLoad`), pas à chaque
  // rendu : il observe le DOCUMENT du cadre, qui ne change qu'à une vraie navigation.
  const demarrerObservationInterne = useCallback(() => {
    observateurInterneRef.current?.disconnect()
    const doc = iframeRef.current?.contentDocument
    if (!doc?.documentElement) return
    const ro = new ResizeObserver(() => mesurer())
    ro.observe(doc.documentElement)
    observateurInterneRef.current = ro
    mesurer()
  }, [mesurer])

  // Coupe l'observateur en plein écran (l'iframe y est en pleine résolution, sans échelle à
  // recalculer — et le creux-puis-lit de `mesurer`, sur une scène sans hauteur imposée,
  // y ferait un vrai clignotement visible, contrairement à hors plein écran où il est
  // invisible), et au démontage.
  useEffect(() => {
    if (pleinEcran) observateurInterneRef.current?.disconnect()
  }, [pleinEcran])
  useEffect(() => () => observateurInterneRef.current?.disconnect(), [])

  const rafraichir = useCallback(() => {
    // Remonter l'iframe (plutôt que `contentWindow.location.reload()`) la ramène sur
    // `/book/<slug>` même si un clic à l'intérieur l'avait fait naviguer ailleurs — le
    // cas du lien « Retour à l'accueil » de la page 404 (voir plus bas, cadre sur un
    // slug qui n'existe pas encore, comme `/demo`).
    observateurInterneRef.current?.disconnect()
    setCharge(false)
    setHauteurNaturelle(null)
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

  const escala = hauteurNaturelle ? Math.min(1, HAUTEUR_MAX_CADRE / hauteurNaturelle) : 1
  const hauteurAffichee = hauteurNaturelle ? Math.min(hauteurNaturelle, HAUTEUR_MAX_CADRE) : HAUTEUR_MAX_CADRE

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
        className={`relative overflow-hidden bg-[color:var(--v2-color-fond)] ${pleinEcran ? 'flex-1' : ''}`}
        style={pleinEcran ? undefined : { height: hauteurAffichee }}
      >
        {!charge && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="h-6 w-6 rounded-full border-2 border-[color:var(--v2-filet-fort)] border-t-[color:var(--v2-color-encre)] motion-safe:animate-spin" />
          </div>
        )}
        <div
          ref={scenaRef}
          className={pleinEcran ? 'h-full w-full' : undefined}
          style={
            pleinEcran
              ? undefined
              : {
                  width: '100%',
                  height: hauteurNaturelle ?? HAUTEUR_MAX_CADRE,
                  transform: `scale(${escala})`,
                  transformOrigin: 'top center',
                }
          }
        >
          <iframe
            key={cle}
            ref={iframeRef}
            src={`/book/${slug}`}
            title="Aperçu de votre page de réservation"
            loading="lazy"
            onLoad={() => { setCharge(true); if (!pleinEcran) demarrerObservationInterne() }}
            className="h-full w-full border-0"
            // Décoratif hors plein écran : une image de la page, pas un endroit où agir
            // (voir le commentaire au-dessus de `HAUTEUR_MAX_CADRE`).
            tabIndex={pleinEcran ? undefined : -1}
            aria-hidden={pleinEcran ? undefined : true}
            inert={!pleinEcran}
            style={{
              opacity: charge ? 1 : 0,
              transition: 'opacity 200ms var(--v2-ease-out)',
              pointerEvents: pleinEcran ? 'auto' : 'none',
            }}
          />
        </div>
      </div>
    </div>
  )
}
