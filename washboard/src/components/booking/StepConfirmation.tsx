'use client'

import { useState } from 'react'
import type { Service } from '@/types'
import type { FormState } from './BookingForm'
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'
import { formatPrice, dureeTotale } from '@/lib/pricing'
import { buildIcs } from '@/lib/ics'
import { SOURCES_DECOUVERTE, type SourceDecouverte } from '@/lib/sourceDecouverte'

type Props = {
  washerName: string
  bookingId: string
  form: FormState
  services: Service[]
  /** Même lien que celui utilisé pour « Une question avant de réserver ? »
   *  pendant le formulaire (voir BookingForm) — `null` si le laveur n'a pas
   *  de téléphone ou a atteint son plafond de réservations du mois. */
  whatsappHref?: string | null
}

export default function StepConfirmation({ washerName, bookingId, form, services, whatsappHref = null }: Props) {
  const service = services.find(s => s.id === form.service_id)
  const date = form.scheduled_at ? new Date(form.scheduled_at) : null
  const displayPrice = form.booked_price ?? service?.price ?? 0
  const total = displayPrice + (form.travel_fee ?? 0) - (form.is_smart_slot ? Number(form.smart_discount ?? 0) : 0)

  const [source, setSource] = useState<SourceDecouverte | null>(null)
  const [sourceEnvoi, setSourceEnvoi] = useState<'repos' | 'envoi' | 'fait' | 'erreur'>('repos')

  function choisirSource(valeur: SourceDecouverte) {
    if (sourceEnvoi === 'envoi' || sourceEnvoi === 'fait') return
    setSource(valeur)
    setSourceEnvoi('envoi')
    fetch(`/api/bookings/${bookingId}/source`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: valeur }),
    })
      .then(r => { if (!r.ok) throw new Error() })
      .then(() => setSourceEnvoi('fait'))
      .catch(() => setSourceEnvoi('erreur'))
  }

  function telechargerIcs() {
    if (!date) return
    const duree = dureeTotale(
      service?.duration_minutes ?? 60,
      form.vehicles_detail,
      form.selected_addons,
      form.vehicle_count,
    )
    const ics = buildIcs({
      uid: `${bookingId}@washboard.fr`,
      title: `Lavage${service ? ` ${service.name}` : ''} — ${washerName}`,
      location: form.address,
      description: `Rendez-vous avec ${washerName}. À régler sur place : ${formatPrice(total)}.`,
      start: date,
      durationMinutes: duree,
    })
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rendez-vous-${bookingId.slice(0, 8).toUpperCase()}.ics`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="text-center py-2">
      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Réservation envoyée !</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Un email de confirmation vous a été envoyé</p>

      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-left space-y-3 mb-5">
        <Row label="Prestataire" value={washerName} />
        {service && (
          <Row
            label="Prestation"
            value={
              form.is_smart_slot && Number(form.smart_discount) > 0
                ? `${service.name} — ${formatPrice(displayPrice - Number(form.smart_discount))} ★`
                : `${service.name} — ${displayPrice}€`
            }
          />
        )}
        {form.vehicles_detail && form.vehicles_detail.length > 0 && (
          <div className="flex justify-between text-sm gap-3">
            <span className="text-slate-500 dark:text-slate-400 shrink-0">
              Véhicule{form.vehicles_detail.reduce((s, v) => s + v.count, 0) > 1 ? 's' : ''}
            </span>
            <div className="font-medium text-slate-900 dark:text-slate-100 text-right space-y-0.5">
              {form.vehicles_detail.flatMap(v => {
                const label = v.label ?? VEHICLE_LABELS[v.type] ?? v.type
                const mdls = (v.models ?? []).map(m => m.trim()).filter(Boolean)
                if (mdls.length === 0) return [`${label} × ${v.count}`]
                const lines = mdls.map(m => `${label} — ${m}`)
                if (mdls.length < v.count) lines.push(`${label} × ${v.count - mdls.length}`)
                return lines
              }).map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        )}
        {form.selected_addons && form.selected_addons.length > 0 && (
          form.selected_addons.map(a => (
            <Row key={a.id} label={a.label} value={`+${a.price}€`} />
          ))
        )}
        {form.travel_fee != null && form.travel_fee > 0 && (
          <Row label="Frais de déplacement" value={`+${form.travel_fee}€`} />
        )}
        {form.travel_fee != null && form.travel_fee > 0 && (
          <div className="flex justify-between text-sm gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Total</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{formatPrice(total)}</span>
          </div>
        )}
        {date && (
          <Row
            label="Date & heure"
            value={`${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
          />
        )}
        {form.address && <Row label="Adresse" value={form.address} right />}
        {form.notes && <Row label="Note" value={form.notes} right />}
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg mb-5">
        <span className="text-xs text-slate-500 dark:text-slate-400">Référence</span>
        <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">
          {bookingId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 mb-6">
        {date && (
          <button
            type="button"
            onClick={telechargerIcs}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l2 2 4-4" />
            </svg>
            Ajouter à mon agenda
          </button>
        )}

        <a
          href={`/api/bookings/${bookingId}/pdf`}
          download={`confirmation-${bookingId.slice(0, 8).toUpperCase()}.pdf`}
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Télécharger la confirmation PDF
        </a>

        {whatsappHref && (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Écrire à {washerName.split(' ')[0]} sur WhatsApp
          </a>
        )}
      </div>

      {/* Facultatif, posé APRÈS la confirmation : on ne retarde jamais la
          réservation elle-même pour une question statistique. Liste fermée
          (voir lib/sourceDecouverte) — jamais un champ de texte libre. */}
      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-left">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Comment avez-vous connu {washerName} ?
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 mb-3">Facultatif, un seul geste.</p>
        <div className="flex flex-wrap gap-2">
          {SOURCES_DECOUVERTE.map(s => {
            const selected = source === s.valeur
            return (
              <button
                key={s.valeur}
                type="button"
                aria-pressed={selected}
                onClick={() => choisirSource(s.valeur)}
                disabled={sourceEnvoi === 'fait' && !selected}
                className="min-h-[36px] px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors disabled:opacity-40"
                style={selected
                  ? { backgroundColor: '#0f172a', borderColor: '#0f172a', color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: '#e2e8f0', color: '#475569' }
                }
              >
                {s.label}
              </button>
            )
          })}
        </div>
        {sourceEnvoi === 'fait' && (
          <p role="status" className="mt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Merci, c&apos;est noté.</p>
        )}
        {sourceEnvoi === 'erreur' && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            Impossible d&apos;enregistrer votre réponse pour l&apos;instant.
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, right }: { label: string; value: string; right?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-3">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
      <span className={`font-medium text-slate-900 dark:text-slate-100 ${right ? 'text-right' : ''}`}>{value}</span>
    </div>
  )
}
