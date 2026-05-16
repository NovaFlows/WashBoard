'use client'

import { useState } from 'react'
import type { Availability } from '@/types'

type Props = {
  availabilities: Availability[]
  onNext: (data: { scheduled_at: string; address: string }) => void
  onBack: () => void
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

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

export default function StepSlot({ availabilities, onNext, onBack }: Props) {
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Choisissez un créneau</h2>

      {/* Adresse */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Adresse du véhicule</label>
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="12 rue de la Paix, 75001 Paris"
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Sélection du jour */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Jour</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map(day => {
            const isAvailable = availableDaysOfWeek.includes(day.getDay())
            const isSelected = selectedDate?.toDateString() === day.toDateString()
            return (
              <button
                key={day.toISOString()}
                onClick={() => { if (isAvailable) { setSelectedDate(day); setSelectedTime(null) } }}
                disabled={!isAvailable}
                className={`flex-shrink-0 flex flex-col items-center py-2 px-3 rounded-xl border-2 text-xs transition-colors ${
                  isSelected ? 'border-blue-600 bg-blue-50 text-blue-600' :
                  isAvailable ? 'border-gray-200 hover:border-gray-300 text-gray-700' :
                  'border-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                <span className="font-medium">{DAY_NAMES[day.getDay()].slice(0, 3)}</span>
                <span className="text-base font-bold mt-0.5">{day.getDate()}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Créneaux horaires */}
      {selectedDate && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Heure</p>
          {slotsForDay.length === 0 ? (
            <p className="text-sm text-gray-400">Aucun créneau disponible ce jour</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slotsForDay.map(slot => (
                <button
                  key={slot}
                  onClick={() => setSelectedTime(slot)}
                  className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    selectedTime === slot
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
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
          className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition-colors"
        >
          Retour
        </button>
        <button
          onClick={handleNext}
          disabled={!canContinue}
          className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
