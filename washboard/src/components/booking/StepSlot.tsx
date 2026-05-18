'use client'

import { useState } from 'react'
import type { Availability } from '@/types'

type Props = {
  availabilities: Availability[]
  onNext: (data: { scheduled_at: string; address: string }) => void
  onBack: () => void
  accent?: string
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTH_NAMES = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']

function getNextDays(count: number): Date[] {
  const days: Date[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 1; i <= count; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    days.push(d)
  }
  return days
}

function generateSlots(start: string, end: string, durationMinutes: number): string[] {
  const slots: string[] = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let current = sh * 60 + sm
  const endMinutes = eh * 60 + em
  while (current + durationMinutes <= endMinutes) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += durationMinutes
  }
  return slots
}

export default function StepSlot({ availabilities, onNext, onBack, accent = '#2563eb' }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [address, setAddress] = useState('')

  const days = getNextDays(14)
  const availableDaysOfWeek = availabilities.map(a => a.day_of_week)

  const slotsForDay = selectedDate
    ? availabilities
        .filter(a => a.day_of_week === selectedDate.getDay())
        .flatMap(a => generateSlots(a.start_time, a.end_time, 60))
    : []

  const canContinue = selectedDate && selectedTime && address.trim().length > 5

  function handleNext() {
    if (!selectedDate || !selectedTime || !address) return
    const [h, m] = selectedTime.split(':').map(Number)
    const dt = new Date(selectedDate)
    dt.setHours(h, m, 0, 0)
    onNext({ scheduled_at: dt.toISOString(), address })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Choisissez un créneau</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Où et quand souhaitez-vous être lavé ?</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Adresse du véhicule</label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="12 rue de la Paix, 75001 Paris"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-shadow"
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
        />
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Sélectionnez un jour</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map(day => {
            const isAvailable = availableDaysOfWeek.includes(day.getDay())
            const isSelected = selectedDate?.toDateString() === day.toDateString()
            return (
              <button
                key={day.toISOString()}
                onClick={() => { if (isAvailable) { setSelectedDate(day); setSelectedTime(null) } }}
                disabled={!isAvailable}
                className={`flex-shrink-0 flex flex-col items-center py-2.5 px-3 rounded-xl border-2 text-xs transition-all min-w-[52px] ${
                  isSelected ? 'text-white shadow-md' :
                  isAvailable ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800' :
                  'border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed bg-slate-50 dark:bg-slate-900'
                }`}
                style={isSelected ? { backgroundColor: accent, borderColor: accent } : undefined}
              >
                <span className="font-medium">{DAY_NAMES[day.getDay()]}</span>
                <span className="text-base font-bold mt-0.5">{day.getDate()}</span>
                <span className={`text-[10px] mt-0.5 ${isSelected ? 'opacity-80' : 'text-slate-400 dark:text-slate-500'}`}>
                  {MONTH_NAMES[day.getMonth()]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Heure</p>
          {slotsForDay.length === 0 ? (
            <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <p className="text-sm text-slate-400 dark:text-slate-500">Aucun créneau disponible ce jour</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slotsForDay.map(slot => (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    selectedTime === slot
                      ? 'text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                  }`}
                  style={selectedTime === slot ? { backgroundColor: accent, borderColor: accent } : undefined}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
        >
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 py-3 px-4 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90 text-sm"
          style={{ backgroundColor: accent }}
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
