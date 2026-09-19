'use client'

import { useState } from 'react'
import type { Service, ServiceAddon, VehicleItem } from '@/types'
import { hex } from '@/lib/colorUtils'
import { dureeTotale, prixOptions } from '@/lib/pricing'

// Options choisies véhicule par véhicule.
//
// Avant le 20/09/2026, cet écran produisait UNE liste d'options pour toute la
// commande. Un client qui réservait deux voitures et voulait un nettoyage de
// vomi sur une seule ne pouvait pas l'exprimer : l'option s'appliquait aux
// deux, et la durée bloquée était doublée alors que le prix, lui, n'était
// compté qu'une fois. Le laveur facturait une option et en bloquait deux.
//
// Chaque véhicule porte désormais ses propres options. Avec un seul véhicule,
// l'écran reste identique à ce qu'il était : pas d'en-tête, pas de section —
// le cas courant ne doit pas payer le prix du cas rare.

type Props = {
  service: Service
  /** Un exemplaire par véhicule (voir StepService), dans l'ordre d'affichage. */
  vehicules: VehicleItem[]
  basePrice: number
  baseDuration: number
  onNext: (data: {
    selected_addons: ServiceAddon[]
    vehicles_detail: VehicleItem[]
    booked_price: number
  }) => void
  onBack: () => void
  accent?: string
}

/** Comment nommer une voiture à l'écran : son modèle s'il est connu, sinon son
 *  rang parmi celles du même type. « Citadine · Clio grise », « Citadine 2 ». */
function titreVehicule(v: VehicleItem, index: number, tous: VehicleItem[]): string {
  const nom = v.label ?? v.type
  const modele = v.models?.[0]?.trim()
  if (modele) return `${nom} · ${modele}`
  if (tous.filter(x => x.type === v.type).length === 1) return nom
  return `${nom} ${tous.slice(0, index + 1).filter(x => x.type === v.type).length}`
}

export default function StepOptions({
  service, vehicules, basePrice, baseDuration, onNext, onBack, accent = '#2563eb',
}: Props) {
  // Un tableau d'options par véhicule, aligné sur `vehicules`.
  const [choix, setChoix] = useState<ServiceAddon[][]>(
    () => vehicules.map(v => v.addons ?? []),
  )

  const categories = [...new Set(service.addons.map(a => a.category))]
  const plusieurs = vehicules.length > 1

  const vehiculesChoisis = vehicules.map((v, i) => ({ ...v, addons: choix[i] ?? [] }))
  const totalOptions = prixOptions(vehiculesChoisis, null)
  const total = basePrice + totalOptions
  const totalDuration = dureeTotale(baseDuration, vehiculesChoisis, null, vehicules.length)

  function basculer(indexVehicule: number, addon: ServiceAddon) {
    setChoix(prev => prev.map((liste, i) => {
      if (i !== indexVehicule) return liste
      return liste.some(a => a.id === addon.id)
        ? liste.filter(a => a.id !== addon.id)
        : [...liste, addon]
    }))
  }

  function continuer() {
    onNext({
      // Conservé pour tout ce qui lit encore la liste commune (affichages,
      // factures déjà en place). Une option cochée sur deux voitures y figure
      // deux fois : son montant total reste donc juste.
      selected_addons: choix.flat(),
      vehicles_detail: vehiculesChoisis,
      booked_price: total,
    })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Options &amp; suppléments</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
        {plusieurs ? 'Choisissez les options de chaque véhicule' : 'Personnalisez votre prestation'}
      </p>

      {vehicules.map((vehicule, iv) => (
        <div key={`${vehicule.type}-${iv}`} className={plusieurs ? 'mb-6' : ''}>
          {plusieurs && (
            <div
              className="flex items-center justify-between px-3 py-2 rounded-lg mb-3"
              style={{ backgroundColor: hex(accent, 0.08) }}
            >
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {titreVehicule(vehicule, iv, vehicules)}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {(choix[iv] ?? []).length > 0
                  ? `${(choix[iv] ?? []).length} option${(choix[iv] ?? []).length > 1 ? 's' : ''}`
                  : 'aucune option'}
              </span>
            </div>
          )}

          {categories.map(category => (
            <div key={category} className="mb-5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5">{category}</p>
              <div className="space-y-2">
                {service.addons.filter(a => a.category === category).map(addon => {
                  const isSel = (choix[iv] ?? []).some(a => a.id === addon.id)
                  return (
                    <button
                      key={addon.id}
                      onClick={() => basculer(iv, addon)}
                      aria-pressed={isSel}
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
                      <div className="flex flex-col items-end shrink-0 ml-3">
                        <span
                          className="text-sm font-semibold"
                          style={isSel ? { color: accent } : { color: '#64748b' }}
                        >
                          +{addon.price}€
                        </span>
                        {addon.duration_minutes ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">+{addon.duration_minutes} min</span>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Récapitulatif prix */}
      <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 mb-6 space-y-1.5">
        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
          <span>Prestation de base</span>
          <span>{basePrice}€</span>
        </div>
        {vehicules.map((vehicule, iv) => (
          (choix[iv] ?? []).map(a => (
            <div key={`${iv}-${a.id}`} className="flex justify-between text-sm" style={{ color: accent }}>
              {/* Avec plusieurs véhicules, dire SUR LEQUEL porte l'option :
                  sinon deux lignes identiques semblent être un doublon. */}
              <span>{plusieurs ? `${a.label} — ${titreVehicule(vehicule, iv, vehicules)}` : a.label}</span>
              <span>+{a.price}€</span>
            </div>
          ))
        ))}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-1.5 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-100">
          <span>Total estimé</span>
          <span>{total}€</span>
        </div>
        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500">
          <span>Durée estimée</span>
          <span>{totalDuration} min</span>
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
          data-testid="options-continue"
          onClick={continuer}
          className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: accent }}
        >
          Continuer →
        </button>
      </div>
    </div>
  )
}
