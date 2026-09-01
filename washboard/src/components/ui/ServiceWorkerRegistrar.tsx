'use client'

import { useEffect } from 'react'

// Enregistre le service worker, qui rend l'application installable sur
// l'écran d'accueil et permet de consulter les pages déjà vues hors ligne.
//
// Aucun repli n'est nécessaire : sur un navigateur qui ne le gère pas, ou en
// HTTP local, le site fonctionne exactement comme avant — il n'est simplement
// pas installable.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const enregistrer = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Un échec ici ne casse rien : on ne perd que le mode hors ligne.
        // Inutile d'alerter le laveur, il n'y peut rien.
      })
    }

    // On attend le chargement complet pour ne pas disputer la bande passante
    // au premier affichage.
    if (document.readyState === 'complete') enregistrer()
    else {
      window.addEventListener('load', enregistrer)
      return () => window.removeEventListener('load', enregistrer)
    }
  }, [])

  return null
}
