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
}

export type FormState = Partial<BookingFormData>

export default function BookingForm({ washer, services, availabilities }: Props) {
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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Indicateur d'étapes */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step > n ? 'bg-green-500 text-white' :
              step === n ? 'bg-blue-600 text-white' :
              'bg-gray-100 text-gray-400'
            }`}>
              {step > n ? '✓' : n}
            </div>
            {n < 3 && (
              <div className={`h-px w-16 mx-2 transition-colors ${step > n ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Étapes */}
      {step === 1 && (
        <StepService
          services={services}
          selected={{ service_id: form.service_id, vehicle_type: form.vehicle_type }}
          onNext={(data) => { updateForm(data); setStep(2) }}
        />
      )}

      {step === 2 && (
        <StepSlot
          availabilities={availabilities}
          onNext={(data) => { updateForm(data); setStep(3) }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <StepContact
          loading={loading}
          error={error}
          onSubmit={submitBooking}
          onBack={() => setStep(2)}
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
  )
}
