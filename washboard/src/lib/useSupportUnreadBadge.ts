'use client'

// Pastille « l'équipe a répondu, vous n'avez pas lu » du menu latéral et du
// bouton ☰ (DashboardShell). Purement décorative : voir /api/support/non-lues
// (route de `dev`) — si elle échoue, on n'affiche rien et on ne trace même
// pas d'erreur, un chiffre en trop ou en moins ne mérite pas de bruit.

import { useCallback, useEffect, useState } from 'react'
import { SUPPORT_THREAD_READ_EVENT } from '@/lib/supportUnread'

export function useSupportUnreadBadge(): boolean {
  const [hasUnread, setHasUnread] = useState(false)

  const rafraichir = useCallback(() => {
    fetch('/api/support/non-lues')
      .then(async res => {
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (typeof json?.count === 'number') setHasUnread(json.count > 0)
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

  return hasUnread
}
