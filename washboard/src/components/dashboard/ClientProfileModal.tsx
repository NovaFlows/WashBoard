'use client'

import { useEffect, useRef } from 'react'
import { Building2, X, Phone, Mail, MapPin } from 'lucide-react'
import type { ClientProfile } from '@/lib/clientProfile'

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: 'bg-amber-100 dark:bg-amber-900/40',     text: 'text-amber-700 dark:text-amber-400',     label: 'En attente' },
  confirmed:   { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', label: 'Confirmé' },
  done:        { bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-700 dark:text-blue-400',       label: 'Terminé' },
  cancelled:   { bg: 'bg-red-100 dark:bg-red-900/40',         text: 'text-red-700 dark:text-red-400',         label: 'Annulé' },
  closed_late: { bg: 'bg-orange-100 dark:bg-orange-900/40',   text: 'text-orange-700 dark:text-orange-400',   label: 'Délai dépassé' },
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">{label}</p>
      <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5">{value}</p>
      {hint && <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  )
}

export default function ClientProfileModal({
  profile,
  onClose,
}: {
  profile: ClientProfile
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Échap pour fermer, et focus sur la fermeture à l'ouverture : la fiche
  // s'ouvre au clavier comme à la souris.
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const titre = profile.isProfessional && profile.companyName ? profile.companyName : profile.name

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${titre}`}
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm cursor-default"
      />

      <div className="relative w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="sticky top-0 flex items-start gap-3 p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base font-bold text-slate-500 shrink-0">
            {profile.isProfessional ? <Building2 size={20} strokeWidth={2} /> : profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-bold text-slate-900 dark:text-white truncate">{titre}</h2>
              {profile.isProfessional && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">PRO</span>
              )}
            </div>
            {profile.isProfessional && profile.companyName && (
              <p className="text-xs text-slate-400 truncate">{profile.name}</p>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Lavages" value={String(profile.honoredCount)} hint={profile.cancelledCount ? `${profile.cancelledCount} annulé${profile.cancelledCount > 1 ? 's' : ''}` : undefined} />
            <Stat label="Total" value={`${profile.totalRevenue}€`} />
            <Stat label="Panier moyen" value={`${profile.averageBasket}€`} />
          </div>

          {profile.daysSinceLastVisit !== null && profile.daysSinceLastVisit >= 90 && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2">
              Pas revenu depuis {profile.daysSinceLastVisit} jours — bon candidat à une relance.
            </p>
          )}

          <div className="space-y-2 text-sm">
            <a href={`mailto:${profile.email}`} className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors">
              <Mail size={15} className="text-slate-400 shrink-0" />
              <span className="truncate">{profile.email}</span>
            </a>
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 hover:text-[#1651E8] dark:hover:text-[#6A9FFF] transition-colors">
                <Phone size={15} className="text-slate-400 shrink-0" />
                {profile.phone}
              </a>
            )}
            {profile.addresses.map(a => (
              <p key={a} className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
                <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <span>{a}</span>
              </p>
            ))}
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold mb-2">
              Historique ({profile.bookings.length})
            </p>
            <div className="space-y-0">
              {profile.bookings.map(b => {
                const s = STATUS[b.closed_late ? 'closed_late' : b.status]
                return (
                  <div key={b.id} className="flex items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {b.services?.name ?? 'Prestation'}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(b.scheduled_at)}</p>
                    </div>
                    <span className="font-semibold text-sm text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                      {b.booked_price ?? b.services?.price ?? 0}€
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
