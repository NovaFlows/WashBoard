'use client'

import { useMemo, useState } from 'react'
import { Clock, Check, User, Building2 } from 'lucide-react'
import type { Service, ServiceCategory, VehicleItem } from '@/types'
import { vehiclePrice, minVehiclePrice, hasPriceOverrides } from '@/lib/pricing'

type Props = {
  services: Service[]
  categories: ServiceCategory[]
  selected: { service_id?: string; vehicle_type?: string }
  onNext: (data: { service_id: string; vehicle_type: string; vehicle_count: number; booked_price: number; is_professional: boolean; vehicles_detail?: VehicleItem[] }) => void
  accent?: string
}

// Images pour les types « voiture » historiques (résolus par id de type).
const VEHICLE_IMAGES: Record<string, string> = {
  citadine_2p: '/vehicles/citadine_2p.png',
  citadine:    '/vehicles/citadine.png',
  berline:     '/vehicles/berline.png',
  SUV:         '/vehicles/suv.png',
  monospace:   '/vehicles/monospace.png',
  '7places':   '/vehicles/monospace.png',
  utilitaire:  '/vehicles/utilitaire.png',
  velo:        '/vehicles/bike.svg',
}

function hex(color: string, opacity: number) {
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0')
}

const UNCATEGORIZED = '__none__'

