'use client'

import { useState } from 'react'
import { Droplets, Sparkles, Gem, Crown, Clock, Check } from 'lucide-react'
import type { Service, VehicleItem } from '@/types'

const SERVICE_ICONS = [Droplets, Sparkles, Gem, Crown]

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
  const [isPro,        setIsPro]        = useState(false)
  const [serviceId,    setServiceId]    = useState(selected.service_id ?? '')
  const [vehicleType,  setVehicleType]  = useState(selected.vehicle_type ?? '')
  const [vehicleCount, setVehicleCount] = useState(1)
  const [proVehicles,  setProVehicles]  = useState<Record<string, number>>({})

  const selectedService = services.find(s => s.id === serviceId)

  const unitPrice  = selectedService && vehicleType ? vehiclePrice(selectedService, vehicleType) : 0
  const totalPrice = unitPrice * vehicleCount

  const proTotal = selectedService
    ? Object.entries(proVehicles).reduce((sum, [type, count]) => sum + vehiclePrice(selectedService, type) * count, 0)
    : 0
  const proCount       = Object.values(proVehicles).reduce((sum, c) => sum + c, 0)
  const proHasVehicles = proCount > 0

  const canContinue = serviceId && (isPro ? proHasVehicles : (vehicleType && vehicleCount >= 1))

  function setProVehicleCount(type: string, count: number) {
    setProVehicles(prev => {
      if (count <= 0) {
        const next = { ...prev }
        delete next[type]
        return next
      }
      return { ...prev, [type]: Math.min(99, count) }
    })
  }

  function handleCountChange(val: string) {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 1 && n <= 99) setVehicleCount(n)
  }

  function handleNext() {
    if (!canContinue || !selectedService) return
    if (isPro) {
      const vehicles_detail: VehicleItem[] = Object.entries(proVehicles)
        .filter(([, c]) => c > 0)
        .map(([type, count]) => ({ type, count, unit_price: vehiclePrice(selectedService, type) }))
      onNext({
        service_id:      serviceId,
        vehicle_type:    vehicles_detail[0].type,
        vehicle_count:   proCount,
        booked_price:    proTotal,
        is_professional: true,
        vehicles_detail,
      })
    } else {
      onNext({
        service_id:      serviceId,
        vehicle_type:    vehicleType,
        vehicle_count:   vehicleCount,
        booked_price:    totalPrice,
        is_professional: false,
      })
    }
  }

  return (
    <div>
      {/* Toggle Particulier / Professionnel */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-5">
        <button
          onClick={() => { setIsPro(false); setProVehicles({}) }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            !isPro
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>👤</span> Particulier
        </button>
        <button
          onClick={() => { setIsPro(true); setVehicleType(''); setVehicleCount(1); setProVehicles({}) }}
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
        {services.map((service, idx) => {
          const isSelected = serviceId === service.id
          const Icon = SERVICE_ICONS[idx % SERVICE_ICONS.length]
          return (
            <button
              key={service.id}
              onClick={() => { setServiceId(service.id); setVehicleType(''); setProVehicles({}) }}
              className="w-full text-left px-4 py-4 rounded-2xl border-2 transition-all"
              style={isSelected
                ? { borderColor: accent, backgroundColor: hex(accent, 0.06) }
                : { borderColor: '#e2e8f0', backgroundColor: 'transparent' }
              }
            >
              <div className="flex items-start gap-3">
                {/* Icône */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                  style={{ backgroundColor: isSelected ? hex(accent, 0.15) : '#f1f5f9' }}
                >
                  <Icon size={18} style={{ color: isSelected ? accent : '#64748b' }} strokeWidth={1.8} />
                </div>

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

      {selectedService && (
        <>
          {isPro ? (
            /* PRO mode: basket with per-type counters */
            <div className="mb-6">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Sélectionnez vos véhicules</p>
              <div className="space-y-2">
                {selectedService.vehicle_types.map(type => {
                  const info  = VEHICLE_LABELS[type] ?? { label: type, icon: '🚘' }
                  const price = vehiclePrice(selectedService, type)
                  const count = proVehicles[type] ?? 0
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
                          onClick={() => setProVehicleCount(type, count - 1)}
                          disabled={count === 0}
                          className="w-8 h-8 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                        >−</button>
                        <span className="w-6 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">{count}</span>
                        <button
                          onClick={() => setProVehicleCount(type, count + 1)}
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

              {proHasVehicles && (
                <div className="mt-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                  {Object.entries(proVehicles).map(([type, count]) => {
                    const info  = VEHICLE_LABELS[type] ?? { label: type, icon: '🚘' }
                    const price = vehiclePrice(selectedService, type)
                    return (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{info.icon} {info.label} × {count}</span>
                        <span className="text-slate-700 dark:text-slate-300">{price * count}€</span>
                      </div>
                    )
                  })}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-0.5 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                    <span>Total ({proCount} véhicule{proCount > 1 ? 's' : ''})</span>
                    <span>{proTotal}€</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Non-PRO mode: single vehicle type + optional quantity */
            <>
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Type de véhicule</p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedService.vehicle_types.map(type => {
                    const info  = VEHICLE_LABELS[type] ?? { label: type, icon: '🚘' }
                    const isSel = vehicleType === type
                    const price = vehiclePrice(selectedService, type)
                    return (
                      <button
                        key={type}
                        onClick={() => setVehicleType(type)}
                        className="py-3 px-2 rounded-xl border-2 text-xs font-medium transition-all flex flex-col items-center gap-1.5 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                        style={isSel ? { borderColor: accent, backgroundColor: hex(accent, 0.06), color: accent } : undefined}
                      >
                        {info.img ? (
                          <img src={info.img} alt={info.label} className={`w-14 h-14 object-contain transition-opacity ${isSel ? 'opacity-100' : 'opacity-50'}`} />
                        ) : (
                          <span className="text-xl">{info.icon}</span>
                        )}
                        <span>{info.label}</span>
                        {hasOverrides(selectedService) && (
                          <span className="font-semibold" style={isSel ? { color: accent } : undefined}>{price}€</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {vehicleType && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2.5">Quantité</p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setVehicleCount(c => Math.max(1, c - 1))}
                      className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-lg font-bold flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-30"
                      disabled={vehicleCount <= 1}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={vehicleCount}
                      onChange={e => handleCountChange(e.target.value)}
                      className="w-16 text-center border border-slate-300 dark:border-slate-600 rounded-xl py-2 text-sm font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2"
                      style={{ '--tw-ring-color': accent } as React.CSSProperties}
                    />
                    <button
                      onClick={() => setVehicleCount(c => Math.min(99, c + 1))}
                      className="w-10 h-10 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-lg font-bold flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >+</button>
                    {vehicleCount > 1 && (
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{unitPrice}€ × {vehicleCount} = </span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{totalPrice}€</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
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
