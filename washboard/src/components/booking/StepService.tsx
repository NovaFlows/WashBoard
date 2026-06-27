'use client'

import { useState } from 'react'
import { Clock, Check } from 'lucide-react'
import type { Service, VehicleItem } from '@/types'

type Props = {
  services: Service[]
  selected: { service_id?: string; vehicle_type?: string }
  onNext: (data: { service_id: string; vehicle_type: string; vehicle_count: number; booked_price: number; is_professional: boolean; vehicles_detail?: VehicleItem[] }) => void
  accent?: string
}

const VEHICLE_LABELS: Record<string, { label: string; icon: string; img?: string }> = {
  citadine_2p: { label: 'Citadine 2p',     icon: '', img: '/vehicles/citadine_2p.png' },
  citadine:    { label: 'Citadine',         icon: '', img: '/vehicles/citadine.png' },
  berline:     { label: 'Berline',          icon: '', img: '/vehicles/berline.png' },
  SUV:         { label: 'SUV / 4x4',        icon: '', img: '/vehicles/suv.png' },
  monospace:   { label: 'Monospace',        icon: '', img: '/vehicles/monospace.png' },
  '7places':   { label: '7 places',         icon: '', img: '/vehicles/monospace.png' },
  utilitaire:  { label: 'Van / Utilitaire', icon: '', img: '/vehicles/utilitaire.png' },
  velo:        { label: 'Vélo',             icon: '', img: '/vehicles/bike.svg' },
}

function hex(color: string, opacity: number) {
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0')
}

function vehiclePrice(service: Service, vehicleType: string): number {
  return service.vehicle_price_overrides?.[vehicleType] ?? service.price
}

function minPrice(service: Service): number {
  const prices = [service.price, ...Object.values(service.vehicle_price_overrides ?? {})]
  return Math.min(...prices)
}

function hasOverrides(service: Service): boolean {
  const overrides = Object.values(service.vehicle_price_overrides ?? {})
  return overrides.length > 0 && overrides.some(p => p !== service.price)
}

export default function StepService({ services, selected, onNext, accent = '#2563eb' }: Props) {
  const [isPro,     setIsPro]     = useState(false)
  const [serviceId, setServiceId] = useState(selected.service_id ?? '')
  // Panier : un compteur par type de véhicule (permet de mélanger les types)
  const [basket,    setBasket]    = useState<Record<string, number>>({})

  const selectedService = services.find(s => s.id === serviceId)

  const basketCount = Object.values(basket).reduce((sum, c) => sum + c, 0)
  const basketTotal = selectedService
    ? Object.entries(basket).reduce((sum, [type, count]) => sum + vehiclePrice(selectedService, type) * count, 0)
    : 0

  const canContinue = !!serviceId && basketCount > 0

  function setVehicleCount(type: string, count: number) {
    setBasket(prev => {
      if (count <= 0) {
        const next = { ...prev }
        delete next[type]
        return next
      }
      return { ...prev, [type]: Math.min(99, count) }
    })
  }

  function handleNext() {
    if (!canContinue || !selectedService) return
    const vehicles_detail: VehicleItem[] = Object.entries(basket)
      .filter(([, c]) => c > 0)
      .map(([type, count]) => ({ type, count, unit_price: vehiclePrice(selectedService, type) }))
    onNext({
      service_id:      serviceId,
      vehicle_type:    vehicles_detail[0].type,
      vehicle_count:   basketCount,
      booked_price:    basketTotal,
      is_professional: isPro,
      vehicles_detail,
    })
  }

  return (
    <div>
      {/* Toggle Particulier / Professionnel */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5">
        <button
          onClick={() => { setIsPro(false) }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            !isPro
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>👤</span> Particulier
        </button>
        <button
          onClick={() => { setIsPro(true) }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            isPro
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>🏢</span> Professionnel
        </button>
      </div>

      {isPro && (
        <div className="mb-5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
          Une facture avec vos informations société vous sera envoyée à la confirmation.
        </div>
      )}

      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Choisissez votre prestation</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sélectionnez le type de lavage souhaité</p>

      <div className="flex flex-col gap-3 mb-6">
        {services.map((service) => {
          const isSelected = serviceId === service.id
          return (
            <button
              key={service.id}
              onClick={() => { setServiceId(service.id); setBasket({}) }}
              className="w-full text-left px-4 py-4 rounded-2xl border-2 transition-all"
              style={isSelected
                ? { borderColor: accent, backgroundColor: hex(accent, 0.06) }
                : { borderColor: '#e2e8f0', backgroundColor: 'transparent' }
              }
            >
              <div className="flex items-start gap-3">
                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100" style={isSelected ? { color: accent } : undefined}>
                      {service.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock size={11} className="text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-400">{service.duration_minutes} min</span>
                  </div>
                  {service.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{service.description}</p>
                  )}
                </div>

                {/* Prix + radio */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    {hasOverrides(service) && (
                      <p className="text-xs text-slate-400 leading-none mb-0.5">à partir de</p>
                    )}
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100" style={isSelected ? { color: accent } : undefined}>
                      {hasOverrides(service) ? minPrice(service) : service.price}€
                    </span>
                  </div>
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
                    style={isSelected ? { borderColor: accent, backgroundColor: accent } : { borderColor: '#cbd5e1' }}
                  >
                    {isSelected && <Check size={11} color="white" strokeWidth={3} />}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Sélection des véhicules — panier multi-types (1 SUV + 1 monospace, etc.) */}
      {selectedService && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vos véhicules</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2.5">Ajoutez un ou plusieurs véhicules, de types différents si besoin.</p>
          <div className="space-y-2">
            {selectedService.vehicle_types.map(type => {
              const info  = VEHICLE_LABELS[type] ?? { label: type, icon: '🚘' }
              const price = vehiclePrice(selectedService, type)
              const count = basket[type] ?? 0
              return (
                <div
                  key={type}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all"
                  style={count > 0
                    ? { borderColor: accent, backgroundColor: hex(accent, 0.04) }
                    : { borderColor: '#e2e8f0' }
                  }
                >
                  {info.img ? (
                    <img src={info.img} alt={info.label} className="w-12 h-12 object-contain shrink-0 opacity-80" />
                  ) : (
                    <span className="text-xl w-7 text-center shrink-0">{info.icon}</span>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{info.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{price}€/véhicule</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setVehicleCount(type, count - 1)}
                      disabled={count === 0}
                      className="w-8 h-8 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                    >−</button>
                    <span className="w-6 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">{count}</span>
                    <button
                      onClick={() => setVehicleCount(type, count + 1)}
                      className="w-8 h-8 rounded-lg border-2 font-bold flex items-center justify-center transition-colors"
                      style={count > 0
                        ? { borderColor: accent, color: accent }
                        : { borderColor: '#e2e8f0', color: '#64748b' }
                      }
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>

          {basketCount > 0 && (
            <div className="mt-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
              {Object.entries(basket).map(([type, count]) => {
                const info  = VEHICLE_LABELS[type] ?? { label: type, icon: '🚘' }
                const price = vehiclePrice(selectedService, type)
                return (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{info.label} × {count}</span>
                    <span className="text-slate-700 dark:text-slate-300">{price * count}€</span>
                  </div>
                )
              })}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-0.5 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                <span>Total ({basketCount} véhicule{basketCount > 1 ? 's' : ''})</span>
                <span>{basketTotal}€</span>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleNext}
        disabled={!canContinue}
        className="w-full py-3 px-4 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90 text-sm"
        style={{ backgroundColor: accent }}
      >
        Continuer
      </button>
    </div>
  )
}
