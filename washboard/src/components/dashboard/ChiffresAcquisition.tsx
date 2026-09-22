'use client'

import { useMemo } from 'react'
import {
  buildFunnelSummary, countDistinctSessions, buildDeviceBreakdown, buildReferrerBreakdown,
  buildVisitTimingBreakdown, restrictToSessionsReaching, comparePeriods, formatConversionRate,
} from '@/lib/funnelStats'
import { getCrmPeriodBounds, previousCrmPeriod, type CrmPeriodState } from '@/lib/crmPeriod'
import type { ChiffresEvent } from '@/components/dashboard/ChiffresV2'

// Onglet « Acquisition » de Chiffres (refonte 2026, passe 5) — reprend les
// statistiques de visite de l'ancien CRM (`CrmView.tsx`, `/dashboard/crm`),
// mêmes fonctions pures (`funnelStats.ts`), présentation différente. Le
// mois courant est fixe, sans sélecteur de période : la maquette
// (`project/ChiffresAcquisition.dc.html`) n'en montre aucun sur cet onglet,
// contrairement à l'écran CRM actuel qui en propose un (jour/semaine/mois/
// année/tout). Déviation assumée — signalée dans le compte rendu de la
// passe : un laveur qui veut naviguer les mois reste sur /dashboard/crm
// (menu latéral) pour l'instant.
//
// Étape volontairement omise, comme `funnelStats.ts` l'a déjà documenté pour
// tout le CRM : l'étape « Options » n'existe que pour les prestations avec
// options, l'exclure du tunnel principal évite un faux décrochage pour les
// laveurs qui n'en ont pas — d'où 4 lignes dans « Où ils s'arrêtent », pas 5
// comme le dessin de la maquette.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

const LABEL_APPAREIL: Record<string, string> = {
  mobile: 'Téléphone', tablet: 'Tablette', desktop: 'Ordinateur', inconnu: 'Inconnu',
}

function moisCourant(): CrmPeriodState {
  const now = new Date()
  return {
    type: 'month',
    year: now.getFullYear(),
    month: now.getMonth(),
    weekStart: now,
    day: '',
  }
}

