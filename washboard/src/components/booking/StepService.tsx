'use client'

import { useState } from 'react'
import type { Service } from '@/types'

type Props = {
  services: Service[]
  selected: { service_id?: string; vehicle_type?: string }
  onNext: (data: { service_id: string; vehicle_type: string }) => void
}

const VEHICLE_LABELS: Record<string, string> = {
  citadine: 'Citadine',
  berline: 'Berline',
  SUV: 'SUV / 4x4',
}

export default function StepService({ services, selected, onNext }: Props) {
  const [serviceId, setServiceId] = useState(selected.service_id ?? '')
  const [vehicleType, setVehicleType] = useState(selected.vehicle_type ?? '')

  const selectedService = services.find(s => s.id === serviceId)
  const canContinue = serviceId && vehicleType

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Choisissez votre prestation</h2>

      <div className="space-y-3 mb-6">
        {services.map(service => (
          <button
            key={service.id}
            onClick={() => { setServiceId(service.id); setVehicleType('') }}
            className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
              serviceId === service.id
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{service.duration_minutes} min</p>
              </div>
              <span className="text-lg font-bold text-blue-600">{service.price}€</span>
            </div>
          </button>
        ))}
      </div>

      {selectedService && (
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Type de véhicule</p>
          <div className="grid grid-cols-3 gap-2">
            {selectedService.vehicle_types.map(type => (
              <button
                key={type}
                onClick={() => setVehicleType(type)}
                className={`py-2 px-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  vehicleType === type
                    ? 'border-blue-600 bg-blue-50 text-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {VEHICLE_LABELS[type] ?? type}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => canContinue && onNext({ service_id: serviceId, vehicle_type: vehicleType })}
        disabled={!canContinue}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
      >
        Continuer
      </button>
    </div>
  )
}
