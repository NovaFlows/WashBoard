'use client'

import { useState, useEffect, useCallback } from 'react'

type PeriodType = 'jour' | 'semaine' | 'mois' | 'annee'

type Expense = {
  id: string
  date: string
  category: string
  label: string
  amount: number
  recurring_expense_id?: string | null
}

type RecurringExpense = {
  id: string
  category: string
  label: string
  amount: number
  day_of_month: number
  active: boolean
}

type MonthSummary = {
  month: number
  revenue: number
  expenses: number
}

const CATEGORIES = [
  { value: 'carburant',  label: 'Carburant' },
  { value: 'produits',   label: 'Produits' },
  { value: 'equipement', label: 'Équipement' },
  { value: 'abonnement', label: 'Abonnements' },
  { value: 'autre',      label: 'Autre' },
]

const CAT_COLORS: Record<string, string> = {
  carburant:  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  produits:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  equipement: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  abonnement: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  autre:      'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
}

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function getMondayOf(d: Date): Date {
  const r = new Date(d)
  r.setHours(0,0,0,0)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  return r
}

function getPeriodRange(type: PeriodType, ref: Date): { start: string; end: string; label: string } {
  const d = new Date(ref)
  if (type === 'jour') {
    const s = toISO(d)
    return { start: s, end: s, label: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  }
  if (type === 'semaine') {
    const mon = getMondayOf(d)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return {
      start: toISO(mon), end: toISO(sun),
      label: `${mon.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${sun.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    }
  }
  if (type === 'mois') {
    const y = d.getFullYear(); const m = d.getMonth()
    const last = new Date(y, m + 1, 0).getDate()
    return {
      start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
      end:   `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
      label: new Date(y, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    }
  }
  // annee
  const y = d.getFullYear()
  return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y) }
}

function navigate(type: PeriodType, ref: Date, dir: 1 | -1): Date {
  const d = new Date(ref)
  switch (type) {
    case 'jour':    d.setDate(d.getDate() + dir); break
    case 'semaine': d.setDate(d.getDate() + dir * 7); break
    case 'mois':    d.setMonth(d.getMonth() + dir); break
    case 'annee':   d.setFullYear(d.getFullYear() + dir); break
  }
  return d
}

function isToday(ref: Date, type: PeriodType): boolean {
  const now = new Date()
  if (type === 'jour')    return toISO(ref) === toISO(now)
  if (type === 'semaine') return toISO(getMondayOf(ref)) === toISO(getMondayOf(now))
  if (type === 'mois')    return ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth()
  if (type === 'annee')   return ref.getFullYear() === now.getFullYear()
  return false
}

type Props = { initialRevenue: number; washerId: string }

