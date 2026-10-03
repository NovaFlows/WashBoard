'use client'

import { useRef, useState } from 'react'
import type { BookingFormData, VehicleItem } from '@/types'
import { formatPrice } from '@/lib/pricing'
import BookingAction from './BookingAction'

type Contact = Pick<BookingFormData, 'client_name' | 'client_email' | 'client_phone'> & {
  notes?: string; company_name?: string; siret?: string; billing_address?: string; hp?: string; is_professional: boolean
}

export default function ContactDetails({ isProfessional, clientsProAutorises, factureApresPrestation, vehicles, onChange, loading, error, onSubmit, accent = '#2563eb', actionTarget, total, whatsappHref }: {
  isProfessional: boolean
  clientsProAutorises: boolean
  factureApresPrestation: boolean
  vehicles: VehicleItem[]
  onChange: (data: Partial<BookingFormData>) => void
  loading: boolean
  error: string | null
  onSubmit: (data: Contact) => void
  accent?: string
  actionTarget: HTMLElement | null
  total: number
  whatsappHref: string | null
}) {
  const ref = useRef<HTMLFormElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [pro, setPro] = useState(isProfessional)
  const [company, setCompany] = useState('')
  const [siret, setSiret] = useState('')
  const [billing, setBilling] = useState('')
  const [notes, setNotes] = useState('')
  const [hp, setHp] = useState('')
  const isVehicle = (type: string) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(type)
  const modelsValid = vehicles.every(v => !isVehicle(v.type) || v.models?.[0]?.trim())
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && phone.replace(/\D/g, '').length === 10 && modelsValid
    && (!pro || (company.trim().length >= 2 && siret.replace(/\D/g, '').length === 14))
  const input = 'w-full min-h-12 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-3 bg-white dark:bg-zinc-900 outline-none focus:border-zinc-500'
  const label = 'block text-sm font-medium mb-2'

  return <form ref={ref} onSubmit={e => {
    e.preventDefault()
    if (!valid || loading) return
    onSubmit({ client_name: name.trim(), client_email: email.trim(), client_phone: phone, notes: notes.trim() || undefined, hp,
      is_professional: pro, ...(pro ? { company_name: company.trim(), siret: siret.replace(/\D/g, ''), billing_address: billing.trim() || undefined } : {}),
    })
  }}>
    <h2 className="wb-booking-title mb-1!">Vos coordonnées</h2>
    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-5">Pour confirmer le rendez-vous et vous prévenir le jour J.</p>
    <div className="space-y-5">
      <div><label className={label} htmlFor="booking-name">Nom et prénom</label><input id="booking-name" autoComplete="name" required minLength={2} value={name} onChange={e => setName(e.target.value)} className={input} /></div>
      <div><label className={label} htmlFor="booking-phone">Téléphone</label><input id="booking-phone" autoComplete="tel" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" className={input} />
        {!!phone && phone.replace(/\D/g, '').length !== 10 && <p className="text-xs text-zinc-500 mt-1">Indiquez un numéro à 10 chiffres.</p>}</div>
      <div><label className={label} htmlFor="booking-email">Email <span className="font-normal text-zinc-500">pour recevoir le récapitulatif</span></label><input id="booking-email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={input} /></div>
      {vehicles.map((v, i) => isVehicle(v.type) && <div key={`${v.type}-${i}`}>
        <label className={label} htmlFor={`booking-model-${i}`}>Modèle {vehicles.length > 1 ? `· ${v.label ?? v.type} ${i + 1}` : 'du véhicule'}</label>
        <input id={`booking-model-${i}`} required value={v.models?.[0] ?? ''} placeholder="Ex. Peugeot 208 grise" className={input}
          onChange={e => onChange({ vehicles_detail: vehicles.map((item, index) => index === i ? { ...item, models: [e.target.value] } : item) })} />
      </div>)}
      {clientsProAutorises && <label className="flex items-center gap-3 text-sm cursor-pointer"><input type="checkbox" checked={pro} onChange={e => setPro(e.target.checked)} className="wb-booking-checkbox" />Je réserve pour une entreprise</label>}
      {pro && <>
        <div><label className={label} htmlFor="booking-company">Nom de l’entreprise</label><input id="booking-company" autoComplete="organization" required minLength={2} value={company} onChange={e => setCompany(e.target.value)} className={input} />
          <p className="text-xs text-zinc-500 mt-2">{factureApresPrestation ? 'La facture sera établie à ce nom.' : 'Le récapitulatif sera établi à ce nom.'}</p></div>
        <div><label className={label} htmlFor="booking-siret">SIRET</label><input id="booking-siret" inputMode="numeric" required value={siret} onChange={e => setSiret(e.target.value)} className={input} /><p className="text-xs text-zinc-500 mt-2">14 chiffres pour identifier votre entreprise.</p></div>
        <div><label className={label} htmlFor="booking-billing">Adresse de facturation <span className="text-zinc-500 font-normal">facultatif</span></label><input id="booking-billing" value={billing} onChange={e => setBilling(e.target.value)} className={input} placeholder="Adresse du lavage si vide" /></div>
      </>}
      <details><summary className="text-sm underline underline-offset-2 cursor-pointer py-2">Ajouter une précision pour le laveur</summary><label className="sr-only" htmlFor="booking-notes">Note pour le laveur</label><textarea id="booking-notes" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} className={input} placeholder="Code portail, accès…" rows={3} /></details>
    </div>
    <div aria-hidden="true" className="absolute w-px h-px overflow-hidden -left-[9999px]"><label>Ne pas remplir ce champ<input name="wb-confirm-c7f3" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="true" value={hp} onChange={e => setHp(e.target.value)} /></label></div>
    <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700 text-sm leading-relaxed">
      <p className="font-semibold">Rien à payer maintenant</p><p className="text-zinc-500 dark:text-zinc-400 mt-1">Vous réglez {formatPrice(total)} sur place, une fois le lavage terminé.</p>
      {whatsappHref && <><p className="font-semibold mt-3">Un empêchement ?</p><p className="text-zinc-500 dark:text-zinc-400">Écrivez au laveur sur WhatsApp pour décaler ou annuler.</p></>}
    </div>
    {error && <p role="alert" className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-sm">{error}</p>}
    <BookingAction target={actionTarget} accent={accent} disabled={!valid || loading} onClick={() => ref.current?.requestSubmit()}>
      {loading ? 'Envoi en cours…' : valid ? 'Confirmer la réservation' : 'Complétez vos coordonnées'}
    </BookingAction>
  </form>
}
