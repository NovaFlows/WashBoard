'use client'

import { useState } from 'react'
import type { Service } from '@/types'

type Props = {
  services: Service[]
  selected: { service_id?: string; vehicle_type?: string }
  onNext: (data: { service_id: string; vehicle_type: string }) => void
}

const VEHICLE_LABELS: Record<string, { label: string; icon: string }> = {
  citadine: { label: 'Citadine', icon: '🚗' },
  berline:  { label: 'Berline',  icon: '🚙' },
  SUV:      { label: 'SUV / 4x4', icon: '🚐' },
}

export default function StepService({ services, selected, onNext }: Props) {
  const [serviceId, setServiceId] = useState(selected.service_id ?? '')
  const [vehicleType, setVehicleType] = useState(selected.vehicle_type ?? '')

  const selectedService = services.find(s => s.id === serviceId)
  const canContinue = serviceId && vehicleType

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Choisissez votre prestation</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Sélectionnez le type de lavage souhaité</p>

      <div className="space-y-2.5 mb-6">
        {services.map(service => {
          const isSelected = serviceId === service.id
          return (
            <button
              key={service.id}
              onClick={() => { setServiceId(service.id); setVehicleType('') }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-500'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/50'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-colors ${
                    isSelected ? 'bg-blue-100 dark:bg-blue-900/60' : 'bg-slate-100 dark:bg-slate-700'
                  }`}>
                    🧽
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {service.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{service.duration_minutes} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {service.price}€
                  </span>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {selectedService && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Type de véhicule</p>
          <div className="grid grid-cols-3 gap-2">
            {selectedService.vehicle_types.map(type => {
              const info = VEHICLE_LABELS[type] ?? { label: type, icon: '🚘' }
              const isSelected = vehicleType === type
              return (
                <button
                  key={type}
                  onClick={() => setVehicleType(type)}
                  className={`py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-500 text-blue-700 dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span className="text-xl">{info.icon}</span>
                  {info.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => canContinue && onNext({ service_id: serviceId, vehicle_type: vehicleType })}
        disabled={!canContinue}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
      >
        Continuer
      </button>
    </div>
  )
}
