'use client'

import { useState } from 'react'
import { TRAFFIC_SOURCES, buildTrackedBookingLink } from '@/lib/trafficSources'

type Props = {
  baseUrl: string
  accent?: string
}

/** Un lien de réservation par réseau, pour identifier fiablement d'où vient
 *  un client dans le CRM même quand Instagram/TikTok ne transmettent aucun
 *  referrer (voir funnelTracking.ts). Affiché à la fois dans Réglages (pour
 *  copier) et dans le CRM (pour s'y retrouver en lisant les statistiques). */
export default function TrafficSourceLinks({ baseUrl, accent = '#2563eb' }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  function copy(key: string, link: string) {
    navigator.clipboard.writeText(link)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(k => (k === key ? null : k)), 1500)
  }

  return (
    <div className="space-y-2">
      {TRAFFIC_SOURCES.map(source => {
        const link = buildTrackedBookingLink(baseUrl, source.key)
        return (
          <div
            key={source.key}
            className="flex items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <span
              className="text-xs font-semibold w-20 shrink-0"
              style={{ color: accent }}
            >
              {source.label.split(' (')[0]}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono flex-1 truncate" title={link}>
              {link}
            </span>
            <button
              onClick={() => copy(source.key, link)}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
            >
              {copiedKey === source.key ? 'Copié !' : 'Copier'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
