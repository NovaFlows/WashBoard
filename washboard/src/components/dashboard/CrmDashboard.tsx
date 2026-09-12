'use client'

import { useRef, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ArrowDownRight, ArrowUpRight, BarChart3, Building2 } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import ClientProfileModal from '@/components/dashboard/ClientProfileModal'
import { buildClientProfile } from '@/lib/clientProfile'
import {
  getStatusKey, comptePourLeCA, effectivePrice, getLast6Months, resumeCrm, ecartRelatif,
} from '@/lib/crmStats'
import {
  isInCrmPeriod, isCrmPeriodInProgress, previousCrmPeriod, crmPeriodLabel, type CrmPeriodState,
} from '@/lib/crmPeriod'
import { formatHeure, FUSEAU } from '@/lib/dateUtils'

// Tableau de bord des réservations.
//
// Refondu le 2026-09-12 : la version précédente « faisait IA ». Quatre cartes
// pastel avec icône, deux anneaux multicolores aux pourcentages coupés, et un
// graphique à DEUX axes — réservations à gauche, euros à droite — dont
// l'alignement arbitraire suggérait une corrélation qui n'existe pas.
// Principes retenus : des indicateurs neutres comparés à la période
// précédente, une mesure par graphique, des barres plutôt que des anneaux, et
// chaque couleur de statut accompagnée de son libellé.

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

// Couleurs de STATUT : elles décrivent l'état d'une réservation, et ne servent
// jamais de couleur de série. Elles sont toujours accompagnées de leur libellé,
// la couleur seule ne porte pas l'information.
const STATUTS = {
  pending:     { label: 'En attente',    couleur: '#fab219' },
  confirmed:   { label: 'Confirmé',      couleur: '#2a78d6' },
  done:        { label: 'Terminé',       couleur: '#0ca30c' },
  closed_late: { label: 'Délai dépassé', couleur: '#ec835a' },
  cancelled:   { label: 'Annulé',        couleur: '#d03b3b' },
} as const
type CleStatut = keyof typeof STATUTS
const ORDRE_STATUTS: CleStatut[] = ['pending', 'confirmed', 'done', 'closed_late', 'cancelled']

// Une seule teinte par graphique. Le chiffre d'affaires, qui est ce qu'on
// vient regarder, porte la couleur ; les réservations restent en gris.
const TEINTE_CA = '#2563eb'
const TEINTE_VOLUME = '#94a3b8'

const MOIS_COURTS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const euros = (v: number) => `${nombre.format(Math.round(v))} €`

function dateCourte(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: FUSEAU })
}

// ── Indicateurs ─────────────────────────────────────────────────────────────

type Ecart = { valeur: number; unite: '%' | 'pts' } | null

function LigneEcart({ ecart, libelle }: { ecart: Ecart; libelle: string }) {
  if (!ecart) return null
  const hausse = ecart.valeur > 0
  const stable = ecart.valeur === 0
  const Fleche = hausse ? ArrowUpRight : ArrowDownRight
  const ton = stable
    ? 'text-slate-500 dark:text-slate-400'
    : hausse ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
  return (
    <p className={`mt-1 flex flex-wrap items-center gap-x-1 text-xs ${ton}`}>
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap font-medium">
        {!stable && <Fleche size={14} strokeWidth={2} aria-hidden />}
        {hausse ? '+' : ''}{nombre.format(ecart.valeur)}{ecart.unite === '%' ? ' %' : ' pts'}
      </span>
      <span className="text-slate-400 dark:text-slate-500">{libelle}</span>
    </p>
  )
}

function Indicateur({ label, valeur, detail, ecart, libelleEcart }: {
  label: string; valeur: string; detail?: string; ecart: Ecart; libelleEcart: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{valeur}</p>
      <LigneEcart ecart={ecart} libelle={libelleEcart} />
      {detail && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{detail}</p>}
    </div>
  )
}

// ── Graphique d'activité ────────────────────────────────────────────────────

