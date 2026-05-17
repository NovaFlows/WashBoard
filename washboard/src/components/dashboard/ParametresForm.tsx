'use client'

import { useState } from 'react'
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
  const [name, setName] = useState(washer.name)
  const [phone, setPhone] = useState(washer.phone ?? '')
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
      body: JSON.stringify({ name, phone }),
    })
    setProfileMsg(res.ok
      ? { ok: true, text: 'Profil mis à jour' }
      : { ok: false, text: 'Erreur lors de la mise à jour' }
    )
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
          Personnalisez votre logo, vos couleurs, vos prestations et vos disponibilités directement depuis le panneau admin.
        </p>
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Disponible en V3 — En cours de développement</p>
        </div>
        <button disabled className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-xl text-sm opacity-40 cursor-not-allowed">
          Accéder au panneau admin
        </button>
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
