'use client'

import { useState, useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (value: string) => void
  onSelectWithCoords?: (label: string, lat: number, lng: number) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

type Suggestion = { label: string; placeId: string }

export default function AddressAutocomplete({ value, onChange, onSelectWithCoords, placeholder, className, style }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]               = useState(false)
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null)
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
        const res  = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(val.trim())}`)
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
        const res  = await fetch(`/api/places/details?placeId=${s.placeId}`)
        const data = await res.json()
        if (data.lat && data.lng) onSelectWithCoords(s.label, data.lat, data.lng)
      } catch {
        // coordonnées indisponibles, le label est déjà mis à jour
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        style={style}
        autoComplete="off"
      />
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
