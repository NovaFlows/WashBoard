'use client'

import { useState } from 'react'
import type { Washer, Service, Availability, BookingFormData } from '@/types'
import StepService from './StepService'
import StepOptions from './StepOptions'
import StepSlot from './StepSlot'
import StepContact from './StepContact'
import StepConfirmation from './StepConfirmation'

type ExistingBooking = { scheduled_at: string; vehicle_count: number | null; services: { duration_minutes: number } | null }
type Unavailability  = { id: string; start_date: string; end_date: string }

type Props = {
  washer: Washer
  services: Service[]
  availabilities: Availability[]
  existingBookings: ExistingBooking[]
  unavailabilities: Unavailability[]
  accent?: string
}

export type FormState = Partial<BookingFormData>

// step 1 = Prestation, 2 = Options (si dispo), 3 = Créneau, 4 = Coordonnées, 5 = Confirmation
export default function BookingForm({ washer, services, availabilities, existingBookings, unavailabilities, accent = '#2563eb' }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>({})
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedService = services.find(s => s.id === form.service_id)
  const hasAddons = (selectedService?.addons ?? []).length > 0

  // Stepper : 4 étapes si options dispo, 3 sinon
  const STEPS = hasAddons
    ? ['Prestation', 'Options', 'Créneau', 'Coordonnées']
    : ['Prestation', 'Créneau', 'Coordonnées']

  // Mappe le step réel sur la position dans le stepper
  function stepperPos(s: number): number {
    if (hasAddons) return s
    if (s === 1) return 1
    if (s === 3) return 2
    if (s === 4) return 3
    return s
  }

  const sp = stepperPos(step)

  function updateForm(data: Partial<BookingFormData>) {
    setForm(prev => ({ ...prev, ...data }))
  }

  async function submitBooking(contactData: Pick<BookingFormData, 'client_name' | 'client_email' | 'client_phone'>) {
    setLoading(true)
    setError(null)
    const payload = {
      ...form,
      ...contactData,
      washer_id:      washer.id,
      is_smart_slot:  form.is_smart_slot ?? false,
      smart_discount: form.smart_discount ?? 0,
    }
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la réservation')
      setBookingId(json.data.id)
      setStep(5)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {step < 5 && (
        <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start w-full">
            {STEPS.map((label, i) => {
              const n = i + 1
              const done = sp > n
              const active = sp === n
              return (
                <div key={n} className={`flex items-start ${n < STEPS.length ? 'flex-1' : ''}`}>
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        done ? 'bg-emerald-500 text-white' :
                        active ? 'text-white' :
                        'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                      }`}
                      style={active ? { backgroundColor: accent } : undefined}
                    >
                      {done ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      ) : n}
                    </div>
                    <span className={`text-[11px] font-medium text-center leading-tight ${
                      active ? 'text-slate-900 dark:text-slate-100' :
                      done ? 'text-emerald-600 dark:text-emerald-400' :
                      'text-slate-400 dark:text-slate-500'
                    }`}>{label}</span>
                  </div>
                  {n < STEPS.length && (
                    <div className={`flex-1 h-px mt-3.5 mx-1 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="p-6">
        {step === 1 && (
          <StepService
            services={services}
            selected={{ service_id: form.service_id, vehicle_type: form.vehicle_type }}
            onNext={(data) => {
              updateForm(data)
              const svc = services.find(s => s.id === data.service_id)
              setStep((svc?.addons ?? []).length > 0 ? 2 : 3)
            }}
            accent={accent}
          />
        )}
        {step === 2 && selectedService && (
          <StepOptions
            service={selectedService}
            selectedAddons={form.selected_addons ?? []}
            basePrice={form.booked_price ?? selectedService.price}
            onNext={(data) => { updateForm(data); setStep(3) }}
            onBack={() => setStep(1)}
            accent={accent}
          />
        )}
        {step === 3 && (
          <StepSlot
            availabilities={availabilities}
            existingBookings={existingBookings}
            unavailabilities={unavailabilities}
            teamSize={washer.team_size ?? 1}
            serviceDuration={(services.find(s => s.id === form.service_id)?.duration_minutes ?? 60) * Math.max(1, form.vehicle_count ?? 1)}
            servicePrice={form.booked_price ?? services.find(s => s.id === form.service_id)?.price ?? 0}
            washerId={washer.id}
            hasTravelFee={(washer.travel_fee_tiers ?? []).length > 0 && !!washer.base_address}
            travelFeeMode={washer.travel_fee_mode ?? 'base'}
            onNext={(data) => { updateForm(data); setStep(4) }}
            onBack={() => setStep(hasAddons ? 2 : 1)}
            accent={accent}
          />
        )}
        {step === 4 && (
          <StepContact
            isProfessional={form.is_professional ?? false}
            loading={loading}
            error={error}
            onSubmit={submitBooking}
            onBack={() => setStep(3)}
            accent={accent}
          />
        )}
        {step === 5 && (
          <StepConfirmation
            washerName={washer.name}
            bookingId={bookingId!}
            form={form}
            services={services}
          />
        )}
      </div>
    </div>
  )
}
