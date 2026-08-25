'use client'

import { YEARLY_FREE_MONTHS, type BillingCycle } from '@/lib/plan'

// Bascule mensuel / annuel, partagée entre la landing et la page Abonnement.
// L'annuel est le choix par défaut côté appelant (useState('yearly')).
export default function BillingToggle({
  value,
  onChange,
  className = '',
}: {
  value: BillingCycle
  onChange: (v: BillingCycle) => void
  className?: string
}) {
  const options: { key: BillingCycle; label: string }[] = [
    { key: 'monthly', label: 'Mensuel' },
    { key: 'yearly', label: 'Annuel' },
  ]

  return (
    <div className={`inline-flex items-center gap-3 flex-wrap ${className}`}>
      <div
        role="radiogroup"
        aria-label="Périodicité de facturation"
        className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
      >
        {options.map(o => {
          const active = value === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.key)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                active
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        {YEARLY_FREE_MONTHS} mois offerts
      </span>
    </div>
  )
}
