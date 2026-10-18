'use client'

import { useEffect } from 'react'

// Note qu'un laveur ouvre WashBoard en application installée (PWA), pour que l'équipe sache
// qui l'a installée (demande d'Alexandre, 2026-10-15 : « savoir s'il a installé la PWA »).
// Les notifications, elles, se lisent déjà dans `push_subscriptions`.
//
// Une seule fois par jour et par appareil (localStorage) : inutile d'écrire en base à chaque
// page. Ne bloque rien et n'affiche rien — un échec est simplement retenté le lendemain.
const CLE = 'wb-pwa-signale-le'

export function estApplicationInstallee(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export default function SuiviPwa() {
  useEffect(() => {
    if (!estApplicationInstallee()) return
    const jour = new Date().toISOString().slice(0, 10)
    try {
      if (window.localStorage.getItem(CLE) === jour) return
    } catch { /* stockage refusé : on signale quand même */ }
    fetch('/api/washer/pwa', { method: 'POST' })
      .then(res => {
        if (!res.ok) return
        try { window.localStorage.setItem(CLE, jour) } catch { /* rien */ }
      })
      .catch(() => { /* hors ligne : retenté à la prochaine ouverture */ })
  }, [])
  return null
}
