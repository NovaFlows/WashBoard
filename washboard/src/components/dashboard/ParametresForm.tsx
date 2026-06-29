'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Washer } from '@/types'
import Link from 'next/link'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'

type Props = {
  washer: Washer
  email: string
}

type Tab = 'general' | 'client'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+0-9 ().-]{6,20}$/

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
  const [baseAddress, setBaseAddress] = useState(washer.base_address ?? '')
  const [tiers, setTiers] = useState<{ max_minutes: number; fee: number }[]>(washer.travel_fee_tiers ?? [])
  const [tierDraft, setTierDraft] = useState({ max_minutes: '', fee: '' })
  const [tierErr, setTierErr] = useState<string | null>(null)
  const [travelFeeMode, setTravelFeeMode] = useState<'base' | 'previous'>(washer.travel_fee_mode ?? 'base')
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

  function addTier() {
    const mins = parseInt(tierDraft.max_minutes)
    const fee  = parseFloat(tierDraft.fee)
    setTierErr(null)
    if (isNaN(mins) || mins <= 0) { setTierErr('La durée doit être un nombre de minutes positif'); return }
    if (isNaN(fee) || fee < 0) { setTierErr('Le frais doit être positif ou nul'); return }
    setTiers(prev => [...prev.filter(t => t.max_minutes !== mins), { max_minutes: mins, fee }].sort((a, b) => a.max_minutes - b.max_minutes))
    setTierDraft({ max_minutes: '', fee: '' })
  }

  function removeTier(mins: number) {
    setTiers(prev => prev.filter(t => t.max_minutes !== mins))
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileMsg(null)
    if (!name.trim()) { setProfileMsg({ ok: false, text: "Le nom de l'entreprise est requis" }); return }
    if (phone.trim() && !PHONE_RE.test(phone.trim())) { setProfileMsg({ ok: false, text: 'Numéro de téléphone invalide' }); return }
    setProfileLoading(true)
    const res = await fetch('/api/washer', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        team_size: Math.max(1, parseInt(teamSize) || 1),
        base_address: baseAddress.trim() || null,
        travel_fee_tiers: tiers,
        travel_fee_mode: travelFeeMode,
      }),
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
    setEmailMsg(null)
    if (!EMAIL_RE.test(newEmail.trim())) { setEmailMsg({ ok: false, text: 'Adresse email invalide' }); return }
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
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
        <form onSubmit={saveProfile} noValidate className="space-y-4">
          <div>
            <label className={labelClass}>Nom de l'entreprise</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 00 00 00 00" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Adresse de départ (pour le calcul de déplacement)</label>
            <AddressAutocomplete
              value={baseAddress}
              onChange={setBaseAddress}
              placeholder="12 rue de la Paix, 75001 Paris"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Frais de déplacement par durée</label>
            <div className="space-y-2 mb-3">
              {tiers.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500">Aucun frais de déplacement configuré.</p>
              )}
              {tiers.map(t => (
                <div key={t.max_minutes} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-slate-700 dark:text-slate-300">
                    Jusqu'à {t.max_minutes} min → <strong>{t.fee}€</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTier(t.max_minutes)}
                    className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Durée max (min)</p>
                <input
                  type="number"
                  min={1}
                  placeholder="30"
                  value={tierDraft.max_minutes}
                  onChange={e => setTierDraft(d => ({ ...d, max_minutes: e.target.value }))}
                  className={`${inputClass} w-28`}
                />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Frais (€)</p>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="15"
                  value={tierDraft.fee}
                  onChange={e => setTierDraft(d => ({ ...d, fee: e.target.value }))}
                  className={`${inputClass} w-24`}
                />
              </div>
              <button
                type="button"
                onClick={addTier}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors"
              >
                + Ajouter
              </button>
            </div>
            {tierErr && <p className="text-xs text-red-500 mt-2">{tierErr}</p>}
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              Les frais sont calculés automatiquement selon la durée de trajet.
            </p>
          </div>

          {tiers.length > 0 && (
            <div>
              <label className={labelClass}>Calculer le trajet depuis</label>
              <div className="flex flex-col gap-2">
                {([
                  { value: 'base',     label: 'Mon siège (adresse de départ)',      desc: 'Toujours calculé depuis votre adresse fixe' },
                  { value: 'previous', label: 'Le RDV précédent de la journée',     desc: 'Calcul depuis le dernier client — plus précis pour les tournées' },
                ] as const).map(opt => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      travelFeeMode === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="travel_fee_mode"
                      value={opt.value}
                      checked={travelFeeMode === opt.value}
                      onChange={() => setTravelFeeMode(opt.value)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{opt.label}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

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
        <form onSubmit={saveEmail} noValidate className="space-y-4">
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
        <form onSubmit={savePassword} noValidate className="space-y-4">
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

      {/* Zone de danger */}
      <DangerZone washer={washer} />
    </div>
  )
}

/* ── Zone de danger : désactivation / suppression de compte ── */
function DangerZone({ washer }: { washer: Washer }) {
  const router = useRouter()
  const status = washer.account_status ?? 'active'
  const [busy, setBusy]               = useState(false)
  const [err, setErr]                 = useState<string | null>(null)
  const [showDelete, setShowDelete]   = useState(false)
  const [confirmName, setConfirmName] = useState('')

  const [now] = useState(() => Date.now())
  const daysLeft = washer.deletion_scheduled_at
    ? Math.max(0, 30 - Math.floor((now - new Date(washer.deletion_scheduled_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 30

  async function call(action: 'deactivate' | 'reactivate' | 'delete', confirm_name?: string) {
    setBusy(true); setErr(null)
    const res = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, confirm_name }),
    })
    const json = await res.json().catch(() => null)
    setBusy(false)
    if (!res.ok) { setErr(json?.error ?? 'Une erreur est survenue'); return }
    setShowDelete(false); setConfirmName('')
    router.refresh()
  }

  // ── Compte en cours de suppression ──
  if (status === 'pending_deletion') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-300 dark:border-red-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2 flex items-center gap-2"><span>⏳</span>Suppression programmée</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
          Votre compte sera <strong>définitivement supprimé dans {daysLeft} jour{daysLeft > 1 ? 's' : ''}</strong>.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Toutes vos données (clients, rendez-vous, comptabilité) seront effacées. Votre page de réservation est déjà masquée.
        </p>
        {err && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{err}</p>}
        <button onClick={() => call('reactivate')} disabled={busy}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {busy ? '...' : 'Annuler la suppression'}
        </button>
      </div>
    )
  }

  // ── Compte désactivé ──
  if (status === 'deactivated') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-amber-300 dark:border-amber-800 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2"><span>⏸️</span>Compte désactivé</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Votre page de réservation est masquée et vous ne recevez plus de nouveaux rendez-vous. Vos données sont conservées.
        </p>
        {err && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{err}</p>}
        <button onClick={() => call('reactivate')} disabled={busy}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors">
          {busy ? '...' : 'Réactiver mon compte'}
        </button>
      </div>
    )
  }

  // ── Compte actif : désactiver / supprimer ──
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-200 dark:border-red-900/50 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2"><span>⚠️</span>Zone de danger</h2>

      <div className="flex items-start justify-between gap-4 flex-wrap pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Désactiver mon compte</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Masque votre page de réservation. Réversible à tout moment, vos données sont conservées.</p>
        </div>
        <button onClick={() => call('deactivate')} disabled={busy}
          className="px-4 py-2 border-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-sm font-semibold rounded-xl hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-40 transition-colors shrink-0">
          Désactiver
        </button>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[12rem]">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Supprimer définitivement</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Efface votre compte et toutes vos données après 30 jours. Irréversible passé ce délai.</p>
        </div>
        <button onClick={() => { setShowDelete(true); setErr(null); setConfirmName('') }}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
          Supprimer
        </button>
      </div>

      {err && !showDelete && <p className="text-xs text-red-600 dark:text-red-400 mt-3">{err}</p>}

      {/* Modal de confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setShowDelete(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">Supprimer définitivement le compte</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Cette action programme la suppression de votre compte et de <strong>toutes vos données</strong> (clients, rendez-vous, comptabilité, prestations). Vous avez <strong>30 jours</strong> pour annuler avant l&apos;effacement définitif.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2.5 mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Si vous avez un abonnement en cours, pensez à le résilier avant la prochaine échéance pour éviter d&apos;être prélevé.
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Pour confirmer, tapez le nom de votre entreprise : <strong className="text-slate-800 dark:text-slate-200">{washer.name}</strong>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={washer.name}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 mb-2"
            />
            {err && <p className="text-xs text-red-600 dark:text-red-400 mb-2">{err}</p>}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => call('delete', confirmName)}
                disabled={busy || confirmName.trim().toLowerCase() !== washer.name.trim().toLowerCase()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-colors"
              >
                {busy ? 'Suppression...' : 'Supprimer mon compte'}
              </button>
              <button onClick={() => setShowDelete(false)} disabled={busy}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
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
