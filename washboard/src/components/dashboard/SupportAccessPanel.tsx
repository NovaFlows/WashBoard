'use client'

import { useEffect, useState } from 'react'

// Le laveur ouvre, surveille et referme l'accès du support à son compte.
//
// Le ton compte autant que la fonction : on demande à quelqu'un d'ouvrir son
// tableau de bord, ses clients et sa comptabilité. Chaque phrase dit donc ce
// qui se passe exactement, combien de temps ça dure, et comment couper.

type Etat = { active: boolean; minutesLeft: number; lastUsedAt: string | null }

export function SupportAccessPanel() {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Chaîne de promesses plutôt que `async/await` : tous les `setState` partent
  // alors d'un `.then`, jamais du corps de l'effet, ce qui évite le rendu en
  // cascade au premier affichage.
  function lire() {
    return fetch('/api/support/grant')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: Etat) => setEtat(d))
      .catch(() => setErreur('Impossible de lire l’état de l’accès.'))
  }

  useEffect(() => { lire() }, [])

  // Tant qu'un accès est ouvert, le compteur doit descendre sous les yeux du
  // laveur : un « il reste 60 minutes » figé pendant une heure ne rassure
  // personne.
  useEffect(() => {
    if (!etat?.active) return
    const t = setInterval(lire, 60_000)
    return () => clearInterval(t)
  }, [etat?.active])

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

  if (!etat && !erreur) return null

  const dernierAcces = etat?.lastUsedAt
    ? new Date(etat.lastUsedAt).toLocaleString('fr-FR', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-1">Aide à la configuration</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Ouvrez l&apos;accès à votre compte pour qu&apos;on vous aide à le configurer. Il se
        referme tout seul au bout d&apos;une heure, et vous pouvez couper avant.
      </p>

      {etat?.active ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3.5 mb-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            Accès ouvert — il reste {etat.minutesLeft} minute{etat.minutesLeft > 1 ? 's' : ''}
          </p>
          <p className="text-xs text-amber-700/90 dark:text-amber-500/90 mt-0.5">
            Pendant ce temps, notre équipe peut se connecter à votre compte pour vous aider.
          </p>
        </div>
      ) : null}

      <button
        onClick={() => basculer(!etat?.active)}
        disabled={occupe}
        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          etat?.active
            ? 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            : 'bg-[#1651E8] text-white hover:bg-[#0F4ACC]'
        }`}
      >
        {occupe ? 'Un instant…' : etat?.active ? 'Fermer l’accès maintenant' : 'Ouvrir l’accès pour 1 heure'}
      </button>

      {dernierAcces && (
        // La trace est la contrepartie de la confiance demandée : le laveur
        // doit pouvoir vérifier si quelqu'un est réellement entré, et quand.
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          Dernier accès de notre équipe : {dernierAcces}
        </p>
      )}

      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{erreur}</p>}
    </div>
  )
}
