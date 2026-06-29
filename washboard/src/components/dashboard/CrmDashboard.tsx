'use client'

import { useRef, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Hourglass, ClipboardList, Euro, CheckCircle2, BarChart3, Building2, type LucideIcon } from 'lucide-react'

type Service = { name: string; price: number; duration_minutes: number }
type Booking = {
  id: string
  client_name: string
  client_email: string
  client_phone: string
  address: string
  scheduled_at: string
  created_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'done'
  closed_late: boolean
  booked_price: number | null
  is_professional: boolean
  company_name: string | null
  services: Service | null
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string; hex: string }> = {
  pending:     { bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-400',   label: 'En attente',    hex: '#f59e0b' },
  confirmed:   { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', label: 'Confirmé',    hex: '#10b981' },
  done:        { bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-400',     label: 'Terminé',      hex: '#3b82f6' },
  cancelled:   { bg: 'bg-red-100 dark:bg-red-900/40',         text: 'text-red-700 dark:text-red-400',       label: 'Annulé',       hex: '#ef4444' },
  closed_late: { bg: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-700 dark:text-orange-400', label: 'Délai dépassé', hex: '#f97316' },
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', done: 'Terminé', cancelled: 'Annulé', closed_late: 'Délai dépassé',
}

function getStatusKey(b: Booking) {
  return b.closed_late ? 'closed_late' : b.status
}

function effectivePrice(b: Booking) {
  return b.booked_price ?? b.services?.price ?? 0
}

const CHART_COLORS = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#e11d48', '#0891b2']
const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function getLast6Months() {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({ year: d.getFullYear(), month: d.getMonth(), label: MONTHS_FR[d.getMonth()] })
  }
  return result
}

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-slate-600 dark:text-slate-400">
          {p.name ? `${p.name} : ` : ''}
          <span className="font-bold text-slate-900 dark:text-slate-100">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pct: number } }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 dark:text-slate-300">{payload[0].name}</p>
      <p className="text-slate-900 dark:text-slate-100 font-bold">
        {payload[0].value}{' '}
        <span className="font-normal text-slate-400">({payload[0].payload.pct}%)</span>
      </p>
    </div>
  )
}

type LegendItem = { color: string; label: string; pct: number }

// Percentage labels rendered inside the SVG on each pie slice (visible in app + Excel)
function PiePercentLabel({ cx = 0, cy = 0, midAngle = 0, outerRadius = 0, percent = 0 }: {
  cx?: number; cy?: number; midAngle?: number; outerRadius?: number; percent?: number
}) {
  const pct = Math.round(percent * 100)
  if (pct < 5) return null
  const RADIAN = Math.PI / 180
  const r = outerRadius + 22
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#475569" textAnchor={x > cx ? 'start' : 'end'}
          dominantBaseline="central" fontSize={10} fontWeight="600">
      {pct}%
    </text>
  )
}

