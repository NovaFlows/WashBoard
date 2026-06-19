'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR = ['L','M','M','J','V','S','D']

const ALL_SLOTS = [
  { time: '08:00', group: 'Matin' },
  { time: '09:00', group: 'Matin' },
  { time: '10:00', group: 'Matin' },
  { time: '11:00', group: 'Matin' },
  { time: '12:00', group: 'Matin' },
  { time: '13:00', group: 'Après-midi' },
  { time: '14:00', group: 'Après-midi' },
  { time: '15:00', group: 'Après-midi' },
  { time: '16:00', group: 'Après-midi' },
  { time: '17:00', group: 'Après-midi' },
  { time: '18:00', group: 'Soirée' },
  { time: '19:00', group: 'Soirée' },
  { time: '20:00', group: 'Soirée' },
  { time: '21:00', group: 'Soirée' },
  { time: '22:00', group: 'Soirée' },
]

const GROUPS = ['Matin', 'Après-midi', 'Soirée']

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateFr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  return `${jours[date.getDay()]} ${parseInt(d)} ${MONTHS_FR[parseInt(m) - 1]} ${y}`
}

export default function BookingPage() {
  const todayRef = new Date(); todayRef.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(todayRef.getFullYear())
  const [viewMonth, setViewMonth] = useState(todayRef.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [busySlots, setBusySlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fetchAvailability = useCallback(async (dateStr: string) => {
    setLoadingSlots(true)
    setBusySlots([])
    try {
      const res = await fetch(`/api/booking/availability?date=${dateStr}`)
      const data = await res.json()
      setBusySlots(data.busySlots ?? [])
    } catch {
      setBusySlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  function onDateClick(dateStr: string) {
    setSelectedDate(dateStr)
    setSelectedTime(null)
    fetchAvailability(dateStr)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!firstname.trim()) errs.firstname = 'Requis'
    if (!lastname.trim()) errs.lastname = 'Requis'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email invalide'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/api/booking/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateStr: selectedDate, timeStr: selectedTime, firstname, lastname, email, message }),
      })
      const data = await res.json()
      if (data.success) {
        setStep(3)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        setSubmitError(data.error || "Erreur lors de la réservation.")
        if (res.status === 409) {
          setTimeout(() => { setStep(1); setSubmitError(''); fetchAvailability(selectedDate!) }, 2500)
        }
      }
    } catch {
      setSubmitError('Erreur de connexion. Veuillez réessayer.')
    } finally {
      setSubmitting(false)
    }
  }

  // Calendar grid
  const today = todayRef
  const firstDay = new Date(viewYear, viewMonth, 1)
  const lastDay = new Date(viewYear, viewMonth + 1, 0)
  let startOffset = firstDay.getDay() - 1
  if (startOffset < 0) startOffset = 6
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  type CalDay = { day: number; dateStr: string; isWeekend: boolean; isPast: boolean }
  const calDays: Array<CalDay | null> = []
  for (let i = 0; i < startOffset; i++) calDays.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(viewYear, viewMonth, d)
    const dateStr = toDateStr(date)
    const dow = date.getDay()
    calDays.push({ day: d, dateStr, isWeekend: dow === 0 || dow === 6, isPast: date < today })
  }

  // Google Calendar link for confirmation
  let gcalUrl = ''
  if (selectedDate && selectedTime) {
    const [y, m, d] = selectedDate.split('-')
    const [h] = selectedTime.split(':')
    const start = `${y}${m}${d}T${h}0000`
    const endH = String(parseInt(h) + 1).padStart(2, '0')
    const end = `${y}${m}${d}T${endH}0000`
    gcalUrl = `https://calendar.google.com/calendar/r/eventedit?text=Appel+WashBoard&dates=${start}/${end}&details=Appel+d%C3%A9couverte+WashBoard`
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/LogoWashBoard.png" alt="WashBoard" width={32} height={32} className="rounded-lg" />
            <span className="text-lg font-extrabold tracking-tight">WashBoard</span>
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
              <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Retour au site
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4">
            <span className="w-5 h-px bg-blue-500 opacity-50 block" />
            Appel découverte gratuit
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Planifier un appel</h1>
          <p className="text-slate-500 dark:text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            30 minutes pour découvrir WashBoard et voir comment il peut simplifier votre activité — sans engagement.
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {([{n:1,label:'Créneau'},{n:2,label:'Coordonnées'},{n:3,label:'Confirmation'}] as const).map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 sm:w-14 h-px transition-colors ${step > i ? 'bg-blue-500/50' : 'bg-slate-200 dark:bg-slate-700'}`} />
              )}
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all
                  ${step === s.n ? 'bg-blue-600 border-blue-600 text-white' :
                    step > s.n ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' :
                    'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={`text-xs font-medium hidden sm:block transition-colors ${step === s.n ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden relative">
          {submitting && (
            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-2xl">
              <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-700 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}

          {/* ─── Step 1 : Calendrier ─── */}
          {step === 1 && (
            <>
              <div className="grid sm:grid-cols-2 min-h-96">
                {/* Calendrier */}
                <div className="p-6 sm:p-8 border-b sm:border-b-0 sm:border-r border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={prevMonth}
                      disabled={isCurrentMonth}
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                        <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <h3 className="text-sm font-bold">{MONTHS_FR[viewMonth]} {viewYear}</h3>
                    <button
                      onClick={nextMonth}
                      className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {DAYS_FR.map((d, i) => (
                      <div key={i} className="text-center text-xs font-semibold text-slate-400 uppercase py-1">{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calDays.map((day, i) => {
                      if (!day) return <div key={i} />
                      const isSelected = day.dateStr === selectedDate
                      const isToday = day.dateStr === toDateStr(today)
                      const disabled = day.isWeekend || day.isPast
                      return (
                        <button
                          key={i}
                          onClick={() => !disabled && onDateClick(day.dateStr)}
                          disabled={disabled}
                          className={`aspect-square flex items-center justify-center rounded-full text-sm font-medium transition-all relative
                            ${isSelected ? 'bg-blue-600 text-white' :
                              disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' :
                              'text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'}`}
                        >
                          {day.day}
                          {isToday && !isSelected && (
                            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Créneaux */}
                <div className="p-6 sm:p-8">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-5">Horaire disponible</h3>
                  {!selectedDate ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400 text-sm text-center">
                      <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4"/>
                        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Sélectionnez une date pour voir les créneaux disponibles
                    </div>
                  ) : loadingSlots ? (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                      <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-sm">Chargement…</span>
                    </div>
                  ) : (
                    <div className="space-y-5 max-h-72 overflow-y-auto pr-1">
                      {GROUPS.map(group => {
                        const times = ALL_SLOTS.filter(s => s.group === group).map(s => s.time)
                        return (
                          <div key={group}>
                            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">{group}</p>
                            <div className="flex flex-wrap gap-2">
                              {times.map(time => {
                                const isBusy = busySlots.includes(time)
                                const isSelected = time === selectedTime
                                return (
                                  <button
                                    key={time}
                                    onClick={() => !isBusy && setSelectedTime(time)}
                                    disabled={isBusy}
                                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all
                                      ${isSelected ? 'bg-blue-600 border-blue-600 text-white' :
                                        isBusy ? 'border-slate-200 dark:border-slate-700 text-slate-300 dark:text-slate-600 line-through cursor-not-allowed' :
                                        'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400'}`}
                                  >
                                    {time}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer step 1 */}
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-4 flex-wrap">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedDate && selectedTime ? (
                    <>
                      <span className="font-semibold text-slate-800 dark:text-white">{formatDateFr(selectedDate)}</span>
                      {' '}à{' '}
                      <span className="font-semibold text-slate-800 dark:text-white">{selectedTime}</span>
                    </>
                  ) : selectedDate ? (
                    'Date choisie — sélectionnez un horaire'
                  ) : (
                    'Aucun créneau sélectionné'
                  )}
                </div>
                <button
                  onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  disabled={!selectedDate || !selectedTime}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Continuer
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* ─── Step 2 : Formulaire ─── */}
          {step === 2 && (
            <div className="p-6 sm:p-10">
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 mb-8">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                  <strong className="font-semibold">{selectedDate ? formatDateFr(selectedDate) : ''} à {selectedTime}</strong>
                </span>
                <button onClick={() => setStep(1)} className="text-xs text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity shrink-0">
                  Modifier
                </button>
              </div>

              <h2 className="text-xl font-bold mb-6">Vos coordonnées</h2>

              {submitError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
                  {submitError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Prénom</label>
                    <input
                      value={firstname} onChange={e => setFirstname(e.target.value)} placeholder="Jean"
                      className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${errors.firstname ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                    />
                    {errors.firstname && <p className="text-xs text-red-500 mt-1">{errors.firstname}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Nom</label>
                    <input
                      value={lastname} onChange={e => setLastname(e.target.value)} placeholder="Dupont"
                      className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${errors.lastname ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                    />
                    {errors.lastname && <p className="text-xs text-red-500 mt-1">{errors.lastname}</p>}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean.dupont@exemple.com"
                    className={`w-full px-4 py-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all ${errors.email ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
                  />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div className="mb-6">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Message <span className="font-normal normal-case tracking-normal opacity-60">(optionnel)</span>
                  </label>
                  <textarea
                    value={message} onChange={e => setMessage(e.target.value)} rows={3}
                    placeholder="Décrivez brièvement votre activité et ce que vous souhaitez savoir sur WashBoard…"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all resize-none"
                  />
                </div>
                <p className="text-xs text-slate-400 mb-6">
                  En confirmant, vous acceptez d&apos;être contacté à l&apos;horaire sélectionné. Un email de confirmation vous sera envoyé.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium rounded-xl transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Retour
                  </button>
                  <button type="submit" disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                    Confirmer le rendez-vous
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ─── Step 3 : Confirmation ─── */}
          {step === 3 && (
            <div className="px-6 py-16 sm:px-10 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24">
                  <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-2xl font-extrabold mb-3">Rendez-vous confirmé !</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8 max-w-sm mx-auto">
                Nous vous appellerons à l&apos;horaire choisi. À tout de suite !
              </p>
              <div className="inline-flex items-center gap-6 px-6 py-4 rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-950/30 mb-8 flex-wrap justify-center">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  {selectedDate ? formatDateFr(selectedDate) : ''}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  {selectedTime}
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {gcalUrl && (
                  <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium rounded-xl transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
                    Ajouter à mon agenda
                  </a>
                )}
                <Link href="/" className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  Retour au site
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
