'use client'

import { useEffect, useState } from 'react'
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

// Sections atteignables par une ancre, et onglet qui les contient. La barre
// d'avancement de la configuration pointe directement dessus : sans cette
// table, le lien ouvrait la page sur le premier onglet et le laveur devait
// retrouver lui-meme la section — ce qui vide l'interet du raccourci.
const ONGLET_PAR_ANCRE: Record<string, Tab> = {
  identite:       'identite',
  zone:           'identite',
  creneaux:       'identite',
  agenda:         'identite',
  prestations:    'prestations',
  disponibilites: 'disponibilites',
}

export default function AdminTabs({ washer, services, categories, availabilities, unavailabilities }: Props) {
  const [tab, setTab] = useState<Tab>('identite')

  // L'onglet ne peut pas etre choisi au rendu serveur : le fragment d'URL n'y
  // est jamais transmis. On l'applique donc apres montage, puis on fait
  // defiler une fois la section rendue.
  useEffect(() => {
    const ancre = window.location.hash.replace(/^#/, '')
    if (!ancre) return
    const cible = ONGLET_PAR_ANCRE[ancre]
    if (!cible) return

    // Le changement d'onglet part d'une image d'attente, pas du corps de
    // l'effet : un setState synchrone ici declencherait un rendu en cascade.
    requestAnimationFrame(() => {
      setTab(cible)
      // Seconde attente : la section doit avoir ete peinte avant qu'on la
      // cherche, sinon elle n'existe pas encore.
      requestAnimationFrame(() => {
        document.getElementById(ancre)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }, [])

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 w-full">
        {TABS.map(t => (
          <button
            key={t.key}
            data-testid={`admin-tab-${t.key}`}
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
      {/* Ancres de defilement : les onglets Prestations et Disponibilites
          n'ont pas de section interne a cibler, on ancre leur contenu entier. */}
      {tab === 'prestations'    && <div id="prestations" className="scroll-mt-24"><PrestationsManager services={services} categories={categories} /></div>}
      {tab === 'disponibilites' && <div id="disponibilites" className="scroll-mt-24"><DisponibilitesManager availabilities={availabilities} unavailabilities={unavailabilities} teamSize={washer.team_size ?? 1} /></div>}
    </div>
  )
}