type LigneActivite = { label: string; reservations: number; ca: number }

function InfoBulle({ active, payload, label, formater }: {
  active?: boolean; payload?: { value: number }[]; label?: string; formater: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  // La valeur d'abord : le lecteur sait déjà ce qu'il survole.
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{formater(payload[0].value)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  )
}

function Colonnes({ donnees, cle, teinte, formater, hauteur = 150 }: {
  donnees: LigneActivite[]; cle: 'reservations' | 'ca'; teinte: string; formater: (v: number) => string; hauteur?: number
}) {
  return (
    <div className="text-slate-400 dark:text-slate-600">
      <ResponsiveContainer width="100%" height={hauteur}>
        <BarChart data={donnees} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          {/* Lignes de fond pleines et discrètes, jamais en pointillé. */}
          <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.35} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                 interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={44}
                 tickCount={3} allowDecimals={false} tickFormatter={v => nombre.format(v)} />
          <Tooltip content={<InfoBulle formater={formater} />} cursor={{ fill: 'currentColor', fillOpacity: 0.12 }} />
          <Bar dataKey={cle} fill={teinte} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Export Excel ────────────────────────────────────────────────────────────

async function captureSvgAsBase64(container: HTMLDivElement | null): Promise<{ base64: string; srcW: number; srcH: number } | null> {
  const svg = container?.querySelector('svg')
  if (!svg) return null
  const rect = svg.getBoundingClientRect()
  const srcW = Math.round(rect.width) || 400
  const srcH = Math.round(rect.height) || 200

  const clone = svg.cloneNode(true) as SVGElement
  clone.setAttribute('width', String(srcW))
  clone.setAttribute('height', String(srcH))
  const fond = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  fond.setAttribute('width', String(srcW))
  fond.setAttribute('height', String(srcH))
  fond.setAttribute('fill', '#ffffff')
  clone.insertBefore(fond, clone.firstChild)

  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }))
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const ECHELLE = 3
      const canvas = document.createElement('canvas')
      canvas.width = srcW * ECHELLE
      canvas.height = srcH * ECHELLE
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve({ base64: canvas.toDataURL('image/png').replace('data:image/png;base64,', ''), srcW, srcH })
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

// ── Composant ───────────────────────────────────────────────────────────────

