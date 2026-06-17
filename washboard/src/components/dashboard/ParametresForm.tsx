'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Washer } from '@/types'
import Link from 'next/link'

type Props = {
  washer: Washer
  email: string
}

type Tab = 'general' | 'client'

export default function ParametresForm({ washer, email }: Props) {
  const [tab, setTab] = useState<Tab>('general')

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6 w-fit">
        {(['general', 'client'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t === 'general' ? 'Général' : 'Page client'}
          </button>
        ))}
      </div>

      {tab === 'general' && <GeneralTab washer={washer} email={email} />}
      {tab === 'client' && <ClientTab washer={washer} />}
    </div>
  )
}

/* ── Onglet Général ── */
function GeneralTab({ washer, email }: { washer: Washer; email: string }) {
  const router = useRouter()
  const [name, setName] = useState(washer.name)
  const [phone, setPhone] = useState(washer.phone ?? '')
  const [teamSize, setTeamSize] = useState(String(washer.team_size ?? 1))
  const [travelFee, setTravelFee] = useState(String(washer.travel_fee ?? 0))
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [newEmail, setNewEmail] = useState(email)
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pwdLoading, setPwdLoading] = useState(false)

  const supabase = createClient()

  const inputClass = "w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
  const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg(null)
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, team_size: Math.max(1, parseInt(teamSize) || 1), travel_fee: Math.max(0, parseFloat(travelFee) || 0) }),
    })
    if (res.ok) {
      setProfileMsg({ ok: true, text: 'Profil mis à jour' })
      router.refresh()
    } else {
      setProfileMsg({ ok: false, text: 'Erreur lors de la mise à jour' })
    }
    setProfileLoading(false)
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailLoading(true)
    setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailMsg(error
      ? { ok: false, text: 'Erreur : ' + error.message }
      : { ok: true, text: 'Un email de confirmation a été envoyé' }
    )
    setEmailLoading(false)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: 'Les mots de passe ne correspondent pas' })
      return
    }
    if (newPwd.length < 6) {
      setPwdMsg({ ok: false, text: 'Minimum 6 caractères' })
      return
    }
    setPwdLoading(true)
    setPwdMsg(null)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (!error) { setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }
    setPwdMsg(error
      ? { ok: false, text: 'Erreur : ' + error.message }
      : { ok: true, text: 'Mot de passe mis à jour' }
    )
    setPwdLoading(false)
  }

  return (
    <div className="space-y-5">
      {/* Profil */}
      <Card title="Mon profil" icon="👤">
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className={labelClass}>Nom de l'entreprise</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 00 00 00 00" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Frais de déplacement (€)</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                step={0.5}
                value={travelFee}
                onChange={e => setTravelFee(e.target.value)}
                onBlur={() => {
                  const v = parseFloat(travelFee)
                  setTravelFee(String(isNaN(v) || v < 0 ? 0 : v))
                }}
                placeholder="0"
                className={`${inputClass} w-32`}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {parseFloat(travelFee) > 0
                  ? `Ajouté à chaque réservation`
                  : 'Aucun frais de déplacement'}
              </p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Nombre de laveurs</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={20}
                value={teamSize}
                onChange={e => setTeamSize(e.target.value)}
                onBlur={() => {
                  const v = parseInt(teamSize)
                  setTeamSize(String(isNaN(v) || v < 1 ? 1 : v))
                }}
                className={`${inputClass} w-24`}
              />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {parseInt(teamSize) <= 1 ? 'Aucun chevauchement de RDV' : `Jusqu'à ${teamSize} RDV simultanés`}
              </p>
            </div>
          </div>
          <Feedback msg={profileMsg} />
          <SaveButton loading={profileLoading} />
        </form>
      </Card>

      {/* Email */}
      <Card title="Adresse email" icon="✉️">
        <form onSubmit={saveEmail} className="space-y-4">
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className={inputClass} />
          </div>
          <Feedback msg={emailMsg} />
          <SaveButton loading={emailLoading} label="Changer l'email" />
        </form>
      </Card>

      {/* Mot de passe */}
      <Card title="Mot de passe" icon="🔒">
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className={labelClass}>Nouveau mot de passe</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Min. 6 caractères" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Confirmer</label>
            <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} placeholder="••••••••" required className={inputClass} />
          </div>
          <Feedback msg={pwdMsg} />
          <SaveButton loading={pwdLoading} label="Changer le mot de passe" />
        </form>
      </Card>
    </div>
  )
}

/* ── Onglet Page client ── */
function ClientTab({ washer }: { washer: Washer }) {
  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/${washer.slug}`

  return (
    <div className="space-y-5">
      <Card title="Votre page de réservation" icon="🔗">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Partagez ce lien à vos clients pour qu'ils puissent réserver en ligne.
        </p>
        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-sm text-blue-600 dark:text-blue-400 font-mono flex-1 truncate">/book/{washer.slug}</span>
          <button
            onClick={() => navigator.clipboard.writeText(bookingUrl)}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
          >
            Copier
          </button>
        </div>
      </Card>

      <Card title="Personnalisation de la page client" icon="🎨">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Configurez votre logo, votre message d'accueil, vos prestations et vos disponibilités.
        </p>
        <Link
          href="/dashboard/admin"
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Configurer ma page client
        </Link>
      </Card>
    </div>
  )
}

/* ── Composants utilitaires ── */
function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <span>{icon}</span>{title}
      </h2>
      {children}
    </div>
  )
}

function Feedback({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <p className={`text-sm font-medium ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {msg.ok ? '✓ ' : '✕ '}{msg.text}
    </p>
  )
}

function SaveButton({ loading, label = 'Enregistrer' }: { loading: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
    >
      {loading ? 'Enregistrement...' : label}
    </button>
  )
}
