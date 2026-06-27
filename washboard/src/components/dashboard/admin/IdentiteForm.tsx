'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Washer, ZoneConfig } from '@/types'
import { DEPARTMENTS } from '@/lib/france-departments'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { BG_THEME_PRESETS, isCustomTheme } from '@/lib/themes'

import type { BgThemePreset } from '@/lib/themes'

type LogoStatus = 'idle' | 'removing' | 'uploading' | 'done' | 'error'

function ThemeButton({ theme, selected, onPick }: { theme: BgThemePreset; selected: boolean; onPick: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(theme.id)}
      className={`relative rounded-xl overflow-hidden border-2 transition-all h-20 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {/* Fond — photo ou dégradé */}
      <div className="absolute inset-0" style={{ background: theme.gradient }} />
      {theme.photo && (
        <img
          src={`${theme.photo}&w=300&q=60`}
          alt={theme.name}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.85 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
      {/* Overlay dégradé bas pour lisibilité du label */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      {/* Label */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 text-left">
        <p className="text-[10px] font-bold text-white leading-tight">{theme.name}</p>
        <p className="text-[9px] text-white/55 leading-tight">{theme.subtitle}</p>
      </div>
      {/* Coche sélection */}
      {selected && (
        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7"/>
          </svg>
        </div>
      )}
    </button>
  )
}

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
  const [bgTheme, setBgTheme] = useState<string | null>(washer.background_theme ?? null)
  const [bgUploading, setBgUploading] = useState(false)
  const [bgError, setBgError] = useState<string | null>(null)
  const [bgSaving, setBgSaving] = useState(false)
  const bgFileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState(washer.welcome_message ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(washer.website_url ?? '')
  const [color, setColor] = useState(washer.brand_color ?? '#2563eb')
  const [colorSaving, setColorSaving] = useState(false)
  const [colorSaved, setColorSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Zone d'intervention
  const zoneInit = washer.zone_config
  const [zoneEnabled,        setZoneEnabled]        = useState(zoneInit?.enabled ?? false)
  const [zoneType,           setZoneType]           = useState<'crow' | 'road' | 'departments'>(() => {
    if (!zoneInit?.enabled) return 'crow'
    return zoneInit.type
  })
  const [zoneCenterAddress,  setZoneCenterAddress]  = useState(() => {
    if (!zoneInit?.enabled || zoneInit.type === 'departments') return ''
    return zoneInit.center_address
  })
  const [zoneRadiusKm,       setZoneRadiusKm]       = useState(() => {
    if (!zoneInit?.enabled || zoneInit.type === 'departments') return '20'
    return String(zoneInit.radius_km)
  })
  const [zoneDepts,          setZoneDepts]          = useState<string[]>(() => {
    if (!zoneInit?.enabled || zoneInit.type !== 'departments') return []
    return zoneInit.departments
  })
  const [deptSearch,         setDeptSearch]         = useState('')
  const [deptEditing,        setDeptEditing]        = useState(() =>
    !(zoneInit?.enabled && zoneInit.type === 'departments' && zoneInit.departments.length > 0)
  )
  const [zoneSaving,         setZoneSaving]         = useState(false)
  const [zoneMsg,            setZoneMsg]            = useState<{ ok: boolean; text: string } | null>(null)

  async function saveZone() {
    setZoneSaving(true)
    setZoneMsg(null)
    let config: ZoneConfig
    if (!zoneEnabled) {
      config = { enabled: false }
    } else if (zoneType === 'departments') {
      config = { enabled: true, type: 'departments', departments: zoneDepts }
    } else {
      config = { enabled: true, type: zoneType, center_address: zoneCenterAddress.trim(), radius_km: parseInt(zoneRadiusKm) || 20 }
    }
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_config: config }),
    })
    if (res.ok) {
      setZoneMsg({ ok: true, text: 'Zone sauvegardée' })
      if (zoneType === 'departments' && zoneDepts.length > 0) setDeptEditing(false)
      router.refresh()
    } else {
      setZoneMsg({ ok: false, text: 'Erreur lors de la sauvegarde' })
    }
    setZoneSaving(false)
  }

  // Créneaux intelligents
  const [smartEnabled,       setSmartEnabled]       = useState(washer.smart_slot_enabled ?? false)
  const [smartRadius,        setSmartRadius]        = useState(String(washer.smart_slot_radius_minutes ?? 15))
  const [smartDiscountType,  setSmartDiscountType]  = useState<'fixed' | 'percent'>(washer.smart_slot_discount_type ?? 'fixed')
  const [smartDiscountValue, setSmartDiscountValue] = useState(String(washer.smart_slot_discount_value ?? 5))
  const [smartSaving,        setSmartSaving]        = useState(false)
  const [smartMsg,           setSmartMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  async function saveSmartSlot() {
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

  async function pickBgTheme(themeId: string | null) {
    setBgTheme(themeId)
    setBgSaving(true)
    await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ background_theme: themeId }),
    })
    setBgSaving(false)
    router.refresh()
  }

  async function handleBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgUploading(true)
    setBgError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/washer/background', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur upload')
      setBgTheme(json.url)
      router.refresh()
    } catch (err) {
      setBgError(err instanceof Error ? err.message : 'Erreur')
    }
    setBgUploading(false)
    if (bgFileRef.current) bgFileRef.current.value = ''
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
      body: JSON.stringify({
        welcome_message: message,
        website_url: websiteUrl.trim() || null,
      }),
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

      {/* Thème de fond */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Fond de la page client</h2>
          {bgSaving && <span className="text-xs text-slate-400">Sauvegarde...</span>}
        </div>

        {/* Original */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Original</p>
          <button
            type="button"
            onClick={() => pickBgTheme(null)}
            className={`relative rounded-xl overflow-hidden border-2 transition-all h-16 w-full sm:w-40 ${
              !bgTheme
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center gap-2">
              <span className="text-sm">☀️</span>
              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Clair / Sombre</span>
              <span className="text-sm">🌙</span>
            </div>
            {!bgTheme && (
              <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7"/></svg>
              </div>
            )}
          </button>
        </div>

        {/* Dégradés */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Dégradés</p>
          <div className="grid grid-cols-3 gap-2">
            {BG_THEME_PRESETS.filter(t => !t.photo).map(theme => (
              <ThemeButton key={theme.id} theme={theme} selected={bgTheme === theme.id} onPick={pickBgTheme} />
            ))}
          </div>
        </div>

        {/* Photos */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Photos</p>
          <div className="grid grid-cols-3 gap-2">
            {BG_THEME_PRESETS.filter(t => !!t.photo).map(theme => (
              <ThemeButton key={theme.id} theme={theme} selected={bgTheme === theme.id} onPick={pickBgTheme} />
            ))}
          </div>
        </div>

        {/* Upload personnalisé */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
          isCustomTheme(bgTheme)
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
            : 'border-dashed border-slate-200 dark:border-slate-700'
        }`}>
          {isCustomTheme(bgTheme) && bgTheme && (
            <img src={bgTheme} alt="Fond personnalisé" className="w-14 h-10 rounded-lg object-cover shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {isCustomTheme(bgTheme) ? 'Photo personnalisée active' : 'Utiliser votre propre photo'}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">JPG ou PNG · max 5 Mo</p>
          </div>
          <input ref={bgFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleBgFile} />
          <button
            type="button"
            onClick={() => bgFileRef.current?.click()}
            disabled={bgUploading}
            className="shrink-0 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
          >
            {bgUploading ? 'Upload...' : 'Choisir'}
          </button>
        </div>
        {bgError && <p className="text-xs text-red-600 dark:text-red-400 mt-2">✕ {bgError}</p>}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
          La photo sera assombrie automatiquement pour rester lisible.
        </p>
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

      {/* Site web + Avis Google */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Présence en ligne</h2>

        <div>
          <label className={labelClass}>Site web <span className="font-normal text-slate-400">(les avis présents sur votre site seront affichés sur la page client)</span></label>
          <input
            type="url"
            value={websiteUrl}
            onChange={e => setWebsiteUrl(e.target.value)}
            placeholder="https://monsite.fr"
            className={inputClass}
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">Les avis clients visibles sur votre site seront récupérés automatiquement</p>
        </div>
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

      {/* Zone d'intervention */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Zone d'intervention</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Bloquez les réservations hors de votre secteur</p>
          </div>
          <button
            type="button"
            onClick={() => setZoneEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${zoneEnabled ? 'bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${zoneEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {zoneEnabled && (
          <div className="space-y-4 pt-1">
            {/* Sélecteur de mode */}
            <div>
              <label className={labelClass}>Mode de délimitation</label>
              <div className="flex gap-2">
                {([
                  { value: 'crow',        label: 'Vol d\'oiseau', desc: 'Rayon en km, distance directe' },
                  { value: 'road',        label: 'Distance routière', desc: 'Rayon en km par la route' },
                  { value: 'departments', label: 'Départements', desc: 'Sélection de départements' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setZoneType(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-xl border-2 text-xs font-medium transition-all text-left ${
                      zoneType === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <span className="font-semibold block">{opt.label}</span>
                    <span className="opacity-70 text-[10px]">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {(zoneType === 'crow' || zoneType === 'road') && (
              <>
                <div>
                  <label className={labelClass}>Adresse de base (votre garage / point de départ)</label>
                  <AddressAutocomplete
                    value={zoneCenterAddress}
                    onChange={setZoneCenterAddress}
                    placeholder="12 rue de la Paix, 75001 Paris"
                    className={inputClass}
                  />
                  {zoneType === 'crow' && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Les coordonnées GPS sont calculées automatiquement à la sauvegarde.</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Rayon d'intervention</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={5} max={150} step={5}
                      value={parseInt(zoneRadiusKm) || 20}
                      onChange={e => setZoneRadiusKm(e.target.value)}
                      className="flex-1 accent-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 w-16 text-right">{zoneRadiusKm} km</span>
                  </div>
                </div>
              </>
            )}

            {zoneType === 'departments' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={labelClass + ' mb-0'}>Départements couverts ({zoneDepts.length} sélectionné{zoneDepts.length > 1 ? 's' : ''})</label>
                  {!deptEditing && (
                    <button type="button" onClick={() => setDeptEditing(true)}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                      Modifier
                    </button>
                  )}
                </div>

                {!deptEditing ? (
                  /* Affichage des chips après sauvegarde */
                  <div className="flex flex-wrap gap-1.5">
                    {zoneDepts.length === 0 ? (
                      <span className="text-xs text-slate-400">Aucun département sélectionné</span>
                    ) : (
                      zoneDepts.map(code => {
                        const dept = DEPARTMENTS.find(d => d.code === code)
                        return (
                          <span key={code} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800">
                            <span className="font-bold">{code}</span>
                            <span className="opacity-70">{dept?.name}</span>
                          </span>
                        )
                      })
                    )}
                  </div>
                ) : (
                  /* Mode édition : recherche + checkboxes */
                  <>
                    <input
                      type="text"
                      value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)}
                      placeholder="Rechercher par nom ou numéro..."
                      className={`${inputClass} mb-2`}
                    />
                    <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                      {DEPARTMENTS
                        .filter(d => {
                          const q = deptSearch.toLowerCase()
                          return !q || d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
                        })
                        .map(d => (
                          <label key={d.code} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={zoneDepts.includes(d.code)}
                              onChange={e => setZoneDepts(prev =>
                                e.target.checked ? [...prev, d.code] : prev.filter(c => c !== d.code)
                              )}
                              className="accent-blue-500"
                            />
                            <span className="text-xs text-slate-500 dark:text-slate-400 w-8 shrink-0">{d.code}</span>
                            <span className="text-sm text-slate-800 dark:text-slate-200">{d.name}</span>
                          </label>
                        ))
                      }
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {zoneMsg && (
          <p className={`text-sm font-medium ${zoneMsg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {zoneMsg.ok ? '✓ ' : '✕ '}{zoneMsg.text}
          </p>
        )}
        <button type="button" onClick={saveZone} disabled={zoneSaving}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {zoneSaving ? 'Sauvegarde...' : 'Sauvegarder la zone'}
        </button>
      </div>

      {/* Créneaux intelligents */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
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
        <button type="button" onClick={saveSmartSlot} disabled={smartSaving}
          className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {smartSaving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

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
            {washer.google_refresh_token && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                Les RDV n&apos;apparaissent plus ? <a href="/api/auth/google-calendar" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Reconnecter le compte</a>
              </p>
            )}
          </div>
          <a
            href="/api/auth/google-calendar"
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              washer.google_refresh_token
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
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
        {loading ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  )
}
