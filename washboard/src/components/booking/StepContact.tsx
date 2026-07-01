'use client'

import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'

type Props = {
  isProfessional: boolean
  loading: boolean
  error: string | null
  onSubmit: (data: {
    client_name: string
    client_email: string
    client_phone: string
    company_name?: string
    siret?: string
    billing_address?: string
    hp?: string
  }) => void
  onBack: () => void
  accent?: string
}

export default function StepContact({ isProfessional, loading, error, onSubmit, onBack, accent = '#2563eb' }: Props) {
  const [name,           setName]           = useState('')
  const [email,          setEmail]          = useState('')
  const [phone,          setPhone]          = useState('')
  const [phoneTouched,   setPhoneTouched]   = useState(false)
  const [companyName,    setCompanyName]    = useState('')
  const [siret,          setSiret]          = useState('')
  const [siretTouched,   setSiretTouched]   = useState(false)
  const [billingAddress, setBillingAddress] = useState('')
  const [hp, setHp] = useState('') // honeypot anti-spam (caché aux humains)

  const phoneDigits = phone.replace(/\D/g, '')
  const phoneValid  = phoneDigits.length === 10
  const phoneError  = phoneTouched && !phoneValid

  const siretDigits = siret.replace(/\D/g, '')
  const siretValid  = siretDigits.length === 14
  const siretError  = siretTouched && !siretValid

  const proFieldsValid = !isProfessional || (companyName.trim().length >= 2 && siretValid)

  const canSubmit = name.trim() && email.includes('@') && phoneValid && proFieldsValid

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-shadow"
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({
      client_name:  name,
      client_email: email,
      client_phone: phone,
      hp,
      ...(isProfessional && {
        company_name:    companyName.trim(),
        siret:           siretDigits,
        billing_address: billingAddress.trim() || undefined,
      }),
    })
  }

  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">Vos coordonnées</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">Pour vous confirmer le rendez-vous</p>

      {/* Infos professionnelles */}
      {isProfessional && (
        <div className="mb-5 space-y-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Informations société</p>

          <div>
            <label className={labelClass}>Raison sociale <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="ACME SAS"
              className={inputClass}
              style={{ '--tw-ring-color': accent } as React.CSSProperties}
            />
          </div>

          <div>
            <label className={labelClass}>Numéro SIRET <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={siret}
              onChange={e => setSiret(e.target.value)}
              onBlur={() => setSiretTouched(true)}
              placeholder="123 456 789 01234"
              maxLength={17}
              className={`${inputClass} ${siretError ? 'border-red-400 dark:border-red-500 focus:ring-red-400' : ''}`}
              style={!siretError ? { '--tw-ring-color': accent } as React.CSSProperties : undefined}
            />
            {siretError ? (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
                </svg>
                {siretDigits.length < 14 ? `Numéro trop court (${siretDigits.length}/14 chiffres)` : 'Numéro trop long — 14 chiffres attendus'}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">14 chiffres sans espaces</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Adresse de facturation <span className="text-slate-400 font-normal">(optionnel)</span></label>
            <input
              type="text"
              value={billingAddress}
              onChange={e => setBillingAddress(e.target.value)}
              placeholder="Identique à l'adresse d'intervention si vide"
              className={inputClass}
              style={{ '--tw-ring-color': accent } as React.CSSProperties}
            />
          </div>
        </div>
      )}

      {/* Honeypot anti-spam : invisible aux humains, rempli par les bots */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
        <label>Ne pas remplir ce champ
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={hp} onChange={e => setHp(e.target.value)} />
        </label>
      </div>

      {/* Infos contact */}
      <div className="space-y-4 mb-6">
        <div>
          <label className={labelClass}>{isProfessional ? 'Nom du contact' : 'Prénom et nom'}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={isProfessional ? 'Marie Dupont' : 'Jean Dupont'}
            className={inputClass}
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
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
            style={{ '--tw-ring-color': accent } as React.CSSProperties}
          />
        </div>
        <div>
          <label className={labelClass}>Téléphone</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onBlur={() => setPhoneTouched(true)}
            placeholder="06 00 00 00 00"
            className={`${inputClass} ${phoneError ? 'border-red-400 dark:border-red-500 focus:ring-red-400' : ''}`}
            style={!phoneError ? { '--tw-ring-color': accent } as React.CSSProperties : undefined}
          />
          {phoneError && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
              </svg>
              {phoneDigits.length < 10 ? `Numéro trop court (${phoneDigits.length}/10 chiffres)` : 'Numéro trop long — 10 chiffres attendus'}
            </p>
          )}
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
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
          className="flex-1 py-3 px-4 text-white font-semibold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90 text-sm"
          style={{ backgroundColor: accent }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              Envoi en cours...
            </span>
          ) : 'Confirmer la réservation'}
        </button>
      </div>
    </div>
  )
}
