'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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

  // Créneaux intelligents
  const [smartEnabled,       setSmartEnabled]       = useState(washer.smart_slot_enabled ?? false)
  const [smartRadius,        setSmartRadius]        = useState(String(washer.smart_slot_radius_minutes ?? 15))
  const [smartDiscountType,  setSmartDiscountType]  = useState<'fixed' | 'percent'>(washer.smart_slot_discount_type ?? 'fixed')
  const [smartDiscountValue, setSmartDiscountValue] = useState(String(washer.smart_slot_discount_value ?? 5))
  const [smartSaving,        setSmartSaving]        = useState(false)
  const [smartMsg,           setSmartMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  async function saveSmartSlot(e: React.FormEvent) {
    e.preventDefault()
    setSmartSaving(true)
    setSmartMsg(null)
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        smart_slot_enabled:          smartEnabled,
        smart_slot_radius_minutes:   parseInt(smartRadius) || 15,
        smart_slot_discount_type:    smartDiscountType,
        smart_slot_discount_value:   parseFloat(smartDiscountValue) || 0,
      }),
    })
    if (res.ok) { setSmartMsg({ ok: true, text: 'Paramètres sauvegardés' }); router.refresh() }
    else setSmartMsg({ ok: false, text: 'Erreur lors de la sauvegarde' })
    setSmartSaving(false)
  }

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
    if (res.ok) {
      setMsg({ ok: true, text: 'Modifications enregistrées' })
      router.refresh()
    } else {
      setMsg({ ok: false, text: 'Erreur lors de la sauvegarde' })
    }
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

      {/* Créneaux intelligents */}
      <form onSubmit={saveSmartSlot} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Créneaux intelligents</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Proposez une remise automatique quand un client réserve dans votre zone de tournée</p>
          </div>
          <button
            type="button"
            onClick={() => setSmartEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${smartEnabled ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${smartEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {smartEnabled && (
          <div className="space-y-3 pt-1">
            <div>
              <label className={labelClass}>Rayon de proximité (minutes en voiture)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={5} max={30} step={5}
                  value={parseInt(smartRadius) || 15}
                  onChange={e => setSmartRadius(e.target.value)}
                  className="flex-1 accent-amber-400"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-16 text-right">{smartRadius} min</span>
              </div>
            </div>

            <div>
              <label className={labelClass}>Remise proposée</label>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 text-sm shrink-0">
                  {(['fixed', 'percent'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setSmartDiscountType(t)}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${smartDiscountType === t ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
                      {t === 'fixed' ? '€' : '%'}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min={0} max={smartDiscountType === 'percent' ? 100 : 9999} step={0.5}
                  value={smartDiscountValue}
                  onChange={e => setSmartDiscountValue(e.target.value)}
                  onBlur={() => setSmartDiscountValue(v => String(parseFloat(v) || 0))}
                  className={`${inputClass} w-28`}
                />
                <p className="text-xs text-slate-400">
                  {smartDiscountType === 'fixed' ? `${smartDiscountValue}€ de remise` : `${smartDiscountValue}% de remise`} sur le créneau recommandé
                </p>
              </div>
            </div>
          </div>
        )}

        {smartMsg && (
          <p className={`text-sm font-medium ${smartMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {smartMsg.ok ? '✓ ' : '✕ '}{smartMsg.text}
          </p>
        )}
        <button type="submit" disabled={smartSaving}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {smartSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </form>

      {/* Google Agenda */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Google Agenda</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {washer.google_refresh_token
                ? 'Compte connecté — les RDV confirmés sont automatiquement ajoutés à votre agenda.'
                : 'Connectez votre compte pour synchroniser les RDV confirmés dans Google Agenda.'}
            </p>
          </div>
          <a
            href="/api/auth/google-calendar"
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              washer.google_refresh_token
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zm-7.5 13.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8.5c-1.93 0-3.5 1.57-3.5 3.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5z"/>
            </svg>
            {washer.google_refresh_token ? '✓ Connecté' : 'Connecter'}
          </a>
        </div>
      </div>

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
