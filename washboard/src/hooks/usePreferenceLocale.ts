'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Préférences d'AFFICHAGE, gardées sur l'appareil.
//
// Ce que le laveur choisit de ne plus voir (un bandeau fermé pour la journée, des réglages
// facultatifs qu'il ne fera pas, la barre de configuration) n'a rien à faire en base : ce
// n'est pas une donnée de son entreprise, ça ne regarde que ce téléphone-ci, et une colonne
// de plus voudrait dire une migration pour chaque nouvelle préférence.
//
// La contrepartie, assumée : un laveur qui ouvre WashBoard sur un autre appareil retrouve ce
// qu'il avait masqué ici. Le jour où ça gêne, le passage en base ne change que ce fichier.
//
// `useSyncExternalStore` plutôt qu'un `useState` + effet : deux composants éloignés lisent la
// même clé (la carte de configuration et sa ligne dans « Plus »), et le second doit se
// remettre à jour quand le premier écrit — d'où l'événement diffusé à tous les abonnés.

const EVENEMENT = 'wb-preference-locale'

function sAbonner(prevenir: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENEMENT, prevenir)
  // `storage` ne se déclenche que dans les AUTRES onglets : les deux sont utiles.
  window.addEventListener('storage', prevenir)
  return () => {
    window.removeEventListener(EVENEMENT, prevenir)
    window.removeEventListener('storage', prevenir)
  }
}

export function lirePreference(cle: string): string | null {
  try {
    return window.localStorage.getItem(cle)
  } catch {
    // Navigation privée, stockage refusé : la préférence n'existe pas, c'est tout.
    return null
  }
}

export function ecrirePreference(cle: string, valeur: string | null): void {
  try {
    if (valeur === null) window.localStorage.removeItem(cle)
    else window.localStorage.setItem(cle, valeur)
  } catch { /* stockage refusé : le choix ne survivra pas au rechargement, tant pis */ }
  window.dispatchEvent(new Event(EVENEMENT))
}

/** La valeur d'une préférence, et de quoi la changer.
 *
 *  Rend toujours `null` au rendu serveur et au premier rendu du navigateur : le HTML doit être
 *  identique des deux côtés, sinon React se plaint et rejette l'arbre. L'appelant affiche donc
 *  l'état « rien de masqué » une fraction de seconde — jamais l'inverse, qui ferait clignoter
 *  quelque chose que le laveur a demandé à ne plus voir. */
export function usePreferenceLocale(cle: string): [string | null, (valeur: string | null) => void] {
  const valeur = useSyncExternalStore(
    sAbonner,
    () => lirePreference(cle),
    () => null,
  )
  const definir = useCallback((v: string | null) => ecrirePreference(cle, v), [cle])
  return [valeur, definir]
}