export default function StepService({ services, categories, selected, onNext, accent = '#2563eb' }: Props) {
  const [isPro,     setIsPro]     = useState(false)
  const [serviceId, setServiceId] = useState(selected.service_id ?? '')
  // Panier : un compteur par type (permet de mélanger les types)
  const [basket,    setBasket]    = useState<Record<string, number>>({})
  // Modèle (texte libre) par véhicule : un tableau par type, aligné sur le compteur
  const [models,    setModels]    = useState<Record<string, string[]>>({})

  // Onglets : seules les catégories qui ont au moins une prestation.
  const tabs = useMemo(() => {
    const list = categories
      .filter(c => services.some(s => s.category_id === c.id))
      .map(c => ({ id: c.id, name: c.name }))
    const hasUncategorized = services.some(s => !s.category_id || !categories.some(c => c.id === s.category_id))
    if (hasUncategorized) list.push({ id: UNCATEGORIZED, name: list.length > 0 ? 'Autres' : 'Prestations' })
    return list
  }, [categories, services])

  const [activeTab, setActiveTab] = useState(() => tabs[0]?.id ?? '')

  const visibleServices = useMemo(() => {
    if (!activeTab) return services
    if (activeTab === UNCATEGORIZED)
      return services.filter(s => !s.category_id || !categories.some(c => c.id === s.category_id))
    return services.filter(s => s.category_id === activeTab)
  }, [services, categories, activeTab])

  const selectedService = services.find(s => s.id === serviceId)

  // Résout le nom (et l'image éventuelle) d'un type pour la prestation sélectionnée.
  function typeInfo(service: Service, typeId: string): { name: string; img?: string } {
    const cat = categories.find(c => c.id === service.category_id)
    const t = cat?.types.find(tt => tt.id === typeId)
    return { name: t?.name ?? typeId, img: VEHICLE_IMAGES[typeId] }
  }

  const basketCount = Object.values(basket).reduce((sum, c) => sum + c, 0)
  const basketTotal = selectedService
    ? Object.entries(basket).reduce((sum, [type, count]) => sum + vehiclePrice(selectedService, type) * count, 0)
    : 0

  const canContinue = !!serviceId && basketCount > 0

  function selectTab(id: string) {
    setActiveTab(id)
    setServiceId('')
    setBasket({})
    setModels({})
  }

  function setVehicleCount(type: string, count: number) {
    const clamped = Math.min(99, Math.max(0, count))
    setBasket(prev => {
      if (clamped <= 0) { const next = { ...prev }; delete next[type]; return next }
      return { ...prev, [type]: clamped }
    })
    // Aligne le tableau des modèles sur le nouveau compteur
    setModels(prev => {
      if (clamped <= 0) { const next = { ...prev }; delete next[type]; return next }
      const arr = [...(prev[type] ?? [])]
      while (arr.length < clamped) arr.push('')
      arr.length = clamped
      return { ...prev, [type]: arr }
    })
  }

  function setModel(type: string, index: number, value: string) {
    setModels(prev => {
      const arr = [...(prev[type] ?? [])]
      arr[index] = value
      return { ...prev, [type]: arr }
    })
  }

  function handleNext() {
    if (!canContinue || !selectedService) return
    const vehicles_detail: VehicleItem[] = Object.entries(basket)
      .filter(([, c]) => c > 0)
      .map(([type, count]) => ({
        type,
        count,
        unit_price: vehiclePrice(selectedService, type),
        label: typeInfo(selectedService, type).name,
        models: (models[type] ?? []).slice(0, count).map(m => m.trim()),
      }))
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
      {/* Toggle Particulier / Professionnel (facturation) */}
      <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
        <button
          onClick={() => { setIsPro(false) }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            !isPro
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <User size={15} strokeWidth={2} /> Particulier
        </button>
        <button
          onClick={() => { setIsPro(true) }}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
            isPro
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Building2 size={15} strokeWidth={2} /> Professionnel
        </button>
      </div>

      {isPro && (
        <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
          Une facture avec vos informations société vous sera envoyée à la confirmation.
        </div>
      )}

      {/* Onglets de catégories — répartis sur toute la largeur */}
      {tabs.length > 1 && (
        <div className="flex w-full gap-2 mb-4">
          {tabs.map(t => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all truncate"
                style={active
                  ? { borderColor: accent, backgroundColor: hex(accent, 0.08), color: accent }
                  : { borderColor: '#e2e8f0', color: '#64748b' }
                }
              >
                {t.name}
              </button>
            )
          })}
        </div>
      )}

      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Choisissez votre prestation</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sélectionnez le type de lavage souhaité</p>

      <div className="flex flex-col gap-3 mb-6">
        {visibleServices.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Aucune prestation dans cette catégorie.</p>
        )}
        {visibleServices.map((service) => {
          const isSelected = serviceId === service.id
          return (
            <button
              key={service.id}
              onClick={() => { setServiceId(service.id); setBasket({}); setModels({}) }}
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
                    {hasPriceOverrides(service) && (
                      <p className="text-xs text-slate-400 leading-none mb-0.5">à partir de</p>
                    )}
                    <span className="text-lg font-bold text-slate-800 dark:text-slate-100" style={isSelected ? { color: accent } : undefined}>
                      {hasPriceOverrides(service) ? minVehiclePrice(service) : service.price}€
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

      {/* Sélection des types — panier multi-types (1 SUV + 1 monospace, etc.) */}
      {selectedService && (
        <div className="mb-6">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Votre sélection</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2.5">Ajoutez un ou plusieurs éléments, de types différents si besoin.</p>
          <div className="space-y-2">
            {selectedService.vehicle_types.map(type => {
              const info  = typeInfo(selectedService, type)
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
                  {info.img && (
                    <img src={info.img} alt={info.name} className="w-12 h-12 object-contain shrink-0 opacity-80" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{info.name}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{price}€/unité</p>
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
                const info  = typeInfo(selectedService, type)
                const price = vehiclePrice(selectedService, type)
                return (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{info.name} × {count}</span>
                    <span className="text-slate-700 dark:text-slate-300">{price * count}€</span>
                  </div>
                )
              })}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-0.5 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
                <span>Total ({basketCount} élément{basketCount > 1 ? 's' : ''})</span>
                <span>{basketTotal}€</span>
              </div>
            </div>
          )}

          {/* Modèle par véhicule (optionnel) */}
          {basketCount > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Modèle de vos véhicules <span className="text-slate-400 font-normal">(optionnel)</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2.5">Aide le laveur à identifier votre véhicule (ex. « Peugeot 208 grise »).</p>
              <div className="space-y-2">
                {Object.entries(basket).flatMap(([type, count]) =>
                  Array.from({ length: count }).map((_, i) => {
                    const info = typeInfo(selectedService, type)
                    return (
                      <div key={`${type}-${i}`} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400 w-28 shrink-0 truncate">
                          {info.name}{count > 1 ? ` #${i + 1}` : ''}
                        </span>
                        <input
                          value={models[type]?.[i] ?? ''}
                          onChange={e => setModel(type, i, e.target.value)}
                          placeholder="Modèle du véhicule"
                          className="flex-1 min-w-0 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-300"
                        />
                      </div>
                    )
                  }),
                )}
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
