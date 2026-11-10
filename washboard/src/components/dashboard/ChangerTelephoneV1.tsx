'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { confirmerCodeTelephone, demanderCodeTelephone } from '@/lib/changerTelephoneClient'
import { formatPhone } from '@/lib/phone'
import { validerTelephone } from '@/lib/profil'

// Changer de numéro dans l'ancien formulaire des réglages (site, 2026-11-10) — la même chose que
// la feuille « Téléphone » de Mon profil (`FeuilleTelephoneV2`), au style de l'ancien écran. Le
// numéro ne s'écrit plus librement : un code arrive par SMS sur le nouveau numéro, comme à
// l'inscription, et le mot de passe est demandé comme pour l'adresse e-mail.

const inputClass = 'w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow'
const labelClass = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5'
const boutonClass = 'rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors'
const lienClass = 'text-sm text-slate-500 dark:text-slate-400 underline underline-offset-2'

export default function ChangerTelephoneV1({ telephone }: { telephone: string | null }) {
  const router = useRouter()
  const [actuel, setActuel] = useState(telephone)
  const [ouvert, setOuvert] = useState(false)
  const [nouveau, setNouveau] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [code, setCode] = useState('')
  const [envoyeA, setEnvoyeA] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null)

  function fermer() {
    setOuvert(false); setEnvoyeA(null); setNouveau(''); setMotDePasse(''); setCode(''); setMessage(null)
  }

  async function demander(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerTelephone(nouveau) ?? (nouveau.trim() ? null : 'Indiquez votre nouveau numéro.')
    if (refus) { setMessage({ ok: false, texte: refus }); return }
    if (!motDePasse) { setMessage({ ok: false, texte: 'Indiquez votre mot de passe actuel.' }); return }
    setMessage(null)
    setEnCours(true)
    const r = await demanderCodeTelephone(nouveau.trim(), motDePasse)
    setEnCours(false)
    if (!r.ok) { setMessage({ ok: false, texte: r.message }); return }
    setMotDePasse('')
    setEnvoyeA(r.telephone)
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    if (!/^\d{6}$/.test(code.trim())) { setMessage({ ok: false, texte: 'Le code a 6 chiffres.' }); return }
    setMessage(null)
    setEnCours(true)
    const r = await confirmerCodeTelephone(code.trim())
    setEnCours(false)
    if (!r.ok) { setMessage({ ok: false, texte: r.message }); return }
    setActuel(r.telephone)
    fermer()
    setMessage({ ok: true, texte: 'Numéro mis à jour.' })
    router.refresh()
  }

  return (
    <div>
      <label className={labelClass}>Téléphone</label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-900 dark:text-slate-100">{actuel ? formatPhone(actuel) : 'Non renseigné'}</span>
        {!ouvert && <button type="button" onClick={() => { setOuvert(true); setMessage(null) }} className={lienClass}>Changer mon numéro</button>}
      </div>
      {message && !ouvert && (
        <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`} role={message.ok ? 'status' : 'alert'}>{message.texte}</p>
      )}

      {ouvert && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          {envoyeA ? (
            <form onSubmit={valider} noValidate className="space-y-3">
              <div>
                <label htmlFor="tel-code" className={labelClass}>Code reçu par SMS</label>
                <input
                  id="tel-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setMessage(null) }}
                  placeholder="6 chiffres" className={inputClass}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Un code vient de partir au {envoyeA}. Il est valable 10 minutes. Votre numéro ne change qu’une fois le code validé.
                </p>
              </div>
              {message && <p className="text-sm text-red-600" role="alert">{message.texte}</p>}
              <div className="flex items-center gap-4">
                <button type="submit" disabled={enCours} className={boutonClass}>{enCours ? 'Vérification…' : 'Valider le code'}</button>
                <button type="button" onClick={() => { setEnvoyeA(null); setCode(''); setMessage(null) }} className={lienClass}>Changer de numéro ou renvoyer le code</button>
              </div>
            </form>
          ) : (
            <form onSubmit={demander} noValidate className="space-y-3">
              <div>
                <label htmlFor="tel-nouveau" className={labelClass}>Nouveau numéro</label>
                <input
                  id="tel-nouveau" type="tel" inputMode="tel" autoComplete="tel"
                  value={nouveau} onChange={e => { setNouveau(e.target.value); setMessage(null) }}
                  placeholder="06 00 00 00 00" className={inputClass}
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Un mobile (06 ou 07) : un code de confirmation y sera envoyé par SMS.</p>
              </div>
              <div>
                <label htmlFor="tel-mdp" className={labelClass}>Votre mot de passe actuel</label>
                <input
                  id="tel-mdp" type="password" autoComplete="current-password"
                  value={motDePasse} onChange={e => { setMotDePasse(e.target.value); setMessage(null) }}
                  placeholder="Pour confirmer que c’est bien vous" className={inputClass}
                />
              </div>
              {message && <p className="text-sm text-red-600" role="alert">{message.texte}</p>}
              <div className="flex items-center gap-4">
                <button type="submit" disabled={enCours} className={boutonClass}>{enCours ? 'Envoi…' : 'Recevoir le code'}</button>
                <button type="button" onClick={fermer} className={lienClass}>Annuler</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
