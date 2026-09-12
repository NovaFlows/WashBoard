'use client'

import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { PointTrafic } from '@/lib/graphiquesCrm'

// Visiteurs et réservations dans le temps.
//
// Les deux séries comptent la même chose — des sessions — et partagent donc
// légitimement un seul axe. Les visiteurs portent la couleur du laveur, les
// réservations la seconde teinte de la palette.

const TEINTE_RESA = '#eb6834'
const nombre = new Intl.NumberFormat('fr-FR')

function Cle({ couleur }: { couleur: string }) {
  return <span className="inline-block w-3 h-0.5 rounded-sm shrink-0" style={{ backgroundColor: couleur }} aria-hidden />
}

function InfoBulle({ active, payload, label, accent }: {
  active?: boolean; payload?: { dataKey?: string | number; value?: number }[]; label?: string; accent: string
}) {
  if (!active || !payload?.length) return null
  const valeur = (cle: string) => payload.find(p => p.dataKey === cle)?.value ?? 0
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm text-xs space-y-0.5">
      <p className="text-slate-500 dark:text-slate-400">{label}</p>
      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <Cle couleur={accent} /><span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{nombre.format(valeur('visiteurs'))}</span> visiteurs
      </p>
      <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
        <Cle couleur={TEINTE_RESA} /><span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{nombre.format(valeur('conversions'))}</span> réservations
      </p>
    </div>
  )
}

export default function TraficTemps({ points, granularite, visiteurs, reservations, accent = '#2563eb', periodLabel }: {
  points: PointTrafic[]
  granularite: 'jour' | 'semaine'
  /** Totaux de la période, repris des tuiles du haut : une session à cheval
   *  sur minuit compte dans deux jours, et la somme des points dépasserait
   *  alors d'un ou deux le chiffre affiché plus haut. */
  visiteurs: number
  reservations: number
  accent?: string
  periodLabel: string
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Visiteurs et réservations dans le temps</h3>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{periodLabel}</span>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
        Par {granularite}, sur votre page de réservation
      </p>

      {/* Deux séries : une légende, qui donne aussi les totaux. */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-600 dark:text-slate-300">
        <span className="flex items-center gap-1.5"><Cle couleur={accent} />Visiteurs <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{nombre.format(visiteurs)}</span></span>
        <span className="flex items-center gap-1.5"><Cle couleur={TEINTE_RESA} />Réservations <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{nombre.format(reservations)}</span></span>
      </div>

      {visiteurs === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">Pas encore de visite mesurée sur cette période.</p>
      ) : (
        <div className="text-slate-300 dark:text-slate-700">
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                     interval="preserveStartEnd" minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40}
                     allowDecimals={false} tickFormatter={v => nombre.format(v)} />
              <Tooltip content={<InfoBulle accent={accent} />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.5 }} />
              {/* Tracé droit, pas lissé : un lissage fait passer la courbe sous
                  zéro entre deux jours creux, ce qui n'existe pas. */}
              <Area type="linear" dataKey="visiteurs" stroke={accent} strokeWidth={2} fill={accent} fillOpacity={0.1}
                    dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              <Line type="linear" dataKey="conversions" stroke={TEINTE_RESA} strokeWidth={2}
                    dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
