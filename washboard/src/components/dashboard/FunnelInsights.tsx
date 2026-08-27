import { Users, Percent, Activity, Smartphone, Globe, CalendarClock, type LucideIcon } from 'lucide-react'
import type {
  PeriodChange,
  DeviceBreakdownItem,
  ReferrerBreakdownItem,
  DeviceConversionItem,
  ReferrerConversionItem,
  VisitTimingBreakdown,
} from '@/lib/funnelStats'

type Props = {
  visitorCount: number
  visitorChange: PeriodChange
  conversionRate: number
  /** Pic estimé de sessions actives dans une même fenêtre glissante d'1h. */
  peak7d: number
  peak30d: number
  deviceBreakdown: DeviceBreakdownItem[]
  referrerBreakdown: ReferrerBreakdownItem[]
  deviceConversionBreakdown: DeviceConversionItem[]
  referrerConversionBreakdown: ReferrerConversionItem[]
  visitTimingBreakdown: VisitTimingBreakdown
  accent?: string
  windowDays: number
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile', tablet: 'Tablette', desktop: 'Ordinateur', inconnu: 'Inconnu',
}

function ChangeBadge({ change, windowDays }: { change: PeriodChange; windowDays: number }) {
  if (change.direction === 'new') {
    return <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-1">Aucun visiteur sur les {windowDays} jours précédents</p>
  }
  if (change.pct === null || change.direction === 'flat') {
    return <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-1">Stable vs les {windowDays} jours précédents</p>
  }
  const positive = change.pct > 0
  return (
    <p className={`text-[11px] font-medium mt-1 ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
      {positive ? '+' : ''}{change.pct}% vs les {windowDays} jours précédents
    </p>
  )
}

function KpiTile({ icon: Icon, label, children, footer }: { icon: LucideIcon; label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <Icon size={18} strokeWidth={2} className="text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{children}</p>
      {footer}
    </div>
  )
}

function BreakdownList({ title, items, accent, icon: Icon }: {
  title: string
  items: { key: string; label: string; sessions: number; pct: number }[]
  accent: string
  icon: LucideIcon
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} strokeWidth={2} className="text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Pas encore de donnée sur cette période.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.key}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">{item.sessions} · {item.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(item.pct, 2)}%`, backgroundColor: accent }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConversionBreakdownList({ title, items, accent, icon: Icon }: {
  title: string
  items: { key: string; label: string; sessions: number; conversionRate: number }[]
  accent: string
  icon: LucideIcon
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} strokeWidth={2} className="text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Pas encore de donnée sur cette période.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.key}>
              <div className="flex items-center justify-between mb-1 text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                <span className="text-slate-500 dark:text-slate-400 tabular-nums">{item.conversionRate}% sur {item.sessions}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(item.conversionRate, 2)}%`, backgroundColor: accent }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VisitTimingCard({ timing, accent }: { timing: VisitTimingBreakdown; accent: string }) {
  const hasData = timing.byWeekday.some(d => d.sessions > 0)
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={16} strokeWidth={2} className="text-slate-400 dark:text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Quand vos visiteurs viennent</h3>
      </div>
      {!hasData ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 py-2">Pas encore de donnée sur cette période.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Le plus actif : <span className="font-medium text-slate-700 dark:text-slate-300">{timing.topWeekday}</span>
            {timing.topSlot && <> · <span className="font-medium text-slate-700 dark:text-slate-300">{timing.topSlot}</span></>}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              {timing.byWeekday.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(item.pct, item.sessions > 0 ? 2 : 0)}%`, backgroundColor: accent }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-slate-400 dark:text-slate-500 tabular-nums">{item.sessions}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {timing.bySlot.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(item.pct, 2)}%`, backgroundColor: accent }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-slate-400 dark:text-slate-500 tabular-nums">{item.sessions}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Vue d'ensemble de l'entonnoir : chiffres isolés (visiteurs, conversion, pic
// estimé) + répartitions par appareil et par source de trafic. Complète
// VisitFunnel (le détail étape par étape) sans le remplacer.
export default function FunnelInsights({
  visitorCount, visitorChange, conversionRate, peak7d, peak30d,
  deviceBreakdown, referrerBreakdown, deviceConversionBreakdown, referrerConversionBreakdown,
  visitTimingBreakdown, accent = '#2563eb', windowDays,
}: Props) {
  const deviceItems = deviceBreakdown.map(d => ({
    key: d.device, label: DEVICE_LABELS[d.device] ?? d.device, sessions: d.sessions, pct: d.pct,
  }))
  const referrerItems = referrerBreakdown.slice(0, 5).map(r => ({
    key: r.host, label: r.host === 'direct' ? 'Accès direct' : r.host, sessions: r.sessions, pct: r.pct,
  }))
  const deviceConversionItems = deviceConversionBreakdown.map(d => ({
    key: d.device, label: DEVICE_LABELS[d.device] ?? d.device, sessions: d.sessions, conversionRate: d.conversionRate,
  }))
  const referrerConversionItems = referrerConversionBreakdown.slice(0, 5).map(r => ({
    key: r.host, label: r.host === 'direct' ? 'Accès direct' : r.host, sessions: r.sessions, conversionRate: r.conversionRate,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiTile icon={Users} label="Visiteurs" footer={<ChangeBadge change={visitorChange} windowDays={windowDays} />}>
          {visitorCount}
        </KpiTile>
        <KpiTile icon={Percent} label="Taux de conversion">
          {conversionRate}%
        </KpiTile>
        <div className="col-span-2 md:col-span-1">
          <KpiTile
            icon={Activity}
            label="Pic simultané (est.)"
            footer={<p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Approximation sur 1h glissante, pas une mesure temps réel</p>}
          >
            <span className="text-2xl">{peak7d}<span className="text-sm font-medium text-slate-400"> /7j</span></span>
            <span className="text-slate-300 dark:text-slate-600 mx-1.5">·</span>
            <span className="text-2xl">{peak30d}<span className="text-sm font-medium text-slate-400"> /30j</span></span>
          </KpiTile>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BreakdownList title="Par appareil" items={deviceItems} accent={accent} icon={Smartphone} />
        <BreakdownList title="Par source de trafic" items={referrerItems} accent={accent} icon={Globe} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConversionBreakdownList title="Conversion par appareil" items={deviceConversionItems} accent={accent} icon={Smartphone} />
        <ConversionBreakdownList title="Conversion par source de trafic" items={referrerConversionItems} accent={accent} icon={Globe} />
      </div>

      <VisitTimingCard timing={visitTimingBreakdown} accent={accent} />
    </div>
  )
}
