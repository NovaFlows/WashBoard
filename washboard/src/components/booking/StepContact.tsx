'use client'

import { useState } from 'react'

type Props = {
  loading: boolean
  error: string | null
  onSubmit: (data: { client_name: string; client_email: string; client_phone: string }) => void
  onBack: () => void
}

export default function StepContact({ loading, error, onSubmit, onBack }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const canSubmit = name.trim() && email.includes('@') && phone.trim().length >= 10

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-shadow"
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Vos coordonnées</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Pour vous confirmer le rendez-vous</p>

      <div className="space-y-4 mb-6">
        <div>
          <label className={labelClass}>Prénom et nom</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Jean Dupont"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jean@email.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 py-3 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 text-sm"
        >
          Retour
        </button>
        <button
          onClick={() => canSubmit && onSubmit({ client_name: name, client_email: email, client_phone: phone })}
          disabled={!canSubmit || loading}
          className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Envoi en cours...
            </span>
          ) : 'Confirmer la réservation'}
        </button>
      </div>
    </div>
  )
}