export default function ComptaDashboard({ initialRevenue }: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>('mois')
  const [refDate,    setRefDate]    = useState(new Date())

  const [expenses,     setExpenses]     = useState<Expense[]>([])
  const [revenue,      setRevenue]      = useState(initialRevenue)
  const [yearSummary,  setYearSummary]  = useState<MonthSummary[] | null>(null)
  const [loadingEx,    setLoadingEx]    = useState(false)
  const [deleting,     setDeleting]     = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [form,    setForm]    = useState({ date: today, category: 'carburant', label: '', amount: '' })
  const [saving,  setSaving]  = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  // Frais récurrents
  const [recurring,       setRecurring]       = useState<RecurringExpense[]>([])
  const [showRecForm,     setShowRecForm]      = useState(false)
  const [recForm,         setRecForm]          = useState({ category: 'abonnement', label: '', amount: '', day_of_month: '1' })
  const [savingRec,       setSavingRec]        = useState(false)
  const [recErr,          setRecErr]           = useState<string | null>(null)
  const [deletingRec,     setDeletingRec]      = useState<string | null>(null)
  const [togglingRec,     setTogglingRec]      = useState<string | null>(null)

  const fetchRecurring = useCallback(async () => {
    const res = await fetch('/api/expenses/recurring')
    if (res.ok) { const j = await res.json(); setRecurring(j.recurring ?? []) }
  }, [])

  useEffect(() => { fetchRecurring() }, [fetchRecurring])

  async function addRecurring(e: React.FormEvent) {
    e.preventDefault()
    setRecErr(null)
    if (!recForm.label.trim() || !recForm.amount) { setRecErr('Libellé et montant requis'); return }
    if (parseFloat(recForm.amount) < 0) { setRecErr('Le montant doit être positif'); return }
    setSavingRec(true)
    const res = await fetch('/api/expenses/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recForm, amount: parseFloat(recForm.amount), day_of_month: parseInt(recForm.day_of_month) }),
    })
    if (res.ok) { setRecForm({ category: 'abonnement', label: '', amount: '', day_of_month: '1' }); setShowRecForm(false); fetchRecurring(); fetchData() }
    setSavingRec(false)
  }

  async function toggleRecurring(id: string, active: boolean) {
    setTogglingRec(id)
    await fetch(`/api/expenses/recurring/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
    setRecurring(prev => prev.map(r => r.id === id ? { ...r, active } : r))
    setTogglingRec(null)
  }

  async function deleteRecurring(id: string) {
    setDeletingRec(id)
    await fetch(`/api/expenses/recurring/${id}`, { method: 'DELETE' })
    setRecurring(prev => prev.filter(r => r.id !== id))
    fetchData()
    setDeletingRec(null)
  }

  const { start, end, label } = getPeriodRange(periodType, refDate)

  const fetchData = useCallback(async () => {
    setLoadingEx(true)
    if (periodType === 'annee') {
      const year = refDate.getFullYear()
      const res = await fetch(`/api/compta/year-summary?year=${year}`)
      if (res.ok) { const j = await res.json(); setYearSummary(j.months) }
      setExpenses([])
      setRevenue(0)
    } else {
      setYearSummary(null)
      const [exRes, revRes] = await Promise.all([
        fetch(`/api/expenses?start=${start}&end=${end}`),
        fetch(`/api/compta/revenue?start=${start}&end=${end}`),
      ])
      if (exRes.ok)  { const j = await exRes.json();  setExpenses(j.expenses ?? []) }
      if (revRes.ok) { const j = await revRes.json(); setRevenue(j.revenue ?? 0) }
    }
    setLoadingEx(false)
  }, [periodType, start, end, refDate])

  useEffect(() => { fetchData() }, [fetchData])

  async function addExpense(e: React.FormEvent) {
    e.preventDefault()
    setFormErr(null)
    if (!form.label.trim() || !form.amount) { setFormErr('Libellé et montant requis'); return }
    if (parseFloat(form.amount) < 0) { setFormErr('Le montant doit être positif'); return }
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) { setForm({ date: today, category: 'carburant', label: '', amount: '' }); fetchData() }
    else { const j = await res.json().catch(() => null); setFormErr(j?.error ?? 'Erreur lors de la sauvegarde') }
    setSaving(false)
  }

  async function deleteExpense(id: string) {
    setDeleting(id)
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== id))
    setDeleting(null)
  }

  const totalExpenses = periodType === 'annee'
    ? (yearSummary ?? []).reduce((s, m) => s + m.expenses, 0)
    : expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalRevenue  = periodType === 'annee'
    ? (yearSummary ?? []).reduce((s, m) => s + m.revenue, 0)
    : revenue
  const result = totalRevenue - totalExpenses

  const inputClass = "border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"

  return (
    <div className="space-y-5">

      {/* Tabs Jour / Semaine / Mois / Année */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        {(['jour', 'semaine', 'mois', 'annee'] as PeriodType[]).map(t => (
          <button
            key={t}
            onClick={() => { setPeriodType(t); setRefDate(new Date()) }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              periodType === t
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {t === 'annee' ? 'Année' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Navigation période */}
      <div className="flex items-center justify-between">
        <button onClick={() => setRefDate(navigate(periodType, refDate, -1))} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize text-sm">{label}</span>
        <button onClick={() => setRefDate(navigate(periodType, refDate, 1))} disabled={isToday(refDate, periodType)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">CA</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{totalRevenue.toFixed(2).replace(/\.00$/, '')}€</p>
        </div>
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-2xl p-4">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Dépenses</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{totalExpenses.toFixed(2).replace(/\.00$/, '')}€</p>
        </div>
        <div className={`border rounded-2xl p-4 ${result >= 0 ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800'}`}>
          <p className={`text-xs font-medium mb-1 ${result >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>Résultat</p>
          <p className={`text-xl font-bold ${result >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
            {result >= 0 ? '+' : ''}{result.toFixed(2).replace(/\.00$/, '')}€
          </p>
        </div>
      </div>

      {/* Vue Année — tableau mensuel */}
      {periodType === 'annee' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Détail par mois</h2>
          </div>
          {loadingEx ? (
            <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Mois</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">CA</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-red-600 dark:text-red-400">Dépenses</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                  {(yearSummary ?? []).map(row => {
                    const res = row.revenue - row.expenses
                    const empty = row.revenue === 0 && row.expenses === 0
                    return (
                      <tr key={row.month} className={`${empty ? 'opacity-40' : ''} hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors`}>
                        <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">{MONTHS_FR[row.month - 1]}</td>
                        <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">{row.revenue > 0 ? `${row.revenue.toFixed(2).replace(/\.00$/, '')}€` : '—'}</td>
                        <td className="px-4 py-3 text-right text-red-600 dark:text-red-400 font-semibold">{row.expenses > 0 ? `−${row.expenses.toFixed(2).replace(/\.00$/, '')}€` : '—'}</td>
                        <td className={`px-5 py-3 text-right font-bold ${empty ? '' : res >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-600 dark:text-orange-400'}`}>
                          {empty ? '—' : `${res >= 0 ? '+' : ''}${res.toFixed(2).replace(/\.00$/, '')}€`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                    <td className="px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 dark:text-emerald-300">{totalRevenue.toFixed(2).replace(/\.00$/, '')}€</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">−{totalExpenses.toFixed(2).replace(/\.00$/, '')}€</td>
                    <td className={`px-5 py-3 text-right font-bold ${result >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-600 dark:text-orange-400'}`}>
                      {result >= 0 ? '+' : ''}{result.toFixed(2).replace(/\.00$/, '')}€
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Vues Jour / Semaine / Mois — formulaire + liste */}
      {periodType !== 'annee' && (
        <>
          {/* Formulaire ajout */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Ajouter un frais</h2>
            <form onSubmit={addExpense} noValidate className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Catégorie</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass + ' w-full'}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Libellé</label>
                  <input type="text" value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))} placeholder="ex: Plein essence" className={`${inputClass} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Montant (€)</label>
                  <input type="number" min={0} step={0.01} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className={`${inputClass} w-full`} />
                </div>
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
              <button type="submit" disabled={saving} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
                {saving ? 'Ajout...' : '+ Ajouter'}
              </button>
            </form>
          </div>

          {/* Liste des frais */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Frais de la période</h2>
              <span className="text-xs text-slate-400">{expenses.length} entrée{expenses.length > 1 ? 's' : ''}</span>
            </div>
            {loadingEx ? (
              <div className="p-8 text-center text-sm text-slate-400">Chargement...</div>
            ) : expenses.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">Aucun frais sur cette période</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {expenses.map(ex => (
                  <div key={ex.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="shrink-0 text-xs text-slate-400 w-16">
                      {new Date(ex.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[ex.category] ?? CAT_COLORS.autre}`}>
                      {CATEGORIES.find(c => c.value === ex.category)?.label ?? ex.category}
                    </span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">
                      {ex.label}
                      {ex.recurring_expense_id && (
                        <span className="ml-1.5 text-xs text-slate-400" title="Frais récurrent auto-généré">↻</span>
                      )}
                    </span>
                    <span className="shrink-0 font-semibold text-sm text-red-600 dark:text-red-400">−{Number(ex.amount).toFixed(2).replace(/\.00$/, '')}€</span>
                    <button
                      onClick={() => deleteExpense(ex.id)}
                      disabled={deleting === ex.id}
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Frais récurrents — toujours visible */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Frais récurrents</h2>
            <p className="text-xs text-slate-400 mt-0.5">Prélevés automatiquement chaque mois</p>
          </div>
          <button
            onClick={() => setShowRecForm(p => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {showRecForm ? <path d="M18 6 6 18M6 6l12 12"/> : <><path d="M12 5v14"/><path d="M5 12h14"/></>}
            </svg>
            {showRecForm ? 'Annuler' : 'Ajouter'}
          </button>
        </div>

        {showRecForm && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <form onSubmit={addRecurring} noValidate className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Catégorie</label>
                  <select value={recForm.category} onChange={e => setRecForm(p => ({ ...p, category: e.target.value }))} className={inputClass + ' w-full'}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Prélevé le (jour du mois)</label>
                  <input type="number" min={1} max={28} value={recForm.day_of_month} onChange={e => setRecForm(p => ({ ...p, day_of_month: e.target.value }))} className={`${inputClass} w-full`} placeholder="1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Libellé</label>
                  <input type="text" value={recForm.label} onChange={e => setRecForm(p => ({ ...p, label: e.target.value }))} placeholder="ex: WashBoard abonnement" className={`${inputClass} w-full`} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Montant (€)</label>
                  <input type="number" min={0} step={0.01} value={recForm.amount} onChange={e => setRecForm(p => ({ ...p, amount: e.target.value }))} placeholder="49.00" className={`${inputClass} w-full`} />
                </div>
              </div>
              {recErr && <p className="text-xs text-red-500">{recErr}</p>}
              <button type="submit" disabled={savingRec} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
                {savingRec ? 'Ajout...' : '+ Ajouter ce frais récurrent'}
              </button>
            </form>
          </div>
        )}

        {recurring.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">Aucun frais récurrent configuré</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recurring.map(r => (
              <div key={r.id} className={`flex items-center gap-3 px-5 py-3.5 ${!r.active ? 'opacity-40' : ''}`}>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${CAT_COLORS[r.category] ?? CAT_COLORS.autre}`}>
                  {CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}
                </span>
                <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{r.label}</span>
                <span className="shrink-0 text-xs text-slate-400">le {r.day_of_month}</span>
                <span className="shrink-0 font-semibold text-sm text-red-600 dark:text-red-400">−{Number(r.amount).toFixed(2).replace(/\.00$/, '')}€/mois</span>
                <button
                  onClick={() => toggleRecurring(r.id, !r.active)}
                  disabled={togglingRec === r.id}
                  title={r.active ? 'Désactiver' : 'Activer'}
                  className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${r.active ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    {r.active
                      ? <><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></>
                      : <><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></>
                    }
                  </svg>
                </button>
                <button
                  onClick={() => deleteRecurring(r.id)}
                  disabled={deletingRec === r.id}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

