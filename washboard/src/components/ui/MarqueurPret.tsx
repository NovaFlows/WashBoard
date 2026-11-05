'use client'

import { useEffect } from 'react'

// Écran de lancement de la PWA installée (voir globals.css, « Écran de lancement ») : tant
// que l'application n'a pas fini de se charger, un écran beige avec le logo la recouvre —
// au lieu du noir d'iOS, ou de la page v1 entrevue avant que la v2 ne prenne la place.
//
// Au LANCEMENT de l'application (première page de la session, connexion ou pas), il reste au
// moins 3 secondes (demande d'Alexandre, 2026-09-26) : c'est beau, et ça laisse aux pages le
// temps de se charger — voir « chauffe » dans BarreBasV2. Les pages suivantes de la session
// (rechargement, retour de connexion Google…) ne le rallongent pas : il part dès que
// l'application est démarrée. Il s'efface en fondu, en révélant la page dessous.
//
// Au lancement, sur téléphone, la sortie est un « atterrissage » (Ryan, 2026-11-05) : le logo
// tombe et se pose à la place du « + » de la barre du bas, la barre monte, puis les blocs
// visibles de la page arrivent un par un. Elle démarre un peu avant la fin des 3 secondes,
// pour que l'ouverture ne dure pas plus longtemps. Sans « + » à l'écran (ordinateur, page
// sans barre) ou avec « réduire les animations », c'est le fondu.
//
// Sans JavaScript (ou s'il ne se charge jamais), l'écran s'efface de lui-même au bout de
// 10 secondes : voir la règle de secours du CSS.
const DUREE_LANCEMENT_MS = 3000
const DUREE_FONDU_MS = 260
const AVANCE_ATTERRISSAGE_MS = 600
// Fin de la cascade : 520 ms de départ + 4 × 90 ms de décalage + 520 ms d'animation.
const DUREE_ATTERRISSAGE_MS = 1450
const BLOCS_MAX = 5
const TAILLE_LOGO_PX = 88

/** Blocs visibles de la page, dans l'ordre : bandeaux, puis contenu de `<main>`. */
function blocsVisibles(): HTMLElement[] {
  const main = document.getElementById('main-content')
  if (!main) return []
  let racine: Element = main
  while (racine.children.length === 1) racine = racine.children[0]
  const avant = [...(main.parentElement?.children ?? [])].filter(
    el => el !== main && !!(el.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING),
  )
  return [...avant, ...racine.children]
    .filter((el): el is HTMLElement => {
      if (!(el instanceof HTMLElement) || getComputedStyle(el).position === 'fixed') return false
      const r = el.getBoundingClientRect()
      return r.height > 0 && r.top < window.innerHeight
    })
    .slice(0, BLOCS_MAX)
}

/** Prépare l'atterrissage ; renvoie de quoi tout remettre en place, ou `null` s'il n'a pas lieu. */
function preparerAtterrissage(html: HTMLElement): (() => void) | null {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  const plus = document.querySelector('[data-visite-cible="barre-bas-nouveau"] > span')
  const r = plus?.getBoundingClientRect()
  if (!r || r.width === 0) return null

  const vars = {
    '--wb-atterrissage-dx': `${r.left + r.width / 2 - window.innerWidth / 2}px`,
    '--wb-atterrissage-dy': `${r.top + r.height / 2 - window.innerHeight / 2}px`,
    '--wb-atterrissage-echelle': String(r.width / TAILLE_LOGO_PX),
  }
  for (const [nom, valeur] of Object.entries(vars)) html.style.setProperty(nom, valeur)
  // Attribut et variable plutôt que classe : React réécrit `className`, pas ce qu'il ne gère pas.
  const blocs = blocsVisibles()
  blocs.forEach((el, i) => { el.setAttribute('data-wb-lancement', ''); el.style.setProperty('--wb-i', String(i)) })
  html.classList.add('wb-atterrissage')

  return () => {
    html.classList.remove('wb-atterrissage')
    for (const nom of Object.keys(vars)) html.style.removeProperty(nom)
    blocs.forEach(el => { el.removeAttribute('data-wb-lancement'); el.style.removeProperty('--wb-i') })
  }
}

export default function MarqueurPret() {
  useEffect(() => {
    const html = document.documentElement
    let lancement = false
    try {
      lancement = window.sessionStorage.getItem('wb-lance') !== '1'
      window.sessionStorage.setItem('wb-lance', '1')
    } catch { /* stockage refusé : pas de durée minimale, jamais d'écran bloqué */ }

    const pwa = html.classList.contains('wb-pwa')
    // `performance.now()` compte depuis le début de la navigation : le temps déjà passé à
    // charger compte dans les 3 secondes.
    const attente = pwa && lancement
      ? Math.max(0, DUREE_LANCEMENT_MS - AVANCE_ATTERRISSAGE_MS - performance.now())
      : 0

    const timers: ReturnType<typeof setTimeout>[] = []
    let remettre: (() => void) | null = null
    timers.push(setTimeout(() => {
      // Mesuré au dernier moment : la barre du bas n'existe qu'après le premier rendu client.
      remettre = pwa && lancement ? preparerAtterrissage(html) : null
      // Sans atterrissage, le fondu garde l'échéance des 3 secondes.
      const reste = remettre ? 0 : (pwa && lancement ? Math.max(0, DUREE_LANCEMENT_MS - performance.now()) : 0)
      timers.push(setTimeout(() => {
        html.classList.add('wb-lancement-fin')
        timers.push(setTimeout(() => {
          html.classList.add('wb-pret')
          remettre?.()
        }, remettre ? DUREE_ATTERRISSAGE_MS : DUREE_FONDU_MS))
      }, reste))
    }, attente))
    return () => { timers.forEach(clearTimeout); remettre?.() }
  }, [])
  return null
}
