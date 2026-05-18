'use client'

import { useState, useRef } from 'react'
import type { Washer } from '@/types'

type LogoStatus = 'idle' | 'removing' | 'uploading' | 'done' | 'error'

const PALETTE = [
  '#1e3a8a', '#1d4ed8', '#2563eb', '#0ea5e9',
  '#0891b2', '#0284c7', '#0369a1',
  '#15803d', '#16a34a', '#059669', '#0d9488',
  '#6d28d9', '#7c3aed', '#9333ea',
  '#dc2626', '#e11d48', '#db2777', '#c026d3',
  '#c2410c', '#ea580c', '#d97706',
  '#0f172a', '#1e293b', '#374151',
]

export default function IdentiteForm({ washer }: { washer: Washer }) {
  const [logoUrl, setLogoUrl] = useState(washer.logo_url ?? '')
  const [logoStatus, setLogoStatus] = useState<LogoStatus>('idle')
  const [logoError, setLogoError] = useState<string | null>(null)
  const [message, setMessage] = useState(washer.welcome_message ?? '')
  const [color, setColor] = useState(washer.brand_color ?? '#2563eb')
  const [colorSaving, setColorSaving] = useState(false)
  const [colorSaved, setColorSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoStatus('removing')
    setLogoError(null)
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(file)
      setLogoStatus('uploading')
      const form = new FormData()
      form.append('file', blob, 'logo.png')
      const res = await fetch('/api/washer/logo', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur upload')
      setLogoUrl(json.url + '?t=' + Date.now())
      setLogoStatus('done')
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Erreur')
      setLogoStatus('error')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function pickColor(hex: string) {
    setColor(hex)
    setColorSaving(true)
    setColorSaved(false)
    await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_color: hex }),
    })
    setColorSaving(false)
    setColorSaved(true)
    setTimeout(() => setColorSaved(false), 2000)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ welcome_message: message }),
    })
    setMsg(res.ok
      ? { ok: true, text: 'Modifications enregistrées' }
      : { ok: false, text: 'Erreur lors de la sauvegarde' }
    )
    setLoading(false)
  }

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
  const busy = logoStatus === 'removing' || logoStatus === 'uploading'

  return (
    <form onSubmit={save} className="space-y-5">
      {/* Logo */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Logo</h2>
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-3xl font-bold text-slate-400">{washer.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={busy} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? '...' : logoUrl ? 'Changer le logo' : 'Choisir une image'}
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500">Le fond sera supprimé automatiquement (PNG, JPG…)</p>
            {busy && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {logoStatus === 'removing' ? 'Suppression du fond...' : 'Sauvegarde...'}
                </span>
              </div>
            )}
            {logoStatus === 'done' && <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ Logo mis à jour</p>}
            {logoStatus === 'error' && logoError && <p className="text-xs text-red-600 dark:text-red-400">✕ {logoError}</p>}
          </div>
        </div>
      </div>

      {/* Couleur */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Couleur de la marque</h2>
          <div className="flex items-center gap-2">
            {colorSaving && <span className="text-xs text-slate-400">Sauvegarde...</span>}
            {colorSaved && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓ Sauvegardé</span>}
            <div className="w-6 h-6 rounded-full border-2 border-white shadow-md shrink-0" style={{ backgroundColor: color }} />
          </div>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {PALETTE.map(hex => (
            <button
              key={hex}
              type="button"
              onClick={() => pickColor(hex)}
              title={hex}
              className="relative w-8 h-8 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: hex, focusRingColor: hex } as React.CSSProperties}
            >
              {color === hex && (
                <svg className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">Colore les boutons et éléments sélectionnés sur votre page client</p>
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

      {/* Aperçu */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Aperçu header client</p>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-full h-full object-contain" />
              : <span className="font-bold text-slate-500">{washer.name.charAt(0).toUpperCase()}</span>
            }
          </div>
          <div>
            <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{washer.name}</p>
            <p className="text-xs text-slate-400">{message || 'Réservation en ligne'}</p>
          </div>
          <div className="ml-auto">
            <div className="px-3 py-1.5 rounded-lg text-white text-xs font-semibold" style={{ backgroundColor: color }}>
              Continuer →
            </div>
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
        {loading ? 'Enregistrement...' : 'Enregistrer le message'}
      </button>
    </form>
  )
}
