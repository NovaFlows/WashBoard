'use client'

// Visibilité de l'entrée « Support » du menu (outil interne, réservé à
// l'équipe) : décidée uniquement par le serveur via /api/support/est-equipe
// (route de `dev`), jamais devinée côté client à partir de l'adresse du
// compte connecté. On part de `false` et on ne passe à `true` que sur une
// réponse serveur qui le confirme explicitement — un échec réseau ou une
// route pas encore déployée ne doivent jamais faire apparaître une entrée
// réservée à l'équipe chez un laveur.

import { useEffect, useState } from 'react'

export function useEstEquipeSupport(): boolean {
  const [estEquipe, setEstEquipe] = useState(false)

  useEffect(() => {
    let annule = false
    fetch('/api/support/est-equipe')
      .then(async res => {
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (!annule && json?.membre === true) setEstEquipe(true)
      })
      .catch(() => { /* silencieux : jamais d'entrée affichée par erreur */ })
    return () => { annule = true }
  }, [])

  return estEquipe
}
