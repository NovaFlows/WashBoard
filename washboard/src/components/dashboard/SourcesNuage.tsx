'use client'

import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import type { PointSource } from '@/lib/graphiquesCrm'

// Sources de trafic : volume × conversion.
//
// La liste « Conversion par source » donne les chiffres un par un ; ce nuage
// les met face à face. Un point par réseau : à droite, ceux qui amènent du
// monde ; en haut, ceux dont les visiteurs réservent. La ligne en tirets est la
// moyenne — au-dessus, mieux que d'habitude.
//
// Axe des visiteurs en échelle logarithmique : l'accès direct pèse souvent cent
// fois plus que Google, et sur une échelle linéaire tous les petits réseaux
// s'écraseraient contre l'axe.
//
// Chaque point est étiqueté de son nom : l'identité passe par le libellé, pas
// par la couleur, que tous les points partagent.

const SEUIL_VISITEURS = 5
const nombre = new Intl.NumberFormat('fr-FR')
const pct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 })

function InfoBulle({ active, payload }: { active?: boolean; payload?: { payload: PointSource }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm text-xs">
      <p className="font-semibold text-slate-900 dark:text-slate-100">{p.label}</p>
      <p className="text-slate-600 dark:text-slate-300 tabular-nums">
        {nombre.format(p.visiteurs)} visiteurs · {nombre.format(p.conversions)} réservation{p.conversions > 1 ? 's' : ''}
      </p>
      <p className="text-slate-500 dark:text-slate-400 tabular-nums">Conversion : {pct.format(p.taux)} %</p>
    </div>
  )
}

/** Un point et son nom, sur une ligne. Le liseré de la couleur du fond
 *  détache le texte de la ligne de moyenne quand il la croise. */
function PointEtiquete({ cx, cy, fill, payload }: {
  cx?: number; cy?: number; fill?: string; payload?: PointSource & { aGauche: boolean }
}) {
  if (cx == null || cy == null || !payload) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={5} fill={fill} />
      <text x={cx + (payload.aGauche ? -10 : 10)} y={cy} dy="0.35em" textAnchor={payload.aGauche ? 'end' : 'start'}
            fontSize={11} strokeWidth={3} paintOrder="stroke" strokeLinejoin="round"
            className="fill-slate-600 stroke-white dark:fill-slate-300 dark:stroke-slate-900">
        {payload.label}
      </text>
    </g>
  )
}

export default function SourcesNuage({ sources, visiteurs, conversions, accent = '#2563eb', periodLabel }: {
  sources: PointSource[]
  /** Totaux de la période, pour la ligne de moyenne. */
  visiteurs: number
  conversions: number
  accent?: string
  periodLabel: string
}) {
  // Un réseau à deux visiteurs n'a pas de taux de conversion qui veuille dire
  // quelque chose : un seul client en ferait « 50 % ».
  const points = sources.filter(s => s.visiteurs >= SEUIL_VISITEURS)
  const moyenne = visiteurs > 0 ? (conversions / visiteurs) * 100 : 0

  const xs = points.map(p => p.visiteurs)
  const xMin = Math.max(1, Math.min(...xs) / 2)
  const xMax = Math.max(...xs) * 2
  const graduations = [1, 10, 100, 1_000, 10_000, 100_000].filter(g => g >= xMin && g <= xMax)

  // Axe des taux en pas ronds (1, 2, 5, 10 ou 20 %) : « 8,5 % » en haut d'axe
  // ne se lit pas.
  const brut = Math.max(1, moyenne, ...points.map(p => p.taux)) * 1.15
  const pas = brut <= 5 ? 1 : brut <= 10 ? 2 : brut <= 25 ? 5 : brut <= 50 ? 10 : 20
  const yMax = Math.min(100, Math.ceil(brut / pas) * pas)
  const graduationsY = Array.from({ length: Math.floor(yMax / pas) + 1 }, (_, i) => i * pas)

  // Étiquette à droite du point, sauf dans le dernier quart de l'axe où elle
  // sortirait du cadre : elle passe alors à gauche.
  const etendue = Math.log(xMax) - Math.log(xMin)
  const donnees = points.map(p => ({ ...p, aGauche: (Math.log(p.visiteurs) - Math.log(xMin)) / etendue > 0.75 }))

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Sources : volume et conversion</h3>
        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{periodLabel}</span>
      </div>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-3">
        À droite, les sources qui amènent du monde ; en haut, celles dont les visiteurs réservent.
      </p>

      {points.length < 2 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center leading-relaxed">
          Il faut au moins deux sources d&apos;au moins {SEUIL_VISITEURS} visiteurs pour les comparer.
          {/* Ne pas écrire ici le titre de l'encart des liens : les tests de bout
              en bout le cherchent comme texte unique sur la page. */}
          <br />Utilisez les liens de partage en bas de page pour que chaque source soit reconnue.
        </p>
      ) : (
        <>
          <div className="text-slate-300 dark:text-slate-700">
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 24, right: 24, bottom: 4, left: 0 }}>
                <CartesianGrid stroke="currentColor" strokeOpacity={0.6} />
                <XAxis type="number" dataKey="visiteurs" scale="log" domain={[xMin, xMax]} ticks={graduations}
                       allowDataOverflow tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                       tickFormatter={v => nombre.format(v)} />
                <YAxis type="number" dataKey="taux" domain={[0, yMax]} ticks={graduationsY} tick={{ fontSize: 11, fill: '#94a3b8' }}
                       axisLine={false} tickLine={false} width={44} tickFormatter={v => `${pct.format(v)} %`} />
                <ZAxis range={[90, 90]} />
                {/* Seule ligne en tirets : c'est un seuil, pas une donnée. */}
                {/* Pas d'étiquette dans le tracé : sur mobile, elle recouvrait les
                    points bas. Elle est dite sous le graphique. */}
                <ReferenceLine y={moyenne} stroke="#64748b" strokeDasharray="4 4" />
                <Tooltip content={<InfoBulle />} cursor={false} />
                <Scatter data={donnees} fill={accent} isAnimationActive={false} shape={<PointEtiquete />} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-slate-500" aria-hidden />
            Conversion moyenne : {pct.format(moyenne)} %
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
            Visiteurs en échelle logarithmique · sources de moins de {SEUIL_VISITEURS} visiteurs non affichées
          </p>
        </>
      )}
    </div>
  )
}
