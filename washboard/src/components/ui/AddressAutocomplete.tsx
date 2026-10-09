'use client'

import { useState, useEffect, useRef } from 'react'

type Props = {
  id?: string
  value: string
  onChange: (value: string) => void
  onSelectWithCoords?: (label: string, lat: number, lng: number) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  /** Affiche un lien « Utiliser ma position » sous le champ : géolocalisation
   *  du navigateur puis conversion en adresse lisible (voir
   *  /api/places/reverse-geocode). Faux par défaut — ce composant sert aussi
   *  dans des contextes où le geste n'a pas de sens (ex. le tableau de bord). */
  allowGeolocation?: boolean
}

type Suggestion = { label: string; placeId: string }

export default function AddressAutocomplete({ id, value, onChange, onSelectWithCoords, placeholder, className, style, allowGeolocation = false }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]               = useState(false)
  const [locating, setLocating]       = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Jeton de session Google : cree a la premiere frappe, reutilise pour toutes
  // les requetes de la meme saisie, puis clos par la requete de details. Google
  // facture alors la session entiere comme une unite, au lieu de chaque frappe.
  const sessionRef                    = useRef<string | null>(null)
  const containerRef                  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleChange(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 3) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      try {
        sessionRef.current ??= crypto.randomUUID()
        const res  = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(val.trim())}&session=${sessionRef.current}`)
        const data = await res.json()
        setSuggestions(data.suggestions ?? [])
        setOpen((data.suggestions ?? []).length > 0)
      } catch {
        setSuggestions([])
        setOpen(false)
      }
    }, 300)
  }

  async function select(s: Suggestion) {
    onChange(s.label)
    setSuggestions([])
    setOpen(false)
    if (onSelectWithCoords) {
      try {
        const res  = await fetch(`/api/places/details?placeId=${s.placeId}&session=${sessionRef.current ?? ''}`)
        const data = await res.json()
        if (data.lat && data.lng) onSelectWithCoords(s.label, data.lat, data.lng)
      } catch {
        // coordonnées indisponibles, le label est déjà mis à jour
      } finally {
        // Session close cote Google : la prochaine saisie en ouvrira une nouvelle.
        sessionRef.current = null
      }
    }
  }

  // Le navigateur rend des coordonnées, pas une adresse postale : on les
  // transforme côté serveur (même route Google que les autres champs
  // d'adresse de cette page, sous le même plafond partagé — voir
  // publicApiGuard). Le lien ne s'affiche que tant que le champ est
  // quasiment vide : une fois une adresse saisie ou choisie, proposer de la
  // remplacer par la position du téléphone n'a plus de sens.
  function locate() {
    if (!('geolocation' in navigator)) {
      setLocateError('La géolocalisation n’est pas disponible sur cet appareil.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        fetch(`/api/places/reverse-geocode?lat=${latitude}&lng=${longitude}`)
          .then(r => r.json())
          .then((data: { address?: string | null }) => {
            if (data.address) {
              onChange(data.address)
              onSelectWithCoords?.(data.address, latitude, longitude)
            } else {
              setLocateError('Adresse introuvable à cet endroit. Saisissez-la à la main.')
            }
          })
          .catch(() => setLocateError('Impossible de récupérer votre position pour le moment.'))
          .finally(() => setLocating(false))
      },
      () => {
        setLocateError('Position refusée ou indisponible. Saisissez votre adresse à la main.')
        setLocating(false)
      },
      { timeout: 10_000 },
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        style={style}
        autoComplete="off"
      />
      {allowGeolocation && value.trim().length < 5 && (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:opacity-70 disabled:opacity-50 transition-opacity"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
            <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {locating ? 'Recherche de votre position…' : 'Utiliser ma position'}
        </button>
      )}
      {locateError && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">{locateError}</p>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i} className={i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}>
              <button
                type="button"
                onMouseDown={() => select(s)}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2.5"
              >
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
