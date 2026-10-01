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
// Sans JavaScript (ou s'il ne se charge jamais), l'écran s'efface de lui-même au bout de
// 10 secondes : voir la règle de secours du CSS.
const DUREE_LANCEMENT_MS = 3000
const DUREE_FONDU_MS = 260

export default function MarqueurPret() {
  useEffect(() => {
    const html = document.documentElement
    let lancement = false
    try {
      lancement = window.sessionStorage.getItem('wb-lance') !== '1'
      window.sessionStorage.setItem('wb-lance', '1')
    } catch { /* stockage refusé : pas de durée minimale, jamais d'écran bloqué */ }

    // `performance.now()` compte depuis le début de la navigation : le temps déjà passé à
    // charger compte dans les 3 secondes.
    const attente = html.classList.contains('wb-pwa') && lancement
      ? Math.max(0, DUREE_LANCEMENT_MS - performance.now())
      : 0

    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => {
      html.classList.add('wb-lancement-fin')
      timers.push(setTimeout(() => html.classList.add('wb-pret'), DUREE_FONDU_MS))
    }, attente))
    return () => timers.forEach(clearTimeout)
  }, [])
  return null
}
