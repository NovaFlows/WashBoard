'use client'

import { useState } from 'react'
import type { Washer, Service, Availability, BookingFormData } from '@/types'
import StepService from './StepService'
import StepSlot from './StepSlot'
import StepContact from './StepContact'
import StepConfirmation from './StepConfirmation'

type Props = {
  washer: Washer
  services: Service[]
  availabilities: Availability[]
  accent?: string
}

export type FormState = Partial<BookingFormData>

const STEPS = ['Prestation', 'Créneau', 'Coordonnées']

export default function BookingForm({ washer, services, availabilities, accent = '#2563eb' }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormState>({})
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function updateForm(data: Partial<BookingFormData>) {
    setForm(prev => ({ ...prev, ...data }))
  }

  async function submitBooking(contactData: Pick<BookingFormData, 'client_name' | 'client_email' | 'client_phone'>) {
    setLoading(true)
    setError(null)
    const payload = { ...form, ...contactData, washer_id: washer.id }
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la réservation')
      setBookingId(json.data.id)
      setStep(4)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {step < 4 && (
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => {
              const n = i + 1
              const done = step > n
              const active = step === n
              return (
                <div key={n} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
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
                    <span className={`text-xs font-medium ${
                      active ? 'text-slate-900 dark:text-slate-100' :
                      done ? 'text-emerald-600 dark:text-emerald-400' :
                      'text-slate-400 dark:text-slate-500'
                    }`}>{label}</span>
                  </div>
                  {n < 3 && (
                    <div className={`h-px w-6 transition-colors ${done ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'}`} />
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
            onNext={(data) => { updateForm(data); setStep(2) }}
            accent={accent}
          />
        )}
        {step === 2 && (
          <StepSlot
            availabilities={availabilities}
            onNext={(data) => { updateForm(data); setStep(3) }}
            onBack={() => setStep(1)}
            accent={accent}
          />
        )}
        {step === 3 && (
          <StepContact
            loading={loading}
            error={error}
            onSubmit={submitBooking}
            onBack={() => setStep(2)}
            accent={accent}
          />
        )}
        {step === 4 && (
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
