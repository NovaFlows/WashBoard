'use client'

import { useCallback, useEffect, useState } from 'react'

// L'accès de l'équipe au compte du laveur (« Aide à la configuration ») : état, ouverture
// pour une heure, fermeture immédiate. Mêmes routes (`/api/support/grant`) et mêmes phrases
// d'erreur que `SupportAccessPanel` (l'écran du site, inchangé) ; ce hook ne sert qu'à
// l'écran de la PWA (`AccesSupportV2`).

export type EtatAcces = { active: boolean; minutesLeft: number; lastUsedAt: string | null }

export function useAccesSupport() {
  const [etat, setEtat] = useState<EtatAcces | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Chaîne de promesses : tous les `setState` partent d'un `.then`, jamais du corps de l'effet.
  const lire = useCallback(() => {
    return fetch('/api/support/grant')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: EtatAcces) => { setEtat(d); setErreur(null) })
      .catch(() => setErreur('Impossible de lire l’état de l’accès.'))
  }, [])

  useEffect(() => { void lire() }, [lire])

  // Tant qu'un accès est ouvert, le compteur descend sous les yeux du laveur.
  useEffect(() => {
    if (!etat?.active) return
    const t = setInterval(() => { void lire() }, 60_000)
    return () => clearInterval(t)
  }, [etat?.active, lire])

  async function basculer(ouvrir: boolean) {
    setOccupe(true)
    setErreur(null)
    try {
      const res = await fetch('/api/support/grant', { method: ouvrir ? 'POST' : 'DELETE' })
      const json = await res.json()
      if (!res.ok) { setErreur(json.error ?? 'Action impossible.'); return }
      await lire()
    } catch {
      setErreur('Action impossible. Vérifiez votre connexion.')
    } finally {
      setOccupe(false)
    }
  }

  return { etat, occupe, erreur, basculer }
}
