'use client'

import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import type { PointDelai } from '@/lib/graphiquesCrm'
import { FUSEAU } from '@/lib/dateUtils'
import { useT } from '@/components/i18n/I18nProvider'
import { trans } from '@/lib/i18n/trans'

// Délai de réservation : combien de jours avant le rendez-vous les clients
// réservent. Un point par réservation, la date où elle a été prise en
// abscisse, son avance en ordonnée. Dit au laveur jusqu'où ouvrir son agenda.

const decimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })
const dateCourte = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: FUSEAU })

function avance(jours: number): string {
  if (jours < 1) return 'moins d’un jour'
  return `${decimal.format(jours)} jour${jours >= 2 ? 's' : ''}`
}

function InfoBulle({ active, payload }: { active?: boolean; payload?: { payload: PointDelai }[] }) {
  const tr = useT()
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{tr('{avance} d’avance', { avance: avance(p.delai) })}</p>
      <p className="text-slate-500 dark:text-slate-400">{tr('Réservé le {dateCourte} pour le {v1}', { dateCourte: dateCourte(p.creeLe), v1: dateCourte(p.planifieLe) })}</p>
    </div>
  )
}

export default function DelaiReservation({ points, mediane, teinte, className = '' }: {
  points: PointDelai[]
  mediane: number | null
  teinte: string
  className?: string
}) {
  const tr = useT()
  const assez = points.length >= 5 && mediane !== null

  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tr('Délai de réservation')}</h2>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">{tr('Combien de temps avant le rendez-vous vos clients réservent')}</p>

      {!assez ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">{tr('Pas assez de réservations sur la période.')}</p>
      ) : (
        <>
          <p className="text-sm text-slate-700 dark:text-slate-200 mb-2">{trans(tr, 'La moitié de vos clients réservent {e0} à l’avance ou moins.', { e0: <span className="font-semibold">{avance(mediane)}</span> })}</p>
          <div className="text-slate-300 dark:text-slate-700">
            <ResponsiveContainer width="100%" height={180}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.6} />
                <XAxis type="number" dataKey="creeLe" domain={['dataMin', 'dataMax']} scale="time"
                       tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       tickFormatter={dateCourte} minTickGap={24} />
                <YAxis type="number" dataKey="delai" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false}
                       tickLine={false} width={40} allowDecimals={false} tickFormatter={v => `${v} j`} />
                <ZAxis range={[36, 36]} />
                <ReferenceLine y={mediane} stroke="#64748b" strokeDasharray="4 4"
                  label={{ value: tr('Médiane'), position: 'insideTopRight', fontSize: 10, fill: '#64748b' }} />
                <Tooltip content={<InfoBulle />} cursor={false} />
                <Scatter data={points} fill={teinte} fillOpacity={0.7} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
