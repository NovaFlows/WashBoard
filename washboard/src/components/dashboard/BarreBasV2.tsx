'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// Barre du bas de la refonte 2026 (passe 4) — n'apparaît QUE dans la PWA
// installée, quand `washer.beta_refonte` est vrai (voir DashboardShell.tsx,
// qui décide des deux conditions et rend ce composant). Depuis le 2026-09-24
// elle REMPLACE le menu latéral et l'en-tête (☰, titre, badge de plan,
// déconnexion, thème) dans ce mode : les passes 5 et 6 (Chiffres, Plus) ont
// livré, et « Plus » porte désormais tout ce que le menu donnait — voir
// ParametresFormV2.tsx. Avant ce retrait (passes 4 à 7), le ☰ restait le
// filet de secours, à cause du bug des six pages orphelines de la première
// version du CRM.
//
// Les 5 destinations de la maquette (`project/Main.dc.html`, nav du bas) —
// Aujourd'hui · Agenda · Clients · Chiffres · Plus — n'ont pas toutes une
// route dédiée à ce stade de la refonte (passe 6 « Plus / réglages » pas
// encore faite). Mapping :
//   Aujourd'hui → /dashboard        (déjà la page d'accueil)
//   Agenda      → /dashboard/calendrier
//   Clients     → /dashboard/clients (déjà en v2 depuis la passe 2)
//   Chiffres    → /dashboard/chiffres (passe 5 : fusion CRM + Comptabilité,
//                 3 onglets Argent/Acquisition/Clients — voir Chiffres.tsx.
//                 /dashboard/crm et /dashboard/compta restent inchangés et
//                 joignables par le menu latéral)
//   Plus        → /dashboard/parametres (interimaire, deviendra "Plus" à la
//                 passe 6 — arbitrage à signaler si une autre priorité se
//                 dessine avant)
const DESTINATIONS = [
  {
    href: '/dashboard',
    label: 'Aujourd’hui',
    actif: (p: string) => p === '/dashboard',
    icone: (actif: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={actif ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/calendrier',
    label: 'Agenda',
    actif: (p: string) => p.startsWith('/dashboard/calendrier'),
    icone: (actif: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={actif ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
      </svg>
    ),
  },
  {
    href: '/dashboard/clients',
    label: 'Clients',
    actif: (p: string) => p.startsWith('/dashboard/clients'),
    icone: (actif: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={actif ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h3a4.5 4.5 0 0 1 4.5 4.5V20" />
        <circle cx="9.5" cy="8" r="3.5" />
        <path d="M17 14.2a4.5 4.5 0 0 1 3.5 4.3V20" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      </svg>
    ),
  },
  {
    href: '/dashboard/chiffres',
    label: 'Chiffres',
    actif: (p: string) => p.startsWith('/dashboard/chiffres'),
    icone: (actif: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={actif ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20h16" />
        <path d="M7 20v-6M12 20V6M17 20v-9" />
      </svg>
    ),
  },
  {
    href: '/dashboard/parametres',
    label: 'Plus',
    actif: (p: string) => p.startsWith('/dashboard/parametres'),
    icone: (actif: boolean) => (
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={actif ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="12" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="19" cy="12" r="1.4" />
      </svg>
    ),
  },
] as const

const police = '[font-family:var(--font-archivo)]'

/** Fin trait noir qui se dessine tout autour de la barre pendant qu'une page se charge
 *  (demande d'Alexandre, 2026-09-26 : « le tour en entier, comme un ovale, fluide, qu'on le
 *  voit avancer super vite si c'est rapide »). Il PROGRESSE au lieu de tourner en boucle :
 *  il part vite, ralentit sans jamais atteindre la fin tant que la page n'est pas là, puis
 *  boucle le tour à son arrivée et s'efface. Le tour va TOUJOURS jusqu'au bout, même si la
 *  page s'ouvre presque tout de suite (demande d'Alexandre, 2026-09-26) : la fin dure de quoi
 *  porter le tour entier à `DUREE_MINI_TOUR_MS` depuis le toucher.
 *
 *  Un SVG à la taille exacte de la barre, mesurée : le contour est une pilule (rayon = moitié
 *  de la hauteur), donc un rectangle arrondi dont `pathLength` vaut 100 ; `stroke-dashoffset`
 *  va de 100 (rien) à 0 (le tour complet). */
type PhaseContour = 'repos' | 'depart' | 'avance' | 'fin'
const DUREE_MINI_TOUR_MS = 750
const DUREE_FIN_MINI_MS = 300
const REGLAGES_CONTOUR: Record<Exclude<PhaseContour, 'fin' | 'depart'>, { decalage: number; duree: number; courbe: string; opacite: number }> = {
  repos: { decalage: 0, duree: 0, courbe: 'linear', opacite: 0 },
  // 5 s vers 92 % : progression régulière, qui ralentit franchement vers la fin.
  avance: { decalage: 8, duree: 5000, courbe: 'cubic-bezier(.25, .4, .35, 1)', opacite: 1 },
}

// Chaque page rend SA PROPRE barre (DashboardShell est dans chaque page, pas dans une mise en
// page commune) : à l'arrivée de la page, la barre qui dessinait le contour disparaît avec
// l'ancienne page, et une neuve apparaît. Le chargement en cours est donc tenu ICI, hors de
// React, pour que la nouvelle barre reprenne le trait là où l'ancienne l'a laissé et le mène
// jusqu'au bout du tour.
let chargement: { debut: number; progres: number } | null = null
const PEREMPTION_MS = 20_000

function ContourChargement({ actif }: { actif: boolean }) {
  const ref = useRef<SVGSVGElement>(null)
  const trait = useRef<SVGRectElement>(null)
  const [taille, setTaille] = useState<{ l: number; h: number } | null>(null)
  const [phase, setPhase] = useState<PhaseContour>('repos')
  const phaseRef = useRef<PhaseContour>('repos')
  useEffect(() => { phaseRef.current = phase }, [phase])
  const [decalageDepart, setDecalageDepart] = useState(100)
  const [dureeFin, setDureeFin] = useState(DUREE_FIN_MINI_MS)

  useEffect(() => {
    const parent = ref.current?.parentElement
    if (!parent) return
    const mesurer = () => setTaille({ l: parent.offsetWidth, h: parent.offsetHeight })
    mesurer()
    const o = new ResizeObserver(mesurer)
    o.observe(parent)
    return () => o.disconnect()
  }, [])

  // Termine le tour : départ posé (peint), puis fin en `fin` ms — jamais moins que ce qu'il
  // faut pour que le tour entier ait duré `DUREE_MINI_TOUR_MS` depuis le toucher.
  function terminer(depuis: number) {
    const fin = Math.max(DUREE_FIN_MINI_MS, DUREE_MINI_TOUR_MS - (Date.now() - depuis))
    let a = 0
    const b = requestAnimationFrame(() => {
      a = requestAnimationFrame(() => { setDureeFin(fin); setPhase(p => (p === 'repos' ? p : 'fin')) })
    })
    const t = setTimeout(() => { setPhase('repos'); chargement = null }, fin + 140)
    return () => { cancelAnimationFrame(b); cancelAnimationFrame(a); clearTimeout(t) }
  }

  // Une page vient d'arriver pendant qu'un chargement était en cours (barre neuve) : le trait
  // reprend à sa position et termine son tour.
  useEffect(() => {
    if (!chargement || Date.now() - chargement.debut > PEREMPTION_MS) { chargement = null; return }
    setDecalageDepart(100 - chargement.progres)
    setPhase('depart')
    return terminer(chargement.debut)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'arrivée
  }, [])

  // Cette barre est remplacée (nouvelle page) en plein chargement : on retient où en est le trait.
  // Effet de mise en page, pas un effet ordinaire : son nettoyage tourne AVANT que le tracé ne
  // quitte la page, seul moment où sa position se lit encore.
  useLayoutEffect(() => () => {
    if (!chargement || (phaseRef.current !== 'avance' && phaseRef.current !== 'depart')) return
    const r = trait.current
    if (r) chargement.progres = Math.max(0, Math.min(100, 100 - parseFloat(getComputedStyle(r).strokeDashoffset)))
  }, [])

  useEffect(() => {
    if (actif) {
      chargement = { debut: Date.now(), progres: 0 }
      setDecalageDepart(100)
      setPhase('depart')
      // Deux images d'écart : le départ (trait à zéro) doit être peint avant que la
      // transition vers « avance » ne s'enclenche.
      let a = 0
      const b = requestAnimationFrame(() => { a = requestAnimationFrame(() => setPhase('avance')) })
      return () => { cancelAnimationFrame(b); cancelAnimationFrame(a) }
    }
    // Fin de chargement SANS changement de barre (la page est la même) : même fin de tour.
    if (chargement && phaseRef.current !== 'repos') return terminer(chargement.debut)
  }, [actif])

  const r = phase === 'fin'
    ? { decalage: 0, duree: dureeFin, courbe: 'cubic-bezier(.3, .6, .4, 1)', opacite: 1 }
    : phase === 'depart'
      ? { decalage: decalageDepart, duree: 0, courbe: 'linear', opacite: 1 }
      : REGLAGES_CONTOUR[phase]
  const decalage = 0.75
  return (
    <svg
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-20 overflow-visible"
      width={taille?.l ?? 0}
      height={taille?.h ?? 0}
      style={{ margin: -1, opacity: r.opacite, transition: phase === 'repos' ? 'opacity 200ms linear' : 'none' }}
    >
      {taille && (
        <rect
          ref={trait}
          className="wb-contour-trait"
          x={decalage} y={decalage} width={taille.l - 2 * decalage} height={taille.h - 2 * decalage}
          rx={(taille.h - 2 * decalage) / 2} fill="none" stroke="var(--v2-color-encre)" strokeWidth={1.5}
          strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={r.decalage}
          style={{ transition: r.duree ? `stroke-dashoffset ${r.duree}ms ${r.courbe}` : 'none' }}
        />
      )}
    </svg>
  )
}

export function BarreBasV2() {
  const pathname = usePathname()
  const router = useRouter()

  // « Chauffe » des cinq onglets, une fois par session, pendant que l'écran de lancement est
  // encore là (demande d'Alexandre, 2026-09-26 : le logo laisse aux pages le temps de charger,
  // pour que changer d'onglet soit plus rapide ensuite). Les pages sont rendues par le serveur :
  // les demander une fois réveille leurs fonctions (départ à froid) et prépare leur code côté
  // navigateur. Rien n'est GARDÉ : chaque navigation relit des données fraîches, un planning
  // périmé serait pire qu'un onglet un peu plus lent.
  useEffect(() => {
    let dejaFait = false
    try {
      dejaFait = window.sessionStorage.getItem('wb-chauffe') === '1'
      window.sessionStorage.setItem('wb-chauffe', '1')
    } catch { /* stockage refusé : on chauffe, sans mémoire */ }
    if (dejaFait) return
    let vivant = true
    const cibles = DESTINATIONS.map(d => d.href).filter(h => h !== pathname)
    const timer = setTimeout(async () => {
      for (const href of cibles) {
        if (!vivant) return
        try { router.prefetch(href) } catch { /* rien */ }
        try { await fetch(href, { headers: { RSC: '1' }, credentials: 'same-origin', cache: 'no-store' }) } catch { /* hors ligne : tant pis */ }
      }
    }, 400)
    return () => { vivant = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, au démarrage
  }, [])

  // Retour immédiat au toucher : les pages du tableau de bord sont rendues par
  // le serveur, il s'écoule un moment entre le tap et l'arrivée de la page.
  // Sans ceci, la barre restait sur l'ancien onglet et rien ne bougeait —
  // exactement ce qui fait paraître une PWA lente. On garde la page de départ
  // avec la destination : l'attente s'éteint d'elle-même dès que l'adresse
  // change, sans effet ni état à resynchroniser.
  const [attente, setAttente] = useState<{ href: string; depuis: string } | null>(null)
  const enAttente = attente && attente.depuis === pathname ? attente.href : null

  // Filet de sécurité : si la navigation n'aboutit jamais (réseau coupé), la
  // pastille revient sur l'onglet de la page réellement affichée.
  useEffect(() => {
    if (!enAttente) return
    const t = setTimeout(() => setAttente(null), 15_000)
    return () => clearTimeout(t)
  }, [enAttente])

  const indexActif = DESTINATIONS.findIndex(dest =>
    enAttente ? dest.href === enAttente : dest.actif(pathname ?? ''),
  )

  return (
    <nav
      aria-label="Navigation"
      // Position fixe, pas absolue : DashboardShell n'est pas un cadre de
      // taille fixe comme dans la maquette (390×844), c'est le châssis réel
      // du dashboard. `z-[15]` : sous l'overlay et le tiroir du menu latéral
      // (z-20/z-30, Sidebar.tsx) pour que le menu, en s'ouvrant, la recouvre
      // et l'assombrisse comme le reste — au-dessus du contenu de page (sans
      // z-index) et de l'en-tête sticky (z-10, mais aucun chevauchement
      // spatial réel entre les deux, l'un en haut, l'autre en bas).
      className={`fixed left-3 right-3 z-[15] grid grid-cols-5 gap-[2px] rounded-[33px] p-[5px] wb-barre-bas-verre ${police}`}
      style={{ bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', height: 66 }}
    >
      {/* Pastille de l'onglet actif : elle glisse d'un onglet à l'autre au lieu
          de sauter (demande d'Alexandre, 2026-09-23, « comme sur Insta »). Elle
          remplace le fond que portait chaque onglet actif. Largeur d'une
          colonne = (largeur − 2×5 px de marge − 4×2 px d'écart) / 5 ; le
          décalage d'un cran = une colonne + un écart. Sans onglet actif (page
          hors des cinq destinations), elle disparaît. */}
      <span
        aria-hidden
        className="absolute top-[5px] bottom-[5px] left-[5px] rounded-[28px] bg-[color:var(--v2-color-surface)] shadow-[0_2px_6px_rgba(22,22,26,.14)] transition-[transform,opacity] duration-[260ms] motion-reduce:transition-none"
        style={{
          width: 'calc((100% - 18px) / 5)',
          transform: `translateX(calc(${Math.max(indexActif, 0)} * (100% + 2px)))`,
          opacity: indexActif >= 0 ? 1 : 0,
          transitionTimingFunction: 'var(--v2-ease-out)',
        }}
      />
      <ContourChargement actif={!!enAttente} />
      {DESTINATIONS.map(dest => {
        // Pendant une navigation, l'onglet visé s'allume tout de suite.
        const actif = enAttente ? dest.href === enAttente : dest.actif(pathname ?? '')
        return (
          <Link
            key={dest.href}
            href={dest.href}
            aria-current={actif ? 'page' : undefined}
            onClick={() => { if (!dest.actif(pathname ?? '')) setAttente({ href: dest.href, depuis: pathname ?? '' }) }}
            // Le fond de l'onglet actif est porté par la pastille qui glisse
            // (voir plus haut) ; l'onglet ne change que de couleur et de graisse.
            className={`relative z-10 flex flex-col items-center justify-center gap-1 rounded-[28px] text-[10.5px] select-none ${
              actif
                ? 'text-[color:var(--v2-color-encre)] font-semibold'
                : 'text-[color:var(--v2-color-gris)] font-normal'
            }`}
          >
            {dest.icone(actif)}
            {dest.label}
          </Link>
        )
      })}
    </nav>
  )
}
