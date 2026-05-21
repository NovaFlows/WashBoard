'use client'

import { useState, useEffect } from 'react'
import type { Availability } from '@/types'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'

type ExistingBooking  = { scheduled_at: string; services: { duration_minutes: number } | null }
type UnavailabilityItem = { id: string; start_date: string; end_date: string; team_members_off?: number }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Props = {
  availabilities: Availability[]
  existingBookings: ExistingBooking[]
  unavailabilities: UnavailabilityItem[]
  teamSize: number
  serviceDuration: number
  servicePrice: number
  washerId: string
  onNext: (data: { scheduled_at: string; address: string; is_smart_slot?: boolean; smart_discount?: number }) => void
  onBack: () => void
  accent?: string
}

function countOverlaps(slotTime: string, date: Date, duration: number, bookings: ExistingBooking[]): number {
  const [h, m] = slotTime.split(':').map(Number)
  const slotStart = new Date(date)
  slotStart.setHours(h, m, 0, 0)
  const slotEnd = new Date(slotStart.getTime() + duration * 60_000)
  return bookings.filter(b => {
    const bStart = new Date(b.scheduled_at)
    const bEnd   = new Date(bStart.getTime() + (b.services?.duration_minutes ?? 60) * 60_000)
    return bStart < slotEnd && bEnd > slotStart
  }).length
}

const DAY_NAMES   = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
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

