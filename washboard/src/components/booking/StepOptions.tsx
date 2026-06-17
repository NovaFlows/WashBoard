'use client'

import { useState } from 'react'
import type { Service, ServiceAddon } from '@/types'

type Props = {
  service: Service
  selectedAddons: ServiceAddon[]
  basePrice: number
  travelFee?: number
  onNext: (data: { selected_addons: ServiceAddon[]; booked_price: number }) => void
  onBack: () => void
  accent?: string
}

function hex(color: string, opacity: number) {
  return color + Math.round(opacity * 255).toString(16).padStart(2, '0')
}

export default function StepOptions({ service, selectedAddons, basePrice, travelFee = 0, onNext, onBack, accent = '#2563eb' }: Props) {
  const [selected, setSelected] = useState<ServiceAddon[]>(selectedAddons)

  const categories = [...new Set(service.addons.map(a => a.category))]
  const addonsTotal = selected.reduce((sum, a) => sum + a.price, 0)
  const total = basePrice + addonsTotal

  function toggle(addon: ServiceAddon) {
    setSelected(prev =>
      prev.some(a => a.id === addon.id)
        ? prev.filter(a => a.id !== addon.id)
        : [...prev, addon]
    )
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Options & suppléments</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Personnalisez votre prestation</p>

      {categories.map(category => (
        <div key={category} className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">{category}</p>
          <div className="space-y-2">
            {service.addons.filter(a => a.category === category).map(addon => {
              const isSel = selected.some(a => a.id === addon.id)
              return (
                <button
                  key={addon.id}
                  onClick={() => toggle(addon)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left"
                  style={isSel
                    ? { borderColor: accent, backgroundColor: hex(accent, 0.06) }
                    : { borderColor: 'transparent' }
                  }
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all"
                      style={isSel
                        ? { borderColor: accent, backgroundColor: accent }
                        : { borderColor: '#cbd5e1' }
                      }
                    >
                      {isSel && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{addon.label}</span>
                  </div>
                  <span
                    className="text-sm font-semibold shrink-0 ml-3"
                    style={isSel ? { color: accent } : { color: '#64748b' }}
                  >
                    +{addon.price}€
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Récapitulatif prix */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-6 space-y-1.5">
        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Prestation de base</span>
          <span>{basePrice}€</span>
        </div>
        {selected.map(a => (
          <div key={a.id} className="flex justify-between text-sm" style={{ color: accent }}>
            <span>{a.label}</span>
            <span>+{a.price}€</span>
          </div>
        ))}
        {travelFee > 0 && (
          <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>Frais de déplacement</span>
            <span>+{travelFee}€</span>
          </div>
        )}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
          <span>Total estimé</span>
          <span>{total + travelFee}€</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          ← Retour
        </button>
        <button
          onClick={() => onNext({ selected_addons: selected, booked_price: total })}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: accent }}
        >
          Continuer →
        </button>
      </div>
    </div>
  )
}
