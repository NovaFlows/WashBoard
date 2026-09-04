'use client'

import type { CrmPeriodState, CrmPeriodType } from '@/lib/crmPeriod'

// Sélecteur de période du CRM, remonté en tête d'écran.
//
// Il vivait au milieu du tableau des clients et ne filtrait que celui-ci : les
// statistiques de visite affichées plus haut restaient bloquées sur 30 jours.
// On pouvait donc lire « 812 visiteurs » au-dessus d'un tableau ne montrant
// qu'une seule journée, sans que rien n'explique l'écart.
//
// Composant contrôlé : l'état vit chez le parent, qui s'en sert pour filtrer
// à la fois les réservations et les statistiques. Une seule source, donc pas
// de dérive possible entre les deux moitiés de l'écran.

const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

const LIBELLES: Record<CrmPeriodType, string> = {
  all: 'Tout', year: 'Année', month: 'Mois', week: 'Semaine', day: 'Jour',
}

function jourEnTexte(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dateCourte(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function CrmPeriodFilter({
  value,
  onChange,
  availableYears,
}: {
  value: CrmPeriodState
  onChange: (v: CrmPeriodState) => void
  availableYears: number[]
}) {
  const set = (partiel: Partial<CrmPeriodState>) => onChange({ ...value, ...partiel })

  const finSemaine = new Date(value.weekStart)
  finSemaine.setDate(finSemaine.getDate() + 6)

  const btn = (actif: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${
      actif
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
    }`

  const fleche = 'w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors'

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider shrink-0">
          Période
        </span>
        <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          {(['all', 'year', 'month', 'week', 'day'] as const).map(t => (
            <button
              key={t}
              onClick={() => set({ type: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                value.type === t
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {LIBELLES[t]}
            </button>
          ))}
        </div>
      </div>

      {value.type === 'year' && (
        <div className="flex gap-1.5 flex-wrap">
          {availableYears.map(y => (
            <button key={y} onClick={() => set({ year: y })} className={btn(value.year === y)}>{y}</button>
          ))}
        </div>
      )}

      {value.type === 'month' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-1.5 flex-wrap">
            {availableYears.map(y => (
              <button key={y} onClick={() => set({ year: y })} className={btn(value.year === y)}>{y}</button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {MOIS_FR.map((m, i) => (
              <button
                key={m}
                onClick={() => set({ month: i })}
                className={`${btn(value.month === i)} min-w-[40px] text-center`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {value.type === 'week' && (
        <div className="flex items-center gap-2">
          <button
            aria-label="Semaine précédente"
            onClick={() => { const d = new Date(value.weekStart); d.setDate(d.getDate() - 7); set({ weekStart: d }) }}
            className={fleche}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="px-4 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
            {dateCourte(value.weekStart)} — {dateCourte(finSemaine)}
          </div>
          <button
            aria-label="Semaine suivante"
            onClick={() => { const d = new Date(value.weekStart); d.setDate(d.getDate() + 7); set({ weekStart: d }) }}
            className={fleche}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {value.type === 'day' && (
        <div className="flex items-center gap-2">
          <button
            aria-label="Jour précédent"
            onClick={() => { const d = new Date(value.day); d.setDate(d.getDate() - 1); set({ day: jourEnTexte(d) }) }}
            className={fleche}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <input
            type="date"
            value={value.day}
            onChange={e => e.target.value && set({ day: e.target.value })}
            className="px-3 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-400 focus:outline-none"
          />
          <button
            aria-label="Jour suivant"
            onClick={() => { const d = new Date(value.day); d.setDate(d.getDate() + 1); set({ day: jourEnTexte(d) }) }}
            className={fleche}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
