'use client'

import { useState } from 'react'
import type { Availability, Unavailability } from '@/types'

const DAYS       = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const PRESETS    = ['Vacances', 'Formation', 'Congé maladie', 'Jour férié']

function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(s: string) {
  return new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

type Props = {
  availabilities: Availability[]
  unavailabilities: Unavailability[]
  teamSize: number
}

export default function DisponibilitesManager({ availabilities: initial, unavailabilities: initialUnavail, teamSize }: Props) {
  // ── Créneaux hebdomadaires ───────────────────────────────────────────────
  const [slots,      setSlots]      = useState(initial)
  const [dayOfWeek,  setDayOfWeek]  = useState<number>(1)
  const [startTime,  setStartTime]  = useState('08:00')
  const [endTime,    setEndTime]    = useState('18:00')
  const [slotLoad,   setSlotLoad]   = useState(false)
  const [slotErr,    setSlotErr]    = useState<string | null>(null)

  const byDay = DAYS.map((_, i) => slots.filter(s => s.day_of_week === i))

  async function addSlot() {
    if (startTime >= endTime) { setSlotErr("L'heure de fin doit être après l'heure de début"); return }
    setSlotLoad(true); setSlotErr(null)
    const res = await fetch('/api/availabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ day_of_week: dayOfWeek, start_time: startTime, end_time: endTime }),
    })
    const json = await res.json()
    if (!res.ok) { setSlotErr(json.error); setSlotLoad(false); return }
    setSlots(s => [...s, json.data])
    setSlotLoad(false)
  }

  async function removeSlot(id: string) {
    await fetch(`/api/availabilities/${id}`, { method: 'DELETE' })
    setSlots(s => s.filter(sl => sl.id !== id))
  }

  // ── Congés & absences ────────────────────────────────────────────────────
  const [unavails,        setUnavails]        = useState(initialUnavail)
  const [uStart,          setUStart]          = useState(toDateInput(new Date()))
  const [uEnd,            setUEnd]            = useState(toDateInput(new Date()))
  const [uLabel,          setULabel]          = useState('')
  const [uTeamMembersOff, setUTeamMembersOff] = useState(teamSize)
  const [uLoading,        setULoading]        = useState(false)
  const [uErr,            setUErr]            = useState<string | null>(null)

  async function addUnavail() {
    if (uStart > uEnd) { setUErr('La date de fin doit être après la date de début'); return }
    setULoading(true); setUErr(null)
    const res = await fetch('/api/unavailabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_date: uStart, end_date: uEnd, label: uLabel, team_members_off: uTeamMembersOff }),
    })
    const json = await res.json()
    if (!res.ok) { setUErr(json.error ?? 'Erreur'); setULoading(false); return }
    setUnavails(u => [...u, json.data].sort((a, b) => a.start_date.localeCompare(b.start_date)))
    setULoading(false)
  }

  async function removeUnavail(id: string) {
    await fetch(`/api/unavailabilities/${id}`, { method: 'DELETE' })
    setUnavails(u => u.filter(x => x.id !== id))
  }

  const timeInput = "border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
  const dateInput = "border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"

  const today = toDateInput(new Date())
  const upcomingUnavails = unavails.filter(u => u.end_date >= today)
  const pastUnavails     = unavails.filter(u => u.end_date < today)

  return (
    <div className="space-y-5">
      {/* ── Créneaux hebdomadaires ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Ajouter un créneau</h2>
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Jour</p>
          <div className="flex gap-1.5 flex-wrap">
            {DAYS_SHORT.map((d, i) => (
              <button key={i} type="button" onClick={() => setDayOfWeek(i)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
                  dayOfWeek === i
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                }`}>{d}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Début</p>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={timeInput} />
          </div>
          <div className="text-slate-400 mt-5">→</div>
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Fin</p>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={timeInput} />
          </div>
        </div>
        {slotErr && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{slotErr}</p>}
        <button onClick={addSlot} disabled={slotLoad}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {slotLoad ? 'Ajout...' : '+ Ajouter ce créneau'}
        </button>
      </div>

      {/* Calendrier hebdomadaire */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Planning de la semaine</h2>
        <div className="space-y-3">
          {DAYS.map((day, i) => {
            const daySlots = byDay[i]
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${daySlots.length > 0 ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'}`}>
                <span className={`text-xs font-bold w-8 pt-0.5 shrink-0 ${daySlots.length > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {DAYS_SHORT[i]}
                </span>
                {daySlots.length === 0 ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500 pt-0.5">Indisponible</span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-lg px-2.5 py-1">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </span>
                        <button onClick={() => removeSlot(slot.id)}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors ml-0.5">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Congés & absences ──────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Congés & absences</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          {teamSize > 1
            ? 'Bloquez tout ou partie de l\'équipe. Si toute l\'équipe est absente, les créneaux sont masqués ; sinon la capacité est réduite.'
            : 'Les créneaux de ces périodes seront masqués sur votre page client'}
        </p>

        {/* Formulaire */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 space-y-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Du</p>
              <input type="date" value={uStart} onChange={e => setUStart(e.target.value)} className={dateInput} />
            </div>
            <div className="text-slate-400 mt-5">→</div>
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Au</p>
              <input type="date" value={uEnd} onChange={e => setUEnd(e.target.value)} min={uStart} className={dateInput} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Motif (optionnel)</p>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {PRESETS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setULabel(uLabel === p ? '' : p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    uLabel === p
                      ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={uLabel}
              onChange={e => setULabel(e.target.value)}
              placeholder="Ou saisissez un motif libre..."
              className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {teamSize > 1 && (
            <div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Laveurs absents</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setUTeamMembersOff(v => Math.max(1, v - 1))}
                    className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold transition-colors"
                  >−</button>
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 min-w-[3rem] text-center">
                    {uTeamMembersOff} / {teamSize}
                  </span>
                  <button
                    type="button"
                    onClick={() => setUTeamMembersOff(v => Math.min(teamSize, v + 1))}
                    className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-sm font-bold transition-colors"
                  >+</button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {uTeamMembersOff >= teamSize
                    ? 'Toute l\'équipe — les créneaux seront bloqués'
                    : `${teamSize - uTeamMembersOff} laveur(s) restant — capacité réduite`}
                </p>
              </div>
            </div>
          )}

          {uErr && <p className="text-xs text-red-600 dark:text-red-400">{uErr}</p>}

          <button onClick={addUnavail} disabled={uLoading}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
            {uLoading ? 'Ajout...' : '+ Bloquer cette période'}
          </button>
        </div>

        {/* Liste des périodes */}
        {upcomingUnavails.length === 0 && pastUnavails.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">Aucune période bloquée</p>
        ) : (
          <div className="space-y-2">
            {upcomingUnavails.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">À venir</p>
                {upcomingUnavails.map(u => (
                  <UnavailRow key={u.id} u={u} onDelete={removeUnavail} teamSize={teamSize} />
                ))}
              </>
            )}
            {pastUnavails.length > 0 && (
              <>
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-3 mb-1">Passées</p>
                {pastUnavails.map(u => (
                  <UnavailRow key={u.id} u={u} onDelete={removeUnavail} muted teamSize={teamSize} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function UnavailRow({ u, onDelete, muted, teamSize }: { u: Unavailability; onDelete: (id: string) => void; muted?: boolean; teamSize?: number }) {
  const single = u.start_date === u.end_date
  const label  = single ? fmtDate(u.start_date) : `${fmtDate(u.start_date)} → ${fmtDate(u.end_date)}`
  const off    = u.team_members_off ?? 1
  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border ${muted ? 'border-slate-100 dark:border-slate-800 opacity-50' : 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20'}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{label}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {u.label && <p className="text-xs text-slate-500 dark:text-slate-400">{u.label}</p>}
          {teamSize && teamSize > 1 && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${off >= teamSize ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'}`}>
              {off >= teamSize ? 'Toute l\'équipe' : `${off}/${teamSize} laveurs`}
            </span>
          )}
        </div>
      </div>
      {!muted && (
        <button onClick={() => onDelete(u.id)}
          className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      )}
    </div>
  )
}
