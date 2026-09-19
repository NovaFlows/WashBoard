'use client'

// Nombre de messages non lus par le laveur, tous fils confondus : affiché
// dans le menu latéral (entrée « Assistance ») et sur le bouton ☰
// (DashboardShell). Purement décoratif : voir /api/support/non-lues (route de
// `dev`) — si elle échoue, on garde la dernière valeur connue plutôt que de
// retomber à zéro, et on ne trace même pas d'erreur, un chiffre en trop ou en
// moins ne mérite pas de bruit.
//
// Le sens de `count` a changé côté serveur le 2026-09-19 : ce n'était qu'un
// nombre de FILS non lus, c'est désormais un nombre de MESSAGES non lus — ce
// hook se contente de le relayer tel quel à l'appelant (UnreadCountBadge),
// aucun recalcul ici.

import { useCallback, useEffect, useState } from 'react'
import { SUPPORT_THREAD_READ_EVENT } from '@/lib/supportUnread'

/** `null` : rien à afficher (pas encore chargé, ou aucun appel réussi jusqu'ici). */
export function useSupportUnreadBadge(): number | null {
  const [count, setCount] = useState<number | null>(null)

  const rafraichir = useCallback(() => {
    fetch('/api/support/non-lues')
      .then(async res => {
        if (!res.ok) return // 503 : on garde la dernière valeur connue, voir plus haut
        const json = await res.json().catch(() => null)
        if (typeof json?.count === 'number') setCount(json.count)
      })
      .catch(() => { /* décoratif : jamais d'erreur visible pour une pastille */ })
  }, [])

  useEffect(() => {
    rafraichir()
    // Un fil marqué lu ailleurs sur la page (Guide, Assistance) doit faire
    // disparaître la pastille tout de suite, pas seulement à la prochaine
    // navigation. Le focus couvre le cas où la réponse arrive pendant que
    // l'onglet est en arrière-plan.
    window.addEventListener(SUPPORT_THREAD_READ_EVENT, rafraichir)
    window.addEventListener('focus', rafraichir)
    return () => {
      window.removeEventListener(SUPPORT_THREAD_READ_EVENT, rafraichir)
      window.removeEventListener('focus', rafraichir)
    }
  }, [rafraichir])

  return count
}