export default function StepSlot({
  availabilities, existingBookings, unavailabilities, teamSize, serviceDuration, servicePrice, washerId,
  onNext, onBack, accent = '#2563eb',
}: Props) {
  const [selectedDate,      setSelectedDate]      = useState<Date | null>(null)
  const [selectedTime,      setSelectedTime]      = useState<string | null>(null)
  const [address,           setAddress]           = useState('')
  const [debouncedAddress,  setDebouncedAddress]  = useState('')
  const [zoneAllowed,       setZoneAllowed]       = useState(true)
  const [zoneMessage,       setZoneMessage]       = useState<string | null>(null)
  type SmartWindow = { start: string; end: string }
  type BookingConstraint = { start: string; end: string; travelToNew: number; travelFromNew: number }
  const [smartWindows,       setSmartWindows]       = useState<SmartWindow[]>([])
  const [bookingConstraints, setBookingConstraints] = useState<BookingConstraint[]>([])
  const [smartDiscountType,  setSmartDiscountType]  = useState<'fixed' | 'percent'>('fixed')
  const [smartDiscountValue, setSmartDiscountValue] = useState(0)
  const [fetchingSmarts,     setFetchingSmarts]     = useState(false)

  // Debounce address changes (800 ms) to avoid spamming the API
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAddress(address), 800)
    return () => clearTimeout(t)
  }, [address])

  // Vérification de zone dès que l'adresse change (sans attendre la date)
  useEffect(() => {
    if (debouncedAddress.trim().length <= 5) {
      setZoneAllowed(true)
      setZoneMessage(null)
      return
    }
    fetch(`/api/zone/check?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}`)
      .then(r => r.json())
      .then((data: { allowed: boolean; distance_km?: number; radius_km?: number; department?: string; department_name?: string }) => {
        setZoneAllowed(data.allowed)
        if (!data.allowed) {
          setZoneMessage("Adresse hors zone d'intervention")
        } else {
          setZoneMessage(null)
        }
      })
      .catch(() => { setZoneAllowed(true); setZoneMessage(null) })
  }, [debouncedAddress, washerId])

  useEffect(() => {
    if (!selectedDate || debouncedAddress.trim().length <= 5) {
      setSmartWindows([])
      setBookingConstraints([])
      return
    }
    // Utiliser la date locale (pas UTC) pour éviter le décalage horaire
    const pad = (n: number) => String(n).padStart(2, '0')
    const dateStr = `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth() + 1)}-${pad(selectedDate.getDate())}`
    setFetchingSmarts(true)
    fetch(`/api/slots/smart?washer_id=${washerId}&address=${encodeURIComponent(debouncedAddress.trim())}&date=${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setSmartWindows(data.smartWindows ?? [])
        setBookingConstraints(data.bookingConstraints ?? [])
        setSmartDiscountType(data.discountType ?? 'fixed')
        setSmartDiscountValue(data.discountValue ?? 0)
      })
      .catch(() => { setSmartWindows([]); setBookingConstraints([]) })
      .finally(() => setFetchingSmarts(false))
  }, [selectedDate, debouncedAddress, washerId])

  const days = getNextDays(14)
  const availableDaysOfWeek = availabilities.map(a => a.day_of_week)

  function getEffectiveTeamSize(date: Date): number {
    const s = toDateStr(date)
    const u = unavailabilities.find(u => u.start_date <= s && s <= u.end_date)
    if (!u) return teamSize
    return Math.max(0, teamSize - (u.team_members_off ?? 1))
  }

  function isDateUnavailable(date: Date): boolean {
    return getEffectiveTeamSize(date) === 0
  }

  const effectiveTeamSize = selectedDate ? getEffectiveTeamSize(selectedDate) : teamSize

  const slotsForDay = selectedDate
    ? availabilities
        .filter(a => a.day_of_week === selectedDate.getDay())
        .flatMap(a => generateSlots(a.start_time, a.end_time, serviceDuration))
        .filter(slot => countOverlaps(slot, selectedDate, serviceDuration, existingBookings) < effectiveTeamSize)
        .filter(slot => isSlotFeasible(slot, selectedDate))
    : []

  // Vérifier si un créneau local tombe dans une fenêtre UTC — timezone-safe
  function isSmartSlot(slotTime: string, date: Date): boolean {
    const [h, m] = slotTime.split(':').map(Number)
    const slotDate = new Date(date)
    slotDate.setHours(h, m, 0, 0)
    const ms = slotDate.getTime()
    return smartWindows.some(w => ms >= new Date(w.start).getTime() && ms <= new Date(w.end).getTime())
  }

  // Filtrer les créneaux physiquement impossibles (temps de trajet insuffisant entre clients)
  function isSlotFeasible(slotTime: string, date: Date): boolean {
    if (bookingConstraints.length === 0) return true
    const [h, m] = slotTime.split(':').map(Number)
    const slotDate = new Date(date)
    slotDate.setHours(h, m, 0, 0)
    const slotStart = slotDate.getTime()
    const slotEnd   = slotStart + serviceDuration * 60_000
    return bookingConstraints.every(c => {
      const bStart = new Date(c.start).getTime()
      const bEnd   = new Date(c.end).getTime()
      if (bEnd <= slotStart)  return bEnd + c.travelToNew * 1000 <= slotStart  // RDV avant → trajet vers nouveau client
      if (bStart >= slotEnd)  return slotEnd + c.travelFromNew * 1000 <= bStart // RDV après → trajet depuis nouveau client
      return false // chevauchement
    })
  }

  const smartSlotsInDay = selectedDate ? slotsForDay.filter(s => isSmartSlot(s, selectedDate)) : []
  const regularSlots    = selectedDate ? slotsForDay.filter(s => !isSmartSlot(s, selectedDate)) : slotsForDay

  const smartPrice = smartDiscountType === 'percent'
    ? Math.max(0, servicePrice * (1 - smartDiscountValue / 100))
    : Math.max(0, servicePrice - smartDiscountValue)
  const smartPriceStr = Number.isInteger(smartPrice) ? String(smartPrice) : smartPrice.toFixed(2)

  const canContinue = selectedDate && selectedTime && address.trim().length > 5 && zoneAllowed

  function handleNext() {
    if (!selectedDate || !selectedTime || !address) return
    const [h, m] = selectedTime.split(':').map(Number)
    const dt = new Date(selectedDate)
    dt.setHours(h, m, 0, 0)
    const isSmart = isSmartSlot(selectedTime, dt)
    const discount = isSmart
      ? (smartDiscountType === 'percent' ? servicePrice * smartDiscountValue / 100 : smartDiscountValue)
      : 0
    onNext({ scheduled_at: dt.toISOString(), address, is_smart_slot: isSmart, smart_discount: discount })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Choisissez un créneau</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Où et quand souhaitez-vous être lavé ?</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Adresse du véhicule</label>
        <AddressAutocomplete
          value={address}
          onChange={setAddress}
          placeholder="12 rue de la Paix, 75001 Paris"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-shadow"
          style={{ '--tw-ring-color': accent } as React.CSSProperties}
        />
      </div>

      {zoneMessage && (
        <div className="mb-4 flex items-start gap-2 px-3 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>{zoneMessage}</span>
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Sélectionnez un jour</p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {days.map(day => {
            const isAvailable   = availableDaysOfWeek.includes(day.getDay()) && !isDateUnavailable(day)
            const isUnavailable = isDateUnavailable(day)
            const isSelected    = selectedDate?.toDateString() === day.toDateString()
            return (
              <button
                key={day.toISOString()}
                onClick={() => { if (isAvailable) { setSelectedDate(day); setSelectedTime(null) } }}
                disabled={!isAvailable}
                className={`flex-shrink-0 flex flex-col items-center py-2.5 px-3 rounded-xl border-2 text-xs transition-all min-w-[52px] ${
                  isSelected    ? 'text-white shadow-md' :
                  isUnavailable ? 'border-orange-100 dark:border-orange-900/30 text-orange-300 dark:text-orange-700 cursor-not-allowed bg-orange-50/50 dark:bg-orange-950/10' :
                  isAvailable   ? 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800' :
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
          <div className="flex items-center gap-2 mb-2.5">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Heure</p>
            {fetchingSmarts && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 animate-pulse">Recherche des créneaux optimisés...</span>
            )}
          </div>

          {slotsForDay.length === 0 ? (
            <div className="flex items-center gap-2 py-3 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              <p className="text-sm text-slate-400 dark:text-slate-500">Aucun créneau disponible ce jour</p>
            </div>
          ) : (
            <>
              {/* Smart slots — shown first */}
              {smartSlotsInDay.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">★ Créneaux optimisés pour votre tournée</span>
                    {smartDiscountValue > 0 && (
                      <span className="text-[10px] bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                        -{smartDiscountType === 'percent' ? `${smartDiscountValue}%` : `${smartDiscountValue}€`}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {smartSlotsInDay.map(slot => {
                      const isSelected = selectedTime === slot
                      return (
                        <button
                          key={slot}
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2 rounded-xl border-2 font-semibold transition-all flex flex-col items-center gap-0.5 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                              : 'border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-white dark:bg-amber-950/30 hover:border-amber-400'
                          }`}
                        >
                          <span className="text-sm">{slot}</span>
                          {servicePrice > 0 && smartDiscountValue > 0 && (
                            <span className={`text-[10px] font-bold ${isSelected ? 'opacity-90' : 'text-amber-600 dark:text-amber-400'}`}>
                              {smartPriceStr}€
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Regular slots */}
              {regularSlots.length > 0 && (
                <div>
                  {smartSlotsInDay.length > 0 && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Autres créneaux disponibles</p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {regularSlots.map(slot => (
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
                </div>
              )}
            </>
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
