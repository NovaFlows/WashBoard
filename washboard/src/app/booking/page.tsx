'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { logger } from '@/lib/logger'
import { toDateStr } from '@/lib/dateUtils'

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
  // Vrai si la liste des creneaux occupes n a pas pu etre chargee : on le dit
  // au visiteur plutot que de lui presenter toutes les heures comme libres.
  const [slotsError, setSlotsError] = useState(false)
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
    setSlotsError(false)
    setBusySlots([])
    try {
      const res = await fetch(`/api/booking/availability?date=${dateStr}`)
      const data = await res.json()
      setBusySlots(data.busySlots ?? [])
    } catch (e) {
      // Meme motif que le bug de double-reservation : une lecture qui echoue
      // laissait tous les creneaux paraitre libres. On previent l utilisateur
      // au lieu de lui proposer des horaires potentiellement deja pris.
      logger.error('booking.slots.load_failed', {}, e)
      setSlotsError(true)
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
    calDays.push({ day: d, dateStr, isWeekend: false, isPast: date < today })
  }

  // Google Calendar link for confirmation
  let gcalUrl = ''
  if (selectedDate && selectedTime) {
    const [y, m, d] = selectedDate.split('-')
    const [h, min] = selectedTime.split(':')
    const start = `${y}${m}${d}T${h}${min}00`
    const totalMin = parseInt(h) * 60 + parseInt(min) + 30
    const endH = String(Math.floor(totalMin / 60)).padStart(2, '0')
    const endM = String(totalMin % 60).padStart(2, '0')
    const end = `${y}${m}${d}T${endH}${endM}00`
    gcalUrl = `https://calendar.google.com/calendar/r/eventedit?text=Appel+WashBoard&dates=${start}/${end}&details=Appel+d%C3%A9couverte+WashBoard`
  }

  const ETAPES = [{ n: 1, label: 'Créneau' }, { n: 2, label: 'Coordonnées' }, { n: 3, label: 'Confirmation' }] as const

  return (
    <div className="bk">
      <header className="bk-tete">
        <p className="sur-titre"><span className="pt" />Appel découverte gratuit</p>
        <h1 className="pr-h1">Planifier un appel</h1>
        <p className="chapo">
          Un appel de 30 minutes pour découvrir WashBoard et voir comment il peut simplifier votre activité — sans engagement.
        </p>
      </header>

      <ol className="bk-etapes" aria-label="Étapes">
        {ETAPES.map(s => (
          <li
            key={s.n}
            className={step === s.n ? 'on' : step > s.n ? 'fait' : undefined}
            aria-current={step === s.n ? 'step' : undefined}
          >
            <span className="n" aria-hidden="true">{step > s.n ? '✓' : s.n}</span>
            {s.label}
          </li>
        ))}
      </ol>

      <div className="bk-surface">
        {submitting && (
          <div className="bk-attente" role="status" aria-label="Envoi en cours">
            <div className="bk-spin" />
          </div>
        )}

        {/* ─── Étape 1 : calendrier ─── */}
        {step === 1 && (
          <>
            <div className="bk-choix">
              <div className="bk-cal">
                <div className="bk-mois">
                  <button type="button" className="bk-fleche" onClick={prevMonth} disabled={isCurrentMonth} aria-label="Mois précédent">
                    <svg fill="none" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <h2>{MONTHS_FR[viewMonth]} {viewYear}</h2>
                  <button type="button" className="bk-fleche" onClick={nextMonth} aria-label="Mois suivant">
                    <svg fill="none" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <div className="bk-jours">
                  {DAYS_FR.map((d, i) => <div key={i} className="ent" aria-hidden="true">{d}</div>)}
                  {calDays.map((day, i) => {
                    if (!day) return <div key={i} />
                    const isSelected = day.dateStr === selectedDate
                    const isToday = day.dateStr === toDateStr(today)
                    const disabled = day.isWeekend || day.isPast
                    return (
                      <button
                        key={i}
                        type="button"
                        className="bk-jour"
                        onClick={() => !disabled && onDateClick(day.dateStr)}
                        disabled={disabled}
                        aria-pressed={isSelected}
                        aria-label={formatDateFr(day.dateStr)}
                      >
                        {day.day}
                        {isToday && !isSelected && <span className="auj" aria-hidden="true" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="bk-heures">
                <h2 className="bk-titre-h">Horaire disponible</h2>
                {!selectedDate ? (
                  <p className="bk-vide">Sélectionnez une date pour voir les créneaux disponibles</p>
                ) : loadingSlots ? (
                  <div className="bk-vide" role="status">
                    <div>
                      <div className="bk-spin" style={{ margin: '0 auto 10px' }} />
                      Chargement…
                    </div>
                  </div>
                ) : (
                  <div className="bk-liste-h">
                    {slotsError && (
                      <p className="bk-info" role="alert">
                        Les créneaux déjà pris n’ont pas pu être vérifiés. Choisissez un horaire :
                        nous vous confirmerons sa disponibilité.
                      </p>
                    )}
                    {GROUPS.map(group => {
                      const times = ALL_SLOTS.filter(s => s.group === group).map(s => s.time)
                      return (
                        <div key={group} className="bk-groupe">
                          <p>{group}</p>
                          <div>
                            {times.map(time => {
                              const isBusy = busySlots.includes(time)
                              return (
                                <button
                                  key={time}
                                  type="button"
                                  className="bk-heure"
                                  onClick={() => !isBusy && setSelectedTime(time)}
                                  disabled={isBusy}
                                  aria-pressed={time === selectedTime}
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

            <div className="bk-pied">
              <div>
                {selectedDate && selectedTime ? (
                  <>
                    <b>{formatDateFr(selectedDate)}</b>{' '}à{' '}<b>{selectedTime}</b>
                  </>
                ) : selectedDate ? (
                  'Date choisie — sélectionnez un horaire'
                ) : (
                  'Aucun créneau sélectionné'
                )}
              </div>
              <button
                type="button"
                className="btn btn-accent"
                onClick={() => { setStep(2); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                disabled={!selectedDate || !selectedTime}
              >
                Continuer
              </button>
            </div>
          </>
        )}

        {/* ─── Étape 2 : coordonnées ─── */}
        {step === 2 && (
          <div className="bk-form">
            <div className="bk-rappel">
              <b>{selectedDate ? formatDateFr(selectedDate) : ''} à {selectedTime}</b>
              <button type="button" onClick={() => setStep(1)}>Modifier</button>
            </div>

            <h2>Vos coordonnées</h2>

            {submitError && <p className="bk-err" role="alert" style={{ marginBottom: 16 }}>{submitError}</p>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="bk-grille">
                <div className="bk-champ">
                  <label htmlFor="bk-prenom">Prénom</label>
                  <input
                    id="bk-prenom" value={firstname} onChange={e => setFirstname(e.target.value)} placeholder="Jean"
                    autoComplete="given-name" aria-invalid={!!errors.firstname}
                  />
                  {errors.firstname && <p className="bk-err">{errors.firstname}</p>}
                </div>
                <div className="bk-champ">
                  <label htmlFor="bk-nom">Nom</label>
                  <input
                    id="bk-nom" value={lastname} onChange={e => setLastname(e.target.value)} placeholder="Dupont"
                    autoComplete="family-name" aria-invalid={!!errors.lastname}
                  />
                  {errors.lastname && <p className="bk-err">{errors.lastname}</p>}
                </div>
              </div>
              <div className="bk-champ" style={{ marginBottom: 16 }}>
                <label htmlFor="bk-email">Email</label>
                <input
                  id="bk-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jean.dupont@exemple.com"
                  autoComplete="email" aria-invalid={!!errors.email}
                />
                {errors.email && <p className="bk-err">{errors.email}</p>}
              </div>
              <div className="bk-champ" style={{ marginBottom: 20 }}>
                <label htmlFor="bk-message">Message <small>(optionnel)</small></label>
                <textarea
                  id="bk-message" value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="Décrivez brièvement votre activité et ce que vous souhaitez savoir sur WashBoard…"
                />
              </div>
              <p className="bk-note">
                En confirmant, vous acceptez d&apos;être contacté à l&apos;horaire sélectionné. Un email de confirmation vous sera envoyé.
              </p>
              <div className="bk-actions">
                <button type="button" className="btn btn-ligne" onClick={() => setStep(1)}>Retour</button>
                <button type="submit" className="btn btn-accent" disabled={submitting}>Confirmer le rendez-vous</button>
              </div>
            </form>
          </div>
        )}

        {/* ─── Étape 3 : confirmation ─── */}
        {step === 3 && (
          <div className="bk-ok">
            <div className="bk-coche">
              <svg fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>Rendez-vous confirmé !</h2>
            <p>Nous vous appellerons à l&apos;horaire choisi. À tout de suite !</p>
            <div className="quand">
              <span>{selectedDate ? formatDateFr(selectedDate) : ''}</span>
              <span className="num">{selectedTime}</span>
            </div>
            <div className="bk-actions">
              {gcalUrl && (
                <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ligne">Ajouter à mon agenda</a>
              )}
              <Link href="/" className="btn btn-accent">Retour au site</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