async function captureSvgAsBase64(
  container: HTMLDivElement | null,
  legend?: LegendItem[],
): Promise<{ base64: string; srcW: number; srcH: number } | null> {
  if (!container) return null
  const svg = container.querySelector('svg')
  if (!svg) return null

  // Use the SVG's own rendered dimensions (not the container)
  const rect = svg.getBoundingClientRect()
  const srcW = Math.round(rect.width) || 400
  const srcH = Math.round(rect.height) || 300

  // Extra height for the injected legend
  const LEGEND_ROW_H = 22
  const LEGEND_PAD   = 12
  const legendH = legend && legend.length > 0 ? legend.length * LEGEND_ROW_H + LEGEND_PAD * 2 : 0
  const totalH  = srcH + legendH

  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute('width',  String(srcW))
  clone.setAttribute('height', String(totalH))

  // Explicit white background
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bg.setAttribute('x', '0')
  bg.setAttribute('y', '0')
  bg.setAttribute('width',  String(srcW))
  bg.setAttribute('height', String(totalH))
  bg.setAttribute('fill', '#ffffff')
  clone.insertBefore(bg, clone.firstChild)

  // Inject SVG legend below the chart
  if (legend && legend.length > 0) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const startX = Math.max(10, srcW / 2 - 90)
    g.setAttribute('transform', `translate(${startX}, ${srcH + LEGEND_PAD})`)

    legend.forEach((item, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('cx', '6')
      circle.setAttribute('cy', String(i * LEGEND_ROW_H + 6))
      circle.setAttribute('r', '6')
      circle.setAttribute('fill', item.color)

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', '18')
      text.setAttribute('y', String(i * LEGEND_ROW_H + 11))
      text.setAttribute('font-size', '12')
      text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
      text.setAttribute('fill', '#374151')
      text.textContent = `${item.label}  —  ${item.pct}%`

      g.appendChild(circle)
      g.appendChild(text)
    })

    clone.appendChild(g)
  }

  const svgStr = new XMLSerializer().serializeToString(clone)
  const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url    = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const SCALE = 3
      const canvas = document.createElement('canvas')
      canvas.width  = srcW   * SCALE
      canvas.height = totalH * SCALE
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ base64: canvas.toDataURL('image/png').replace('data:image/png;base64,', ''), srcW, srcH: totalH })
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export default function CrmDashboard({ bookings }: { bookings: Booking[] }) {
  const barChartRef = useRef<HTMLDivElement>(null)
  const pieServiceRef = useRef<HTMLDivElement>(null)
  const pieStatusRef = useRef<HTMLDivElement>(null)
  const [exporting,         setExporting]         = useState(false)
  const [clientFilter,      setClientFilter]      = useState<'all' | 'individual' | 'professional'>('all')
  const [periodType,        setPeriodType]        = useState<'all' | 'year' | 'month' | 'week' | 'day'>('all')
  const [selectedYear,      setSelectedYear]      = useState(() => new Date().getFullYear())
  const [selectedMonth,     setSelectedMonth]     = useState(() => new Date().getMonth())
  const [selectedWeekStart, setSelectedWeekStart] = useState(() => getMondayOf(new Date()))
  const [selectedDay,       setSelectedDay]       = useState(() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`
  })

  const availableYears = [...new Set(bookings.map(b => new Date(b.scheduled_at).getFullYear()))].sort((a, b) => b - a)

  const displayBookings = bookings.filter(b => {
    const d = new Date(b.scheduled_at)
    if (clientFilter === 'individual'   && b.is_professional)  return false
    if (clientFilter === 'professional' && !b.is_professional) return false
    switch (periodType) {
      case 'year':
        if (d.getFullYear() !== selectedYear) return false
        break
      case 'month':
        if (d.getFullYear() !== selectedYear || d.getMonth() !== selectedMonth) return false
        break
      case 'week': {
        const weekEnd = new Date(selectedWeekStart); weekEnd.setDate(selectedWeekStart.getDate() + 7)
        if (d < selectedWeekStart || d >= weekEnd) return false
        break
      }
      case 'day': {
        const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        if (ds !== selectedDay) return false
        break
      }
    }
    return true
  })

  const isFiltered = clientFilter !== 'all' || periodType !== 'all'

  function resetFilters() {
    setClientFilter('all')
    setPeriodType('all')
  }

  const total    = displayBookings.length
  const revenue  = displayBookings
    .filter(b => b.status === 'confirmed' || b.status === 'done')
    .reduce((sum, b) => sum + effectivePrice(b), 0)
  const pending  = displayBookings.filter(b => b.status === 'pending').length
  const done     = displayBookings.filter(b => b.status === 'done' || b.status === 'confirmed').length
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

  const chartData = (() => {
    if (periodType === 'day') return null

    if (periodType === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(selectedWeekStart); day.setDate(selectedWeekStart.getDate() + i)
        const bs  = displayBookings.filter(b => {
          const d = new Date(b.scheduled_at)
          return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate()
        })
        return { label: DAYS_FR[i], Réservations: bs.length, CA: bs.filter(b => b.status === 'confirmed' || b.status === 'done').reduce((s, b) => s + effectivePrice(b), 0) }
      })
    }

    if (periodType === 'month') {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
      return Array.from({ length: daysInMonth }, (_, i) => {
        const dayN = i + 1
        const bs   = displayBookings.filter(b => { const d = new Date(b.scheduled_at); return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth && d.getDate() === dayN })
        return { label: String(dayN), Réservations: bs.length, CA: bs.filter(b => b.status === 'confirmed' || b.status === 'done').reduce((s, b) => s + effectivePrice(b), 0) }
      })
    }

    const months = periodType === 'year'
      ? Array.from({ length: 12 }, (_, i) => ({ year: selectedYear, month: i, label: MONTHS_FR[i] }))
      : getLast6Months()
    return months.map(({ year, month, label }) => ({
      label,
      Réservations: displayBookings.filter(b => { const d = new Date(b.scheduled_at); return d.getFullYear() === year && d.getMonth() === month }).length,
      CA: displayBookings.filter(b => { const d = new Date(b.scheduled_at); return d.getFullYear() === year && d.getMonth() === month && (b.status === 'confirmed' || b.status === 'done') }).reduce((sum, b) => sum + effectivePrice(b), 0),
    }))
  })()

  const serviceMap: Record<string, number> = {}
  displayBookings.forEach(b => {
    const name = b.services?.name ?? 'Inconnu'
    serviceMap[name] = (serviceMap[name] ?? 0) + 1
  })
  const serviceData = Object.entries(serviceMap)
    .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value)

  const statusData = (
    ['pending', 'confirmed', 'done', 'closed_late', 'cancelled'] as const
  ).map(key => {
    const count = key === 'done'
      ? displayBookings.filter(b => b.status === 'done' && !b.closed_late).length
      : key === 'closed_late'
        ? displayBookings.filter(b => b.closed_late).length
        : displayBookings.filter(b => b.status === key).length
    return {
      name: STATUS_COLORS[key].label,
      value: count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      hex: STATUS_COLORS[key].hex,
    }
  }).filter(d => d.value > 0)

  const recentBookings = isFiltered ? displayBookings : displayBookings.slice(0, 6)

  const kpis: { label: string; value: number; suffix: string; color: string; icon: LucideIcon }[] = [
    { label: 'En attente',         value: pending,        suffix: '',  color: 'amber',   icon: Hourglass },
    { label: 'Total réservations', value: total,          suffix: '',  color: 'blue',    icon: ClipboardList },
    { label: "Chiffre d'affaires", value: revenue,        suffix: '€', color: 'emerald', icon: Euro },
    { label: 'Taux de succès',     value: completionRate, suffix: '%', color: 'purple',  icon: CheckCircle2 },
  ]

  const kpiColors: Record<string, string> = {
    blue:    'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
    amber:   'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    purple:  'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400',
  }

  async function handleExport() {
    setExporting(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.creator = 'WashBoard'
      wb.created = new Date()

      // ── Feuille 1 : Données ──────────────────────────────────────────────
      const ws = wb.addWorksheet('Réservations')
      ws.columns = [
        { header: 'Type',        key: 'clienttype', width: 16 },
        { header: 'Nom',         key: 'name',       width: 22 },
        { header: 'Société',     key: 'company',    width: 22 },
        { header: 'Email',       key: 'email',      width: 32 },
        { header: 'Téléphone',   key: 'phone',      width: 16 },
        { header: 'Prestation',  key: 'service',    width: 24 },
        { header: 'Prix (€)',    key: 'price',      width: 12 },
        { header: 'Durée (min)', key: 'duration',   width: 14 },
        { header: 'Date RDV',    key: 'scheduled',  width: 22 },
        { header: 'Adresse',     key: 'address',    width: 40 },
        { header: 'Statut',      key: 'status',     width: 14 },
        { header: 'Créé le',     key: 'created',    width: 14 },
      ]

      // En-tête stylisé
      const headerRow = ws.getRow(1)
      headerRow.height = 26
      headerRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border    = { bottom: { style: 'thin', color: { argb: 'FF1E40AF' } } }
      })
      ws.views = [{ state: 'frozen', ySplit: 1 }]

      // Données
      displayBookings.forEach((b, idx) => {
        const row = ws.addRow({
          clienttype: b.is_professional ? 'Professionnel' : 'Particulier',
          name:       b.client_name,
          company:    b.company_name ?? '',
          email:      b.client_email,
          phone:      b.client_phone ?? '',
          service:    b.services?.name ?? '',
          price:      effectivePrice(b),
          duration:   b.services?.duration_minutes ?? '',
          scheduled:  new Date(b.scheduled_at).toLocaleString('fr-FR'),
          address:    b.address ?? '',
          status:     STATUS_LABELS[getStatusKey(b)] ?? b.status,
          created:    new Date(b.created_at).toLocaleDateString('fr-FR'),
        })
        row.height = 20
        if (idx % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F6FF' } }
          })
        }
        row.getCell('price').numFmt    = '#,##0.00'
        row.getCell('price').alignment = { horizontal: 'right' }
      })

      // ── Feuille 2 : Graphiques ───────────────────────────────────────────
      const cs = wb.addWorksheet('Graphiques')
      cs.getCell('A1').value = 'Graphiques — WashBoard CRM'
      cs.getCell('A1').font  = { bold: true, size: 14, color: { argb: 'FF2563EB' } }
      cs.getRow(1).height    = 30

      // Capture parallèle — on injecte la légende dans les camemberts
      const [barCapture, svcCapture, stCapture] = await Promise.all([
        captureSvgAsBase64(barChartRef.current),
        captureSvgAsBase64(
          pieServiceRef.current,
          serviceData.map((d, i) => ({ color: CHART_COLORS[i % CHART_COLORS.length], label: d.name, pct: d.pct })),
        ),
        captureSvgAsBase64(
          pieStatusRef.current,
          statusData.map(d => ({ color: d.hex, label: d.name, pct: d.pct })),
        ),
      ])

      // Tailles d'export cibles (pixels dans Excel)
      const BAR_W = 660
      const PIE_W = 320

      // Graphique barres — titre ligne 3, image à partir de ligne 4 (0-indexed row 3)
      cs.getCell('A3').value = 'Activité mensuelle (6 derniers mois)'
      cs.getCell('A3').font  = { bold: true, size: 11 }
      if (barCapture) {
        const barH = Math.round(barCapture.srcH / barCapture.srcW * BAR_W)
        const id = wb.addImage({ base64: barCapture.base64, extension: 'png' })
        // ext respecte le ratio exact du SVG capturé
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cs.addImage(id, { tl: { col: 0, row: 3 }, ext: { width: BAR_W, height: barH } } as any)
      }

      // Camemberts — titre ligne 23, images à partir de ligne 24 (0-indexed row 23)
      cs.getCell('A23').value = 'Répartition par prestation'
      cs.getCell('A23').font  = { bold: true, size: 11 }
      cs.getCell('F23').value = 'Répartition par statut'
      cs.getCell('F23').font  = { bold: true, size: 11 }
      if (svcCapture) {
        const pieH = Math.round(svcCapture.srcH / svcCapture.srcW * PIE_W)
        const id = wb.addImage({ base64: svcCapture.base64, extension: 'png' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cs.addImage(id, { tl: { col: 0, row: 23 }, ext: { width: PIE_W, height: pieH } } as any)
      }
      if (stCapture) {
        const pieH = Math.round(stCapture.srcH / stCapture.srcW * PIE_W)
        const id = wb.addImage({ base64: stCapture.base64, extension: 'png' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cs.addImage(id, { tl: { col: 5, row: 23 }, ext: { width: PIE_W, height: pieH } } as any)
      }

      // Téléchargement
      const buffer = await wb.xlsx.writeBuffer()
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href       = url
      a.download   = `reservations_${new Date().toISOString().slice(0, 10)}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-16">
        <BarChart3 size={40} strokeWidth={1.5} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">Pas encore de données</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">Les statistiques apparaîtront dès votre première réservation</p>
      </div>
    )
  }

  const weekEnd       = new Date(selectedWeekStart); weekEnd.setDate(selectedWeekStart.getDate() + 6)
  const chartTitle    = periodType === 'year'  ? `Activité ${selectedYear}`
                      : periodType === 'month' ? `${MONTHS_FR[selectedMonth]} ${selectedYear}`
                      : periodType === 'week'  ? `Sem. du ${shortDate(selectedWeekStart)} au ${shortDate(weekEnd)}`
                      : periodType === 'day'   ? selectedDay
                      : '6 derniers mois'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tableau de bord de vos réservations</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {exporting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Export en cours...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exporter Excel
            </>
          )}
        </button>
      </div>

      {/* Slicers */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">

        {/* Ligne 1 : client type (filtre principal) */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-16 shrink-0">Client</span>
          <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {(['all', 'individual', 'professional'] as const).map(f => (
              <button key={f} onClick={() => setClientFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  clientFilter === f
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
                {f === 'all' ? 'Tous' : f === 'individual' ? 'Particuliers' : 'Professionnels'}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium">
            {total} résultat{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Séparateur */}
        <div className="border-t border-slate-100 dark:border-slate-800" />

        {/* Ligne 2 : période */}
        <div className="flex items-start gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-16 shrink-0 pt-1.5">Période</span>
          <div className="flex flex-col gap-2 flex-1">

            {/* Type de période */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              {(['all', 'year', 'month', 'week', 'day'] as const).map(p => (
                <button key={p} onClick={() => setPeriodType(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    periodType === p
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}>
                  {p === 'all' ? 'Tout' : p === 'year' ? 'Année' : p === 'month' ? 'Mois' : p === 'week' ? 'Semaine' : 'Jour'}
                </button>
              ))}
            </div>

            {/* Sélecteur de valeur — Année */}
            {periodType === 'year' && (
              <div className="flex gap-1.5 flex-wrap">
                {availableYears.map(y => (
                  <button key={y} onClick={() => setSelectedYear(y)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
                      selectedYear === y
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}>
                    {y}
                  </button>
                ))}
              </div>
            )}

            {/* Sélecteur de valeur — Mois */}
            {periodType === 'month' && (
              <div className="flex flex-col gap-2">
                {/* Sélecteur d'année en ligne */}
                <div className="flex gap-1.5 flex-wrap">
                  {availableYears.map(y => (
                    <button key={y} onClick={() => setSelectedYear(y)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border-2 transition-all ${
                        selectedYear === y
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                      }`}>
                      {y}
                    </button>
                  ))}
                </div>
                {/* 12 mois */}
                <div className="flex gap-1.5 flex-wrap">
                  {MONTHS_FR.map((m, i) => (
                    <button key={i} onClick={() => setSelectedMonth(i)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all min-w-[40px] text-center ${
                        selectedMonth === i
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sélecteur de valeur — Semaine */}
            {periodType === 'week' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d })}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <div className="px-4 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                  {shortDate(selectedWeekStart)} — {shortDate(weekEnd)}
                </div>
                <button
                  onClick={() => setSelectedWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d })}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            )}

            {/* Sélecteur de valeur — Jour */}
            {periodType === 'day' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDay(prev => { const d = new Date(prev); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={e => e.target.value && setSelectedDay(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-xs font-semibold text-blue-700 dark:text-blue-400 focus:outline-none"
                />
                <button
                  onClick={() => setSelectedDay(prev => { const d = new Date(prev); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Réinitialiser */}
        {isFiltered && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex justify-end">
            <button onClick={resetFilters}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              Réinitialiser les filtres
            </button>
          </div>
        )}

      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-2xl border p-4 ${kpiColors[kpi.color]}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium opacity-70">{kpi.label}</p>
              <kpi.icon size={18} strokeWidth={2} className="opacity-70" />
            </div>
            <p className="text-3xl font-extrabold tracking-tight">
              {kpi.value}{kpi.suffix}
            </p>
          </div>
        ))}
      </div>

      {/* Graphique barres — masqué en vue Jour */}
      {chartData !== null && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Activité — {chartTitle}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Réservations et chiffre d&apos;affaires</p>
          <div ref={barChartRef}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={24} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} unit="€" />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left"  dataKey="Réservations" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar yAxisId="right" dataKey="CA"           fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs text-slate-500 dark:text-slate-400">Réservations</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-slate-500 dark:text-slate-400">CA (€)</span></div>
          </div>
        </div>
      )}

      {/* Camemberts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Par prestation</h2>
          {serviceData.length > 0 ? (
            <>
              <div ref={pieServiceRef}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={serviceData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                         paddingAngle={3} dataKey="value"
                         label={PiePercentLabel} labelLine={false}>
                      {serviceData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {serviceData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-slate-600 dark:text-slate-400 truncate">{d.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">Aucune donnée</p>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Par statut</h2>
          {statusData.length > 0 ? (
            <>
              <div ref={pieStatusRef}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                         paddingAngle={3} dataKey="value"
                         label={PiePercentLabel} labelLine={false}>
                      {statusData.map((d, i) => <Cell key={i} fill={d.hex} />)}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {statusData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.hex }} />
                      <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center py-8">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* Clients — liste filtrée */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isFiltered ? `Réservations filtrées` : 'Dernières réservations'}
          </h2>
          {isFiltered && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{total} résultat{total !== 1 ? 's' : ''}</span>
          )}
        </div>

        {recentBookings.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Aucune réservation dans cette catégorie</p>
        ) : (
          <div className="space-y-2">
            {recentBookings.map(b => {
              const s    = STATUS_COLORS[getStatusKey(b)]
              const date = new Date(b.scheduled_at)
              return (
                <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0">
                    {b.is_professional ? <Building2 size={16} strokeWidth={2} /> : b.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {b.is_professional && b.company_name ? b.company_name : b.client_name}
                      </p>
                      {b.is_professional && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">PRO</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {b.is_professional && b.company_name ? b.client_name + ' · ' : ''}{b.services?.name ?? '—'} · {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-300">{effectivePrice(b)}€</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
