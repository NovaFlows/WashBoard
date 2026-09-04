'use client'

import { useMemo, useState, type ComponentProps } from 'react'
import {
  buildFunnelSummary,
  countDistinctSessions,
  buildDeviceBreakdown,
  buildReferrerBreakdown,
  buildDeviceConversionBreakdown,
  buildReferrerConversionBreakdown,
  buildVisitTimingBreakdown,
  restrictToSessionsReaching,
  comparePeriods,
} from '@/lib/funnelStats'
import { getCrmPeriodBounds, crmPeriodLabel, type CrmPeriodState } from '@/lib/crmPeriod'
import type { Device } from '@/lib/funnelTracking'
import { getMondayOf } from '@/lib/dateUtils'
import { CrmPeriodFilter } from '@/components/dashboard/CrmPeriodFilter'
import FunnelInsights from '@/components/dashboard/FunnelInsights'
import VisitFunnel from '@/components/dashboard/VisitFunnel'
import CrmDashboard from '@/components/dashboard/CrmDashboard'

// Orchestre l'écran CRM autour d'UNE période commune.
//
// Auparavant, le sélecteur vivait dans le tableau des clients et ne filtrait
// que lui : les statistiques de visite restaient figées sur 30 jours. On
// pouvait donc lire « 812 visiteurs » au-dessus d'un tableau ne montrant
// qu'une journée. Ici, la période est tenue une seule fois et sert aux deux.
//
// Les calculs se font dans le navigateur à partir des événements bruts : ce
// sont les mêmes fonctions pures que côté serveur, et changer de période
// n'oblige pas à recharger la page.

/** Evenement brut tel que charge par la page : l'etape et la session pour
 *  l'entonnoir, la date pour le filtrage, l'appareil et la source pour les
 *  repartitions. */
export type CrmEvent = {
  step: 'prestation' | 'options' | 'creneau' | 'coordonnees' | 'confirmation'
  session_id: string
  created_at: string
  referrer_host?: string | null
  device?: Device | null
}

/** Les reservations telles que CrmDashboard les attend : on derive son type
 *  plutot que d'en redeclarer un second, qui finirait par diverger. */
type BookingRow = ComponentProps<typeof CrmDashboard>['bookings'][number]

type Props = {
  events: CrmEvent[]
  bookings: BookingRow[]
  websiteHost?: string
  accent?: string
}

/** Une date suffisamment ancienne pour couvrir tout l'historique : sert de
 *  borne quand la période est « Tout ». */
const DEBUT_DES_TEMPS = new Date(2000, 0, 1)

export default function CrmView({ events, bookings, websiteHost, accent }: Props) {
  const [periode, setPeriode] = useState<CrmPeriodState>(() => {
    const now = new Date()
    return {
      // « Tout » par défaut : c'est la vue qui répond à « comment ça va
      // globalement », la question qu'on se pose en arrivant.
      type: 'all',
      year: now.getFullYear(),
      month: now.getMonth(),
      weekStart: getMondayOf(now),
      day: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    }
  })

  // Années présentes dans les données, pour ne pas proposer de période vide.
  const availableYears = useMemo(() => {
    const ans = new Set<number>()
    for (const b of bookings) {
      const d = new Date(b.scheduled_at)
      if (Number.isFinite(d.getTime())) ans.add(d.getFullYear())
    }
    ans.add(new Date().getFullYear())
    return [...ans].sort((a, b) => b - a)
  }, [bookings])

  const stats = useMemo(() => {
    const bornes = getCrmPeriodBounds(periode)
    const debut = bornes?.start ?? DEBUT_DES_TEMPS
    const fin = bornes?.end ?? new Date(8.64e15)

    const dansLaPeriode = events.filter(e => {
      const t = new Date(e.created_at).getTime()
      return Number.isFinite(t) && t >= debut.getTime() && t < fin.getTime()
    })

    // Même population partout : les sessions arrivées à l'étape « prestation ».
    // Sans ce filtre, le nombre de visiteurs ne correspondait pas au total des
    // répartitions affichées juste en dessous.
    const retenus = restrictToSessionsReaching(dansLaPeriode, 'prestation')
    const funnelStats = buildFunnelSummary(retenus)

    // Période précédente de même durée, pour la comparaison. Sur « Tout », il
    // n'y a rien avant : la comparaison n'a pas de sens et vaut zéro.
    const duree = bornes ? bornes.end.getTime() - bornes.start.getTime() : 0
    const precedents = bornes
      ? events.filter(e => {
          const t = new Date(e.created_at).getTime()
          return Number.isFinite(t) && t >= debut.getTime() - duree && t < debut.getTime()
        })
      : []

    return {
      funnelStats,
      visitorCount: funnelStats.find(s => s.step === 'prestation')?.sessions ?? 0,
      conversionCount: funnelStats.find(s => s.step === 'confirmation')?.sessions ?? 0,
      visitorChange: comparePeriods(
        countDistinctSessions(retenus),
        countDistinctSessions(restrictToSessionsReaching(precedents, 'prestation')),
      ),
      deviceBreakdown: buildDeviceBreakdown(retenus),
      referrerBreakdown: buildReferrerBreakdown(retenus),
      deviceConversionBreakdown: buildDeviceConversionBreakdown(retenus),
      referrerConversionBreakdown: buildReferrerConversionBreakdown(retenus),
      visitTimingBreakdown: buildVisitTimingBreakdown(retenus),
    }
  }, [events, periode])

  return (
    <>
      <div className="mb-4">
        <CrmPeriodFilter value={periode} onChange={setPeriode} availableYears={availableYears} />
      </div>

      <div className="mb-6 space-y-4">
        <FunnelInsights
          visitorCount={stats.visitorCount}
          visitorChange={stats.visitorChange}
          conversionCount={stats.conversionCount}
          deviceBreakdown={stats.deviceBreakdown}
          referrerBreakdown={stats.referrerBreakdown}
          deviceConversionBreakdown={stats.deviceConversionBreakdown}
          referrerConversionBreakdown={stats.referrerConversionBreakdown}
          visitTimingBreakdown={stats.visitTimingBreakdown}
          websiteHost={websiteHost}
          accent={accent}
          periodLabel={crmPeriodLabel(periode)}
        />
        <VisitFunnel stats={stats.funnelStats} accent={accent} periodLabel={crmPeriodLabel(periode)} />
      </div>

      <CrmDashboard bookings={bookings} period={periode} />
    </>
  )
}
