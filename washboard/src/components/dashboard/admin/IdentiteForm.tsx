'use client'

import { useState } from 'react'
import type { Washer } from '@/types'

export default function IdentiteForm({ washer }: { washer: Washer }) {
  const [logoUrl, setLogoUrl] = useState(washer.logo_url ?? '')
  const [message, setMessage] = useState(washer.welcome_message ?? '')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo_url: logoUrl, welcome_message: message }),
    })
    setMsg(res.ok
      ? { ok: true, text: 'Modifications enregistrées' }
      : { ok: false, text: 'Erreur lors de la sauvegarde' }
    )
    setLoading(false)
  }

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  return (
    <form onSubmit={save} className="space-y-5">
      {/* Aperçu logo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Logo</h2>
        <div className="flex items-center gap-4 mb-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-400">
              {washer.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <label className={labelClass}>URL du logo</label>
            <input
              type="url"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://exemple.com/mon-logo.png"
              className={inputClass}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Hébergez votre image et collez le lien ici</p>
          </div>
        </div>
      </div>

      {/* Message d'accueil */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Message d'accueil</h2>
        <label className={labelClass}>Affiché sous votre nom sur la page de réservation</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Bienvenue ! Je me déplace chez vous pour laver votre véhicule..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Aperçu rapide */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Aperçu header client</p>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">
              {washer.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{washer.name}</p>
            <p className="text-xs text-slate-400">{message || 'Réservation en ligne'}</p>
          </div>
        </div>
      </div>

      {msg && (
        <p className={`text-sm font-medium ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
          {msg.ok ? '✓ ' : '✕ '}{msg.text}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
      >
        {loading ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  )
}
