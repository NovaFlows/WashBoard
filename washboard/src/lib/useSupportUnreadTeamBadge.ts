'use client'

// Pendant de `useSupportUnreadBadge`, côté équipe cette fois : nombre de
// messages de laveurs non lus par l'équipe, tous laveurs confondus — affiché
// sur l'entrée « Support (équipe) » du menu latéral et sur le bouton ☰ (voir
// Sidebar, DashboardShell).
//
// Appelée sur CHAQUE page du dashboard, par TOUT compte connecté (laveur ou
// équipe) : /api/support/non-lues-equipe (route de `dev`) répond 401 à qui
// n'est pas de l'équipe, auquel cas on n'affiche jamais rien — un laveur
// normal n'a pas à savoir que cette route existe, et un 401 n'est pas une
// erreur à tracer ici, juste une réponse « pas pour toi ».
//
// Purement décoratif, même règle que côté laveur : si l'appel échoue (503),
// on garde la dernière valeur connue plutôt que de retomber à zéro.
//
// Pas d'événement dédié pour un rafraîchissement instantané inter-composants
// ici : la page où l'équipe lit les conversations (/dashboard/support) ne
// rend pas ce menu (voir son commentaire « Volontairement sans la coque du
// tableau de bord ») — il n'y a donc pas de cas où badge et boîte de
// réception coexistent sur le même écran pendant la lecture. Le montage de ce
// hook à l'arrivée sur une page du dashboard, plus le focus pour le cas de
// deux fenêtres/onglets côte à côte, suffisent à garder le nombre à jour.

import { useCallback, useEffect, useState } from 'react'

/** `null` : rien à afficher (pas encore chargé, pas membre de l'équipe, ou
 *  aucun appel réussi jusqu'ici). */
export function useSupportUnreadTeamBadge(): number | null {
  const [count, setCount] = useState<number | null>(null)

  const rafraichir = useCallback(() => {
    fetch('/api/support/non-lues-equipe')
      .then(async res => {
        if (!res.ok) return // 401 (pas de l'équipe) ou 503 : rien à afficher, jamais d'erreur ici
        const json = await res.json().catch(() => null)
        if (typeof json?.count === 'number') setCount(json.count)
      })
      .catch(() => { /* décoratif : jamais d'erreur visible pour une pastille */ })
  }, [])

  useEffect(() => {
    rafraichir()
    window.addEventListener('focus', rafraichir)
    return () => window.removeEventListener('focus', rafraichir)
  }, [rafraichir])

  return count
}