export default function ChiffresAcquisition({ events, websiteHost }: {
  events: ChiffresEvent[]
  websiteHost?: string
}) {
  const stats = useMemo(() => {
    const periode = moisCourant()
    const precedente = previousCrmPeriod(periode)!
    const bornes = getCrmPeriodBounds(periode)!
    const bornesPrec = getCrmPeriodBounds(precedente)!

    const dansLaPeriode = events.filter(e => {
      const t = new Date(e.created_at).getTime()
      return Number.isFinite(t) && t >= bornes.start.getTime() && t < bornes.end.getTime()
    })
    const dansLaPrecedente = events.filter(e => {
      const t = new Date(e.created_at).getTime()
      return Number.isFinite(t) && t >= bornesPrec.start.getTime() && t < bornesPrec.end.getTime()
    })

    const retenus = restrictToSessionsReaching(dansLaPeriode, 'prestation')
    const funnelStats = buildFunnelSummary(retenus)
    const visitorCount = funnelStats.find(s => s.step === 'prestation')?.sessions ?? 0
    const conversionCount = funnelStats.find(s => s.step === 'confirmation')?.sessions ?? 0

    const visitorChange = comparePeriods(
      countDistinctSessions(retenus),
      countDistinctSessions(restrictToSessionsReaching(dansLaPrecedente, 'prestation')),
    )

    // Le plus gros décrochage : la marche la plus haute entre deux étapes
    // consécutives, jamais la première (son "décrochage" vaut toujours 0 par
    // construction — voir buildFunnelSummary).
    let pire: typeof funnelStats[number] | null = null
    for (const s of funnelStats.slice(1)) {
      if (!pire || s.pctDropFromPrevious > pire.pctDropFromPrevious) pire = s
    }
    const pireIndex = pire ? funnelStats.indexOf(pire) : -1

    return {
      funnelStats,
      visitorCount,
      conversionCount,
      visitorChange,
      pire,
      pireAvant: pireIndex > 0 ? funnelStats[pireIndex - 1] : null,
      referrerBreakdown: buildReferrerBreakdown(retenus),
      deviceBreakdown: buildDeviceBreakdown(retenus),
      visitTiming: buildVisitTimingBreakdown(retenus),
    }
  }, [events])

  const maxReferrer = stats.referrerBreakdown[0]?.sessions ?? 1

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-[3px]">
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Visiteurs sur votre page ce mois-ci</span>
        <span className={`text-[44px] sm:text-[52px] leading-none ${hero}`}>{nombre.format(stats.visitorCount)}</span>
        {stats.visitorCount === 0 ? (
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune visite ce mois-ci pour l’instant</span>
        ) : (
          <span className={`text-[13.5px] ${corps}`} style={{ color: stats.conversionCount > 0 ? 'var(--v2-color-vert)' : 'var(--v2-color-gris)' }}>
            {stats.visitorChange.pct !== null && (
              <>{stats.visitorChange.pct >= 0 ? '+' : ''}{stats.visitorChange.pct} % · </>
            )}
            {nombre.format(stats.conversionCount)} réservation{stats.conversionCount > 1 ? 's' : ''}, soit {formatConversionRate(stats.conversionCount, stats.visitorCount)}
          </span>
        )}
      </div>

      {stats.visitorCount > 0 && (
        <>
          <div>
            <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>Où ils s’arrêtent</p>
            <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 pt-2 pb-3">
              {stats.funnelStats.map((s, i) => (
                <div key={s.step} className="flex items-center gap-[11px] py-[7px]">
                  <span className={`w-[92px] shrink-0 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{ETAPE_COURTE[s.step]}</span>
                  <span className="flex-1 h-3 rounded-md bg-[color:var(--v2-filet-fort)] flex overflow-hidden">
                    <span
                      className="rounded-md"
                      style={{ width: `${Math.max(s.pctOfFirst, 2)}%`, backgroundColor: i === 0 ? 'var(--v2-color-encre)' : 'rgba(22,22,26,0.30)' }}
                    />
                  </span>
                  <span className={`w-10 shrink-0 text-right text-[13.5px] ${corpsFort} tabular-nums`}>{nombre.format(s.sessions)}</span>
                </div>
              ))}
              {stats.pire && stats.pireAvant && stats.pire.pctDropFromPrevious > 0 && (
                <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed pt-1.5`}>
                  Le plus gros décrochage est entre {ETAPE_COURTE[stats.pireAvant.step].toLowerCase()} et {ETAPE_COURTE[stats.pire.step].toLowerCase()} :{' '}
                  {stats.pire.pctDropFromPrevious} % des visiteurs abandonnent là.
                </p>
              )}
            </div>
          </div>

          {stats.referrerBreakdown.length > 0 && (
            <div>
              <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>D’où ils viennent</p>
              <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 py-2.5">
                {stats.referrerBreakdown.slice(0, 6).map((r, i) => (
                  <div key={r.host} className="flex items-center gap-3 py-[9px]">
                    <span className={`w-[78px] shrink-0 truncate text-[13.5px] ${i === 0 ? corpsFort : corps}`} style={{ color: i === 0 ? 'var(--v2-color-encre)' : 'var(--v2-color-gris)' }}>
                      {r.host === websiteHost ? 'Votre site' : r.host === 'direct' ? 'Direct' : r.host}
                    </span>
                    <span className="flex-1 h-1.5 rounded bg-[color:var(--v2-filet-fort)] flex overflow-hidden">
                      <span className="rounded" style={{ width: `${Math.max((r.sessions / maxReferrer) * 100, 3)}%`, backgroundColor: i === 0 ? 'var(--v2-color-encre)' : 'rgba(22,22,26,0.28)' }} />
                    </span>
                    <span className={`w-[46px] shrink-0 text-right text-[13.5px] ${corpsFort} tabular-nums`}>{nombre.format(r.sessions)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-relaxed px-1`}>
            {stats.deviceBreakdown.map(d => `${LABEL_APPAREIL[d.device] ?? d.device} ${d.pct} %`).join(' · ')}
            {stats.visitTiming.topSlot && ` · les visites montent surtout en ${stats.visitTiming.topSlot.toLowerCase()}`}
          </p>
        </>
      )}
    </div>
  )
}

const ETAPE_COURTE: Record<string, string> = {
  prestation: 'Prestation',
  creneau: 'Créneau',
  coordonnees: 'Coordonnées',
  confirmation: 'Confirmation',
  options: 'Options',
}
