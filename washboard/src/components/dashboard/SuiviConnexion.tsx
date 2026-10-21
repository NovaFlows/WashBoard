'use client'

import { useEffect } from 'react'

// Note que le laveur utilise WashBoard (`washers.derniere_connexion_le`, voir
// `api/washer/connexion`), pour que l'équipe sache quand il est venu pour la dernière fois
// (demande d'Alexandre, 2026-10-21). Sur le site comme dans l'application installée.
//
// Au plus une fois par demi-heure et par appareil (localStorage) : inutile d'écrire en base à
// chaque page. Ne bloque rien et n'affiche rien — un échec est retenté à la page suivante.
const CLE = 'wb-connexion-signalee-a'
const INTERVALLE_MS = 30 * 60 * 1000

export default function SuiviConnexion() {
  useEffect(() => {
    const maintenant = Date.now()
    try {
      const derniere = Number(window.localStorage.getItem(CLE))
      if (derniere && maintenant - derniere < INTERVALLE_MS) return
    } catch { /* stockage refusé : on signale quand même */ }
    fetch('/api/washer/connexion', { method: 'POST' })
      .then(res => {
        if (!res.ok) return
        try { window.localStorage.setItem(CLE, String(maintenant)) } catch { /* rien */ }
      })
      .catch(() => { /* hors ligne : retenté à la prochaine page */ })
  }, [])
  return null
}
