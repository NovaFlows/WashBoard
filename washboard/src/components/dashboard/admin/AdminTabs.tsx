'use client'

import { useState } from 'react'
import { Palette, SprayCan, Calendar, type LucideIcon } from 'lucide-react'
import type { Washer, Service, ServiceCategory, Availability, Unavailability } from '@/types'
import IdentiteForm from './IdentiteForm'
import PrestationsManager from './PrestationsManager'
import DisponibilitesManager from './DisponibilitesManager'

type Tab = 'identite' | 'prestations' | 'disponibilites'

const TABS: { key: Tab; label: string; icon: LucideIcon }[] = [
  { key: 'identite',        label: 'Identité',        icon: Palette },
  { key: 'prestations',     label: 'Prestations',     icon: SprayCan },
  { key: 'disponibilites',  label: 'Disponibilités',  icon: Calendar },
]

type Props = {
  washer: Washer
  services: Service[]
  categories: ServiceCategory[]
  availabilities: Availability[]
  unavailabilities: Unavailability[]
}

export default function AdminTabs({ washer, services, categories, availabilities, unavailabilities }: Props) {
  const [tab, setTab] = useState<Tab>('identite')

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 w-full">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <t.icon size={16} strokeWidth={2} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'identite'       && <IdentiteForm washer={washer} />}
      {tab === 'prestations'    && <PrestationsManager services={services} categories={categories} />}
      {tab === 'disponibilites' && <DisponibilitesManager availabilities={availabilities} unavailabilities={unavailabilities} teamSize={washer.team_size ?? 1} />}
    </div>
  )
}
