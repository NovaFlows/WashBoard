'use client'

import { useState } from 'react'

// Formulaire de l'équipe support : on saisit le lien du laveur, le serveur
// vérifie qu'il a bien ouvert l'accès, et renvoie un lien de connexion.
//
// Le lien n'est pas suivi automatiquement : il s'affiche, et c'est un clic
// délibéré qui ouvre la session. Entrer dans le compte de quelqu'un ne doit
// jamais être le simple effet de bord d'un formulaire soumis.

export default function SupportAccessForm() {
  const [slug, setSlug] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [resultat, setResultat] = useState<{ url: string; washerName: string } | null>(null)

  async function demander(e: React.FormEvent) {
    e.preventDefault()
    setOccupe(true)
    setErreur(null)
    setResultat(null)
    try {
      const res = await fetch('/api/support/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setErreur(json.error ?? 'Accès impossible.'); return }
      setResultat(json)
    } catch {
      setErreur('Accès impossible. Vérifiez votre connexion.')
    } finally {
      setOccupe(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 max-w-xl">
      <form onSubmit={demander} className="space-y-3">
        <div>
          <label htmlFor="slug" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Lien du laveur
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="bellauto-89"
            required
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
            La partie après <code>/book/</code> dans son lien de réservation.
          </p>
        </div>

        <button
          type="submit"
          disabled={occupe || !slug.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#1651E8] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#0F4ACC] transition-colors"
        >
          {occupe ? 'Vérification…' : 'Obtenir un accès'}
        </button>
      </form>

      {erreur && (
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
          <p className="text-sm text-amber-800 dark:text-amber-400">{erreur}</p>
        </div>
      )}

      {resultat && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-1">
            {resultat.washerName} a bien ouvert l&apos;accès
          </p>
          <p className="text-xs text-emerald-700/90 dark:text-emerald-500/90 mb-3">
            Ouvrez ce lien dans une fenêtre de navigation privée : sinon vous perdez
            votre propre session et vous devrez vous reconnecter.
          </p>
          <a
            href={resultat.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
          >
            Ouvrir son compte
          </a>
        </div>
      )}
    </div>
  )
}