export default function CrmDashboard({ bookings, period }: { bookings: Booking[]; period: CrmPeriodState }) {
  const graphCaRef = useRef<HTMLDivElement>(null)
  const graphVolumeRef = useRef<HTMLDivElement>(null)
  const [exporting, setExporting] = useState(false)
  const [clientFilter, setClientFilter] = useState<'all' | 'individual' | 'professional'>('all')

  // Email du client dont la fiche est ouverte (null = aucune).
  const [openClient, setOpenClient] = useState<string | null>(null)
  const openProfile = openClient ? buildClientProfile(bookings, openClient) : null

  // L'instant présent, lu une seule fois au montage. Le lire à chaque rendu
  // rendrait le composant impur : le serveur et le navigateur pourraient
  // calculer deux instants différents.
  const [maintenant] = useState(() => Date.now())

  const correspondAuClient = (b: Booking) =>
    clientFilter === 'all' || (clientFilter === 'professional') === b.is_professional

  // Meme fonction que pour les statistiques de visite : les deux moities de
  // l'ecran portent forcement sur la meme periode.
  const displayBookings = bookings.filter(b => correspondAuClient(b) && isInCrmPeriod(new Date(b.scheduled_at), period))
  const isFiltered = clientFilter !== 'all'

  const resume = resumeCrm(displayBookings)

  // Période précédente, pour situer chaque indicateur. Sur « Tout », il n'y a
  // rien avant : les écarts ne s'affichent pas.
  const precedente = previousCrmPeriod(period)
  const resumePrecedent = precedente
    ? resumeCrm(bookings.filter(b => correspondAuClient(b) && isInCrmPeriod(new Date(b.scheduled_at), precedente)))
    : null
  const libelleEcart = !precedente ? ''
    : period.type === 'year'  ? `vs ${precedente.year}`
    : period.type === 'month' ? `vs ${crmPeriodLabel(precedente)}`
    : period.type === 'week'  ? 'vs semaine précédente'
    : 'vs la veille'
  // Une période en cours n'est pas terminée : ses chiffres vont encore bouger.
  // On le dit, plutôt que de laisser croire à un effondrement face à un mois
  // complet — septembre au 12 contre tout août, c'est « −100 % » qui ne veut rien dire.
  const enCours = isCrmPeriodInProgress(period, maintenant)

  const ecartPct = (a: number, b: number): Ecart => {
    if (!resumePrecedent) return null
    const e = ecartRelatif(a, b)
    return e === null ? null : { valeur: e, unite: '%' }
  }

  const chartData: LigneActivite[] | null = (() => {
    if (period.type === 'day') return null
    const ligne = (label: string, bs: Booking[]): LigneActivite => ({
      label,
      reservations: bs.length,
      ca: bs.filter(comptePourLeCA).reduce((s, b) => s + effectivePrice(b), 0),
    })

    if (period.type === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const jour = new Date(period.weekStart); jour.setDate(period.weekStart.getDate() + i)
        return ligne(JOURS_COURTS[i], displayBookings.filter(b => {
          const d = new Date(b.scheduled_at)
          return d.getFullYear() === jour.getFullYear() && d.getMonth() === jour.getMonth() && d.getDate() === jour.getDate()
        }))
      })
    }

    if (period.type === 'month') {
      const nbJours = new Date(period.year, period.month + 1, 0).getDate()
      return Array.from({ length: nbJours }, (_, i) => ligne(String(i + 1), displayBookings.filter(b => {
        const d = new Date(b.scheduled_at)
        return d.getFullYear() === period.year && d.getMonth() === period.month && d.getDate() === i + 1
      })))
    }

    const mois = period.type === 'year'
      ? Array.from({ length: 12 }, (_, i) => ({ year: period.year, month: i, label: MOIS_COURTS[i] }))
      : getLast6Months()
    return mois.map(({ year, month, label }) => ligne(label, displayBookings.filter(b => {
      const d = new Date(b.scheduled_at)
      return d.getFullYear() === year && d.getMonth() === month
    })))
  })()

  // Par prestation : volume, part du volume et chiffre d'affaires réalisé.
  const parPrestation = Object.values(
    displayBookings.reduce<Record<string, { nom: string; nombre: number; ca: number }>>((acc, b) => {
      const nom = b.services?.name ?? 'Prestation supprimée'
      acc[nom] ??= { nom, nombre: 0, ca: 0 }
      acc[nom].nombre++
      if (comptePourLeCA(b)) acc[nom].ca += effectivePrice(b)
      return acc
    }, {}),
  )
    .map(p => ({ ...p, part: resume.total ? Math.round((p.nombre / resume.total) * 100) : 0 }))
    .sort((a, b) => b.nombre - a.nombre)

  const parStatut = ORDRE_STATUTS.map(cle => {
    const n = displayBookings.filter(b => getStatusKey(b) === cle).length
    return { cle, ...STATUTS[cle], nombre: n, part: resume.total ? (n / resume.total) * 100 : 0 }
  }).filter(s => s.nombre > 0)

  const recentBookings = isFiltered ? displayBookings : displayBookings.slice(0, 6)

  const finSemaine = new Date(period.weekStart); finSemaine.setDate(period.weekStart.getDate() + 6)
  const titreFrise = period.type === 'year'  ? `${period.year}, par mois`
                   : period.type === 'month' ? `${MOIS_COURTS[period.month]} ${period.year}, par jour`
                   : period.type === 'week'  ? `Semaine du ${dateCourte(period.weekStart)} au ${dateCourte(finSemaine)}`
                   : '6 derniers mois'

  async function handleExport() {
    setExporting(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.creator = 'WashBoard'
      wb.created = new Date()

      // ── Feuille 1 : les réservations ─────────────────────────────────────
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
      const entete = ws.getRow(1)
      entete.height = 24
      entete.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
        cell.alignment = { vertical: 'middle' }
      })
      ws.views = [{ state: 'frozen', ySplit: 1 }]
      displayBookings.forEach(b => {
        const row = ws.addRow({
          clienttype: b.is_professional ? 'Professionnel' : 'Particulier',
          name:       b.client_name,
          company:    b.company_name ?? '',
          email:      b.client_email,
          phone:      b.client_phone ?? '',
          service:    b.services?.name ?? '',
          price:      effectivePrice(b),
          duration:   b.services?.duration_minutes ?? '',
          scheduled:  new Date(b.scheduled_at).toLocaleString('fr-FR', { timeZone: FUSEAU }),
          address:    b.address ?? '',
          status:     STATUTS[getStatusKey(b) as CleStatut]?.label ?? b.status,
          created:    new Date(b.created_at).toLocaleDateString('fr-FR', { timeZone: FUSEAU }),
        })
        row.getCell('price').numFmt = '#,##0.00'
      })

      // ── Feuille 2 : la synthèse ──────────────────────────────────────────
      // Les répartitions sont écrites en vrais tableaux, que l'on peut trier
      // et recalculer ; seules les deux frises restent des images.
      const cs = wb.addWorksheet('Synthèse')
      cs.columns = [{ width: 30 }, { width: 14 }, { width: 10 }, { width: 14 }]
      const titre = (ligne: number, texte: string) => {
        cs.getCell(`A${ligne}`).value = texte
        cs.getCell(`A${ligne}`).font = { bold: true, size: 11 }
      }
      const tableau = (ligne: number, entetes: string[], lignes: (string | number)[][]) => {
        cs.getRow(ligne).values = entetes
        cs.getRow(ligne).font = { bold: true, color: { argb: 'FF475569' } }
        lignes.forEach((l, i) => { cs.getRow(ligne + 1 + i).values = l })
        return ligne + lignes.length + 2
      }

      cs.getCell('A1').value = `Synthèse — ${crmPeriodLabel(period)}`
      cs.getCell('A1').font = { bold: true, size: 14 }
      let ligne = tableau(3, ['Indicateur', 'Valeur'], [
        ["Chiffre d'affaires (€)", Math.round(resume.ca)],
        ['Réservations', resume.total],
        ['dont en attente', resume.enAttente],
        ['Panier moyen (€)', Math.round(resume.panierMoyen)],
        ['Taux de confirmation (%)', resume.tauxConfirmation],
      ])

      titre(ligne, 'Par prestation')
      ligne = tableau(ligne + 1, ['Prestation', 'Réservations', 'Part (%)', 'CA (€)'],
        parPrestation.map(p => [p.nom, p.nombre, p.part, Math.round(p.ca)]))

      titre(ligne, 'Par statut')
      ligne = tableau(ligne + 1, ['Statut', 'Réservations', 'Part (%)'],
        parStatut.map(s => [s.label, s.nombre, Math.round(s.part)]))

      const [imgCa, imgVolume] = await Promise.all([
        captureSvgAsBase64(graphCaRef.current),
        captureSvgAsBase64(graphVolumeRef.current),
      ])
      const LARGEUR = 620
      for (const [img, libelle] of [[imgCa, "Chiffre d'affaires"], [imgVolume, 'Réservations']] as const) {
        if (!img) continue
        titre(ligne, `${libelle} — ${titreFrise}`)
        const hauteur = Math.round((img.srcH / img.srcW) * LARGEUR)
        const id = wb.addImage({ base64: img.base64, extension: 'png' })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cs.addImage(id, { tl: { col: 0, row: ligne }, ext: { width: LARGEUR, height: hauteur } } as any)
        ligne += Math.ceil(hauteur / 20) + 3
      }

      const buffer = await wb.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `reservations_${new Date().toISOString().slice(0, 10)}.xlsx`
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

  const carte = 'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'

  return (
    <div className="space-y-4">
      {/* En-tête et filtre client, sur une seule ligne au-dessus de tout ce
          qu'ils filtrent. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Tableau de bord de vos réservations · {crmPeriodLabel(period).toLowerCase()}{enCours ? ', en cours' : ''} · {nombre.format(resume.total)} résultat{resume.total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800" role="group" aria-label="Type de client">
            {(['all', 'individual', 'professional'] as const).map(f => (
              <button key={f} onClick={() => setClientFilter(f)} aria-pressed={clientFilter === f}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  clientFilter === f
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}>
                {f === 'all' ? 'Tous' : f === 'individual' ? 'Particuliers' : 'Professionnels'}
              </button>
            ))}
          </div>
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:text-slate-400">
            {exporting ? <><Spinner /> Export en cours…</> : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exporter Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicateur label="Chiffre d'affaires" valeur={euros(resume.ca)}
          ecart={ecartPct(resume.ca, resumePrecedent?.ca ?? 0)} libelleEcart={libelleEcart}
          detail="Réservations confirmées et terminées" />
        <Indicateur label="Réservations" valeur={nombre.format(resume.total)}
          ecart={ecartPct(resume.total, resumePrecedent?.total ?? 0)} libelleEcart={libelleEcart}
          detail={resume.enAttente > 0 ? `dont ${nombre.format(resume.enAttente)} en attente` : 'Aucune en attente'} />
        <Indicateur label="Panier moyen" valeur={euros(resume.panierMoyen)}
          ecart={ecartPct(resume.panierMoyen, resumePrecedent?.panierMoyen ?? 0)} libelleEcart={libelleEcart}
          detail="Par réservation confirmée ou terminée" />
        <Indicateur label="Taux de confirmation" valeur={`${resume.tauxConfirmation} %`}
          ecart={resumePrecedent && resumePrecedent.total > 0
            ? { valeur: resume.tauxConfirmation - resumePrecedent.tauxConfirmation, unite: 'pts' } : null}
          libelleEcart={libelleEcart}
          detail="Confirmées ou terminées, sur le total" />
      </div>

      {/* Activité : une mesure par graphique, sur la même frise. */}
      {chartData !== null && (
        <div className={`${carte} p-4 sm:p-5`}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Chiffre d&apos;affaires</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">{titreFrise}</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            En euros, hors réservations en attente ou annulées
          </p>
          <div ref={graphCaRef}>
            {chartData.some(l => l.ca > 0) ? (
              <Colonnes donnees={chartData} cle="ca" teinte={TEINTE_CA} formater={euros} />
            ) : (
              // Un graphique vide gradué « 0 – 1 – 2 € » ne dit rien : on l'écrit.
              <div className="h-[150px] flex flex-col items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800/40 px-4 text-center">
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Aucun chiffre d&apos;affaires réalisé sur cette période</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Une réservation en attente n&apos;y compte qu&apos;une fois confirmée</p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Réservations</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Toutes, quel que soit leur statut</p>
            <div ref={graphVolumeRef}>
              <Colonnes donnees={chartData} cle="reservations" teinte={TEINTE_VOLUME}
                formater={v => `${nombre.format(v)} réservation${v > 1 ? 's' : ''}`} hauteur={110} />
            </div>
          </div>

          {/* Les valeurs exactes, sans avoir à survoler chaque barre. */}
          <details className="mt-4 group">
            <summary className="text-xs font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200">
              Afficher les valeurs
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-1.5 font-medium">Période</th>
                    <th className="py-1.5 font-medium text-right">Réservations</th>
                    <th className="py-1.5 font-medium text-right">CA</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums text-slate-700 dark:text-slate-300">
                  {chartData.filter(l => l.reservations > 0).map(l => (
                    <tr key={l.label} className="border-b border-slate-50 dark:border-slate-800/60 last:border-0">
                      <td className="py-1.5">{l.label}</td>
                      <td className="py-1.5 text-right">{nombre.format(l.reservations)}</td>
                      <td className="py-1.5 text-right">{euros(l.ca)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Par prestation */}
        <div className={`${carte} p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Par prestation</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Réservations, part du total et chiffre d&apos;affaires</p>
          {parPrestation.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Aucune donnée</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {parPrestation.map(p => (
                <li key={p.nom} className="py-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-slate-700 dark:text-slate-200">{p.nom}</span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{nombre.format(p.nombre)}</span>
                      <span className="inline-block w-12 text-right text-slate-400 dark:text-slate-500">{p.part} %</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="flex-1 h-1 rounded bg-slate-100 dark:bg-slate-800">
                      <div className="h-1 rounded" style={{ width: `${Math.max(p.part, 2)}%`, backgroundColor: TEINTE_VOLUME }} />
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">{euros(p.ca)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Par statut */}
        <div className={`${carte} p-4 sm:p-5`}>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Par statut</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Où en sont les réservations de la période</p>
          {parStatut.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">Aucune donnée</p>
          ) : (
            <>
              {/* Une barre empilée : la part de chaque statut se lit d'un coup
                  d'œil, sans les pourcentages coupés d'un anneau. */}
              <div className="flex h-2.5 gap-0.5" role="img"
                   aria-label={parStatut.map(s => `${s.label} ${Math.round(s.part)} %`).join(', ')}>
                {parStatut.map((s, i) => (
                  <div key={s.cle} title={`${s.label} : ${s.nombre}`}
                       className={`${i === 0 ? 'rounded-l' : ''} ${i === parStatut.length - 1 ? 'rounded-r' : ''}`}
                       style={{ width: `${s.part}%`, backgroundColor: s.couleur }} />
                ))}
              </div>
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                {parStatut.map(s => (
                  <li key={s.cle} className="flex items-center justify-between py-2 text-sm">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.couleur }} aria-hidden />
                      {s.label}
                    </span>
                    <span className="tabular-nums">
                      <span className="font-medium text-slate-900 dark:text-slate-100">{nombre.format(s.nombre)}</span>
                      <span className="inline-block w-12 text-right text-slate-400 dark:text-slate-500">{Math.round(s.part)} %</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* Réservations */}
      <div className={`${carte} p-4 sm:p-5`}>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isFiltered ? 'Réservations filtrées' : 'Dernières réservations'}
          </h2>
          {isFiltered && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{nombre.format(resume.total)} résultat{resume.total !== 1 ? 's' : ''}</span>
          )}
        </div>

        {recentBookings.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Aucune réservation dans cette catégorie</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentBookings.map(b => {
              const statut = STATUTS[getStatusKey(b) as CleStatut]
              const date = new Date(b.scheduled_at)
              return (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenClient(b.client_email)}
                    aria-label={`Voir la fiche de ${b.client_name}`}
                    title="Voir la fiche client"
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-500 shrink-0 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1651E8]"
                  >
                    {b.is_professional ? <Building2 size={15} strokeWidth={2} /> : b.client_name.charAt(0).toUpperCase()}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {b.is_professional && b.company_name ? b.company_name : b.client_name}
                      </p>
                      {b.is_professional && (
                        <span className="shrink-0 px-1 rounded text-[10px] font-semibold tracking-wide text-slate-500 border border-slate-200 dark:border-slate-700">PRO</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {b.is_professional && b.company_name ? b.client_name + ' · ' : ''}{b.services?.name ?? '—'} · {dateCourte(date)} à {formatHeure(date)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">{euros(effectivePrice(b))}</p>
                    {statut && (
                      <p className="flex items-center justify-end gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: statut.couleur }} aria-hidden />
                        {statut.label}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {openProfile && (
        <ClientProfileModal profile={openProfile} onClose={() => setOpenClient(null)} />
      )}
    </div>
  )
}
