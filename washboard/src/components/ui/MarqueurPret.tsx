'use client'

import { useEffect } from 'react'

// Écran de lancement de la PWA installée (voir globals.css, « Écran de lancement ») : tant
// que l'application n'a pas fini de se charger, un écran beige avec le logo la recouvre —
// au lieu du noir d'iOS, ou de la page v1 entrevue avant que la v2 ne prenne la place.
// Ce marqueur, posé sur <html> une fois l'application démarrée dans le navigateur, le retire.
// Sans JavaScript (ou s'il ne se charge jamais), l'écran s'efface de lui-même au bout de
// quelques secondes : voir la règle de secours du CSS.
export default function MarqueurPret() {
  useEffect(() => {
    document.documentElement.classList.add('wb-pret')
  }, [])
  return null
}
