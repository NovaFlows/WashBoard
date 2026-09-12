'use client'

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { PointCumul } from '@/lib/graphiquesCrm'

// Chiffre d'affaires cumulé, période en cours face à la précédente.
//
// Répond à « suis-je en avance ou en retard sur le mois dernier ? » mieux
// qu'un total : deux courbes qui montent, la période en cours en couleur, la
// précédente en gris pour servir de repère.

const TEINTE_REPERE = '#cbd5e1'
const euros = (v: number) => `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v)} €`

function Cle({ couleur }: { couleur: string }) {
  return <span className="inline-block w-3 h-0.5 rounded-sm shrink-0" style={{ backgroundColor: couleur }} aria-hidden />
}

function InfoBulle({ active, payload, label, teinte }: {
  active?: boolean; payload?: { dataKey?: string | number; value?: number | null }[]; label?: string; teinte: string
}) {
  if (!active || !payload?.length) return null
  const valeur = (cle: string) => payload.find(p => p.dataKey === cle)?.value
  const actuel = valeur('actuel')
  const precedent = valeur('precedent')
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm text-xs space-y-0.5">
      <p className="text-slate-500 dark:text-slate-400">Jour {label}</p>
      {actuel != null && (
        <p className="flex items-center gap-2"><Cle couleur={teinte} /><span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{euros(actuel)}</span></p>
      )}
      {precedent != null && (
        <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Cle couleur={TEINTE_REPERE} /><span className="tabular-nums">{euros(precedent)}</span></p>
      )}
    </div>
  )
}

export default function CaCumule({ points, libelleActuel, libellePrecedent, teinte }: {
  points: PointCumul[]
  libelleActuel: string
  libellePrecedent: string
  teinte: string
}) {
  const dernier = (cle: 'actuel' | 'precedent') => [...points].reverse().find(p => p[cle] != null)?.[cle] ?? 0
  const totalActuel = dernier('actuel')
  const totalPrecedent = dernier('precedent')

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Chiffre d&apos;affaires cumulé</h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Au même jour de la période précédente</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5"><Cle couleur={teinte} />{libelleActuel} <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{euros(totalActuel)}</span></span>
        <span className="flex items-center gap-1.5"><Cle couleur={TEINTE_REPERE} />{libellePrecedent} <span className="font-semibold tabular-nums">{euros(totalPrecedent)}</span></span>
      </div>

      {totalActuel === 0 && totalPrecedent === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Aucun chiffre d&apos;affaires sur ces deux périodes.</p>
      ) : (
        <div className="text-slate-300 dark:text-slate-700">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                     interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48}
                     allowDecimals={false} tickFormatter={v => new Intl.NumberFormat('fr-FR').format(v)} />
              <Tooltip content={<InfoBulle teinte={teinte} />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.5 }} />
              {/* Le repère d'abord, pour que la période en cours passe devant. */}
              <Line type="stepAfter" dataKey="precedent" stroke={TEINTE_REPERE} strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="actuel" stroke={teinte} strokeWidth={2} dot={false} connectNulls={false}
                    activeDot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
