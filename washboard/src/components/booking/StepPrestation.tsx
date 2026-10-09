'use client'

import { useState } from 'react'
import type { Service, ServiceCategory, VehicleItem } from '@/types'
import type { FormState } from './BookingForm'
import { vehiclePrice, formatPrice, formatDureeFr, prixOptions } from '@/lib/pricing'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'

export default function StepPrestation({ services, categories, form, onChange }: {
  services: Service[]
  categories: ServiceCategory[]
  form: FormState
  onChange: (data: FormState) => void
}) {
  const [category, setCategory] = useState<string | null>(services[0]?.category_id ?? null)
  const catalogue = services.filter(s => s.category_id === category)
  const types = [...new Set(catalogue.flatMap(s => s.vehicle_types))]
  const service = services.find(s => s.id === form.service_id)
  const label = (type: string) => categories.find(c => c.id === category)?.types.find(t => t.id === type)?.name ?? VEHICLE_LABELS[type] ?? type
  const vehicles = form.vehicles_detail?.length ? form.vehicles_detail : types[0] ? [{ type: types[0], count: 1, unit_price: 0, label: label(types[0]), addons: [] }] : []
  const activeTypes = [...new Set(vehicles.map(v => v.type))]
  const [mixed, setMixed] = useState(activeTypes.length > 1)
  const visible = catalogue.filter(s => activeTypes.every(t => s.vehicle_types.includes(t)))

  function change(nextVehicles: VehicleItem[], nextService = service) {
    const compatible = nextService && nextVehicles.every(v => nextService.vehicle_types.includes(v.type)) ? nextService : undefined
    const details = nextVehicles.map(v => ({ ...v, label: label(v.type), unit_price: compatible ? vehiclePrice(compatible, v.type) : 0,
      addons: compatible ? (v.addons ?? []).filter(a => compatible.addons.some(x => x.id === a.id)) : [],
    }))
    onChange({ service_id: compatible?.id ?? '', vehicle_type: details[0]?.type ?? '', vehicle_count: details.length,
      vehicles_detail: details, selected_addons: details.flatMap(v => v.addons ?? []),
      booked_price: details.reduce((sum, v) => sum + v.unit_price, 0) + prixOptions(details, null),
    })
  }

  function count(type: string, amount: number) {
    if (amount < 0 || amount > 99) return
    const existing = vehicles.filter(v => v.type === type)
    const next = [...vehicles.filter(v => v.type !== type), ...Array.from({ length: amount }, (_, i) => existing[i] ?? { type, count: 1, unit_price: 0, addons: [] })]
    if (next.length && next.length <= 99) change(next)
  }

  return <div>
    <h2 className="wb-booking-title">Que faut-il laver ?</h2>
    {new Set(services.map(s => s.category_id)).size > 1 && <div className="wb-booking-chips mb-4" aria-label="Catégorie">
      {[...new Set(services.map(s => s.category_id))].map(id => <button key={id ?? 'other'} type="button" aria-pressed={category === id}
        onClick={() => { setCategory(id); setMixed(false); onChange({ service_id: '', vehicles_detail: [], selected_addons: [], booked_price: 0 }) }}>
        {categories.find(c => c.id === id)?.name ?? 'Autres'}
      </button>)}
    </div>}
    <div className="wb-booking-chips" aria-label="Type de véhicule">
      {types.map(type => <button key={type} type="button" aria-pressed={activeTypes.includes(type)} onClick={() => {
        if (mixed) count(type, vehicles.filter(v => v.type === type).length ? 0 : 1)
        else if (activeTypes.length !== 1 || activeTypes[0] !== type) change([{ type, count: 1, unit_price: 0, addons: [] }])
      }}>{label(type)}</button>)}
    </div>
    {activeTypes.map(type => <div key={type} className="flex items-center justify-between gap-3 my-3">
      <span className="text-sm font-medium">{mixed ? label(type) : 'Nombre de véhicules'}</span>
      <div className="wb-booking-counter">
        <button type="button" aria-label={`Retirer un véhicule (${type})`} disabled={vehicles.length <= 1} onClick={() => count(type, vehicles.filter(v => v.type === type).length - 1)}>−</button>
        <span aria-live="polite">{vehicles.filter(v => v.type === type).length}</span>
        <button type="button" aria-label={`Ajouter un véhicule (${type})`} disabled={vehicles.length >= 99} onClick={() => count(type, vehicles.filter(v => v.type === type).length + 1)}>+</button>
      </div>
    </div>)}
    {vehicles.length > 1 && !mixed && types.length > 1 && <button type="button" className="text-xs underline mb-3" onClick={() => setMixed(true)}>Mes véhicules sont de types différents</button>}
    <div className="flex items-baseline justify-between gap-3 mt-6 mb-2">
      <h3 className="font-semibold">La prestation</h3>
      <span className="text-xs text-zinc-500">Prix pour {vehicles.length} {activeTypes.length === 1 ? label(activeTypes[0]).toLowerCase() : 'véhicules'}</span>
    </div>
    <div className="divide-y divide-zinc-200/70 dark:divide-zinc-700">
      {visible.map(s => <div key={s.id} className="py-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="radio" name="booking-service" className="wb-booking-radio" checked={service?.id === s.id}
            onChange={() => change(vehicles.map(v => ({ ...v, addons: [] })), s)} />
          <span className="flex-1 min-w-0">
            <span className="flex justify-between gap-3 font-semibold text-sm"><span>{s.name}</span><span className="whitespace-nowrap">{formatPrice(vehicles.reduce((sum, v) => sum + vehiclePrice(s, v.type), 0))}</span></span>
            {s.description && <span className="block text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-snug">{s.description}</span>}
            <span className="block text-xs text-zinc-500 mt-2">Environ {formatDureeFr(s.duration_minutes * vehicles.length)} sur place</span>
          </span>
        </label>
        {service?.id === s.id && s.addons.length > 0 && <div className="ml-8 mt-5">
          <p className="text-xs text-zinc-500 mb-2">En plus, si besoin</p>
          {vehicles.map((v, i) => <div key={`${v.type}-${i}`}>
            {vehicles.length > 1 && <p className="text-xs font-semibold mt-3 mb-1">{label(v.type)} {i + 1}</p>}
            {s.addons.map(addon => <label key={addon.id} className="flex items-center gap-2.5 min-h-11 text-sm cursor-pointer">
              <input type="checkbox" className="wb-booking-checkbox" checked={(v.addons ?? []).some(a => a.id === addon.id)} onChange={() => change(vehicles.map((item, index) => index !== i ? item : { ...item,
                addons: (item.addons ?? []).some(a => a.id === addon.id) ? item.addons?.filter(a => a.id !== addon.id) : [...(item.addons ?? []), addon],
              }))} />
              <span className="flex-1">{addon.label}</span><span className="whitespace-nowrap">+{formatPrice(addon.price)}</span>
            </label>)}
          </div>)}
        </div>}
      </div>)}
    </div>
    {!visible.length && <p className="text-sm text-zinc-500 py-4">Aucune prestation pour cette sélection. Choisissez un autre type de véhicule.</p>}
  </div>
}
