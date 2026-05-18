'use client'

import { useState } from 'react'
import type { Availability } from '@/types'

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export default function DisponibilitesManager({ availabilities: initial }: { availabilities: Availability[] }) {
  const [slots, setSlots] = useState(initial)
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('18:00')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byDay = DAYS.map((_, i) => slots.filter(s => s.day_of_week === i))

  async function addSlot() {
    if (startTime >= endTime) { setError('L\'heure de fin doit être après l\'heure de début'); return }
    setLoading(true); setError(null)
    const res = await fetch('/api/availabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setLoading(false); return }
    setSlots(s => [...s, json.data])
    setLoading(false)
  }

  async function removeSlot(id: string) {
    await fetch(`/api/availabilities/${id}`, { method: 'DELETE' })
    setSlots(s => s.filter(sl => sl.id !== id))
  }

  const timeInput = "border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="space-y-5">
      {/* Formulaire ajout */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Ajouter un créneau</h2>

        {/* Sélection du jour */}
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Jour</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} type="button" onClick={() => setDayOfWeek(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                  dayOfWeek === i
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                }`}>{d}</button>
            ))}
          </div>
        </div>

        {/* Horaires */}
        <div className="flex items-center gap-3 mb-4">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Début</p>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={timeInput} />
          </div>
          <div className="text-slate-400 mt-5">→</div>
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fin</p>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={timeInput} />
          </div>
        </div>

        {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}

        <button onClick={addSlot} disabled={loading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {loading ? 'Ajout...' : '+ Ajouter ce créneau'}
        </button>
      </div>

      {/* Calendrier hebdomadaire */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Planning de la semaine</h2>
        <div className="space-y-3">
          {DAYS.map((day, i) => {
            const daySlots = byDay[i]
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${daySlots.length > 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'}`}>
                <span className={`text-xs font-bold w-8 pt-0.5 shrink-0 ${daySlots.length > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {DAYS_SHORT[i]}
                </span>
                {daySlots.length === 0 ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500 pt-0.5">Indisponible</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </span>
                        <button onClick={() => removeSlot(slot.id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors ml-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
