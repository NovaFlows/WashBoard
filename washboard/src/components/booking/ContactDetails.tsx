'use client'

import { useRef, useState, useEffect } from 'react'
import type { BookingFormData, VehicleItem } from '@/types'
import { formatPrice } from '@/lib/pricing'
import EncartAcompte from './EncartAcompte'
import { normalizePhone, PAYS_TELEPHONE, type PaysTelephone } from '@/lib/phone'
import BookingAction from './BookingAction'
import { useT } from '@/components/i18n/I18nProvider'

type Contact = Pick<BookingFormData, 'client_name' | 'client_email' | 'client_phone'> & {
  notes?: string; company_name?: string; siret?: string; billing_address?: string; hp?: string; is_professional: boolean
  acompte_accepte?: boolean
}

export default function ContactDetails({ isProfessional, clientsProAutorises, factureApresPrestation, vehicles, onChange, loading, error, onSubmit, accent = '#2563eb', actionTarget, total, whatsappHref, acompte = null, onCoordonnees, fidelite = null, pays }: {
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
  /** Acompte demandé par le laveur, annoncé AVANT la réservation (lib/acompte.ts). */
  acompte?: { montant: number; conditions: string[]; moyens?: string[] } | null
  /** Appelé à chaque frappe dans l'email ou le téléphone : la carte de fidélité se cherche à
   *  partir de ces coordonnées (voir EncartFidelite). */
  onCoordonnees?: (email: string, telephone: string) => void
  /** Carte de fidélité du client, montrée une fois ses coordonnées tapées. */
  fidelite?: React.ReactNode
  /** Pays du laveur (d'après son téléphone) : un client luxembourgeois ou québécois tape son numéro sans zéro de tête. */
  pays?: PaysTelephone
}) {
  const t = useT()
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
  // Case « j'accepte les conditions de l'acompte » (Alexandre, 2026-10-19, conseil du `legal` :
  // une preuve d'acceptation) — obligatoire dès qu'un acompte est demandé ; le serveur refuse
  // aussi une réservation avec acompte sans elle.
  const [acompteAccepte, setAcompteAccepte] = useState(false)
  const isVehicle = (type: string) => !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(type)
  const modelsValid = vehicles.every(v => !isVehicle(v.type) || v.models?.[0]?.trim())
  // Accepte aussi le « +33 » (et « 0033 ») : refusé avant, alors que c'est la
  // forme que l'iPhone propose lui-même en autocomplétion — signalé par
  // Alexandre le 2026-10-04 après l'avoir vécu en testant sur son téléphone.
  // Même normalisation que washer/route.ts et lib/phone.ts partout ailleurs.
  const phoneNormalise = normalizePhone(phone, pays)
  const exemplePhone = PAYS_TELEPHONE.find(p => p.code === pays)?.exemple ?? '06 12 34 56 78'
  useEffect(() => { onCoordonnees?.(email, phone) }, [email, phone, onCoordonnees])
  // Numéro IDE suisse (CHE-123.456.789) : on garde « CHE » devant les 9 chiffres.
  const siretEnvoye = /^\s*CHE/i.test(siret) ? `CHE${siret.replace(/\D/g, '')}` : siret.replace(/\D/g, '')
  const siretOk = /^CHE\d{9}$/.test(siretEnvoye) || [10, 14].includes(siretEnvoye.length)
  const valid = name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) && phoneNormalise !== null && modelsValid
    && (!pro || (company.trim().length >= 2 && siretOk))
  const pret = valid && (!acompte || acompteAccepte)
  const input = 'w-full min-h-12 border border-zinc-300 dark:border-zinc-700 rounded-xl px-3 py-3 bg-white dark:bg-zinc-900 outline-none focus:border-zinc-500'
  const label = 'block text-sm font-medium mb-2'

  return <form ref={ref} onSubmit={e => {
    e.preventDefault()
    if (!pret || !phoneNormalise || loading) return
    onSubmit({ client_name: name.trim(), client_email: email.trim(), client_phone: phoneNormalise, notes: notes.trim() || undefined, hp,
      is_professional: pro, ...(pro ? { company_name: company.trim(), siret: siretEnvoye, billing_address: billing.trim() || undefined } : {}),
      ...(acompte ? { acompte_accepte: true } : {}),
    })
  }}>
    <h2 className="wb-booking-title mb-1!">{t('Vos coordonnées')}</h2>
    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-5">{t('Pour confirmer le rendez-vous et vous prévenir le jour J.')}</p>
    <div className="space-y-5">
      <div><label className={label} htmlFor="booking-name">{t('Nom et prénom')}</label><input id="booking-name" autoComplete="name" required minLength={2} value={name} onChange={e => setName(e.target.value)} className={input} /></div>
      <div><label className={label} htmlFor="booking-phone">{t('Téléphone')}</label><input id="booking-phone" autoComplete="tel" type="tel" required value={phone} onChange={e => setPhone(e.target.value)} placeholder={exemplePhone} className={input} />
        {!!phone && !phoneNormalise && <p className="text-xs text-zinc-500 mt-1">{t('Indiquez un numéro valide (ex.')} {exemplePhone}{t(') ou au format international (+33…).')}</p>}</div>
      <div><label className={label} htmlFor="booking-email">{t('Email')} <span className="font-normal text-zinc-500">{t('pour recevoir le récapitulatif')}</span></label><input id="booking-email" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={input} /></div>
      {vehicles.map((v, i) => isVehicle(v.type) && <div key={`${v.type}-${i}`}>
        <label className={label} htmlFor={`booking-model-${i}`}>{t('Modèle')} {vehicles.length > 1 ? `· ${v.label ?? v.type} ${i + 1}` : t('du véhicule')}</label>
        <input id={`booking-model-${i}`} required value={v.models?.[0] ?? ''} placeholder={t('Ex. Peugeot 208 grise')} className={input}
          onChange={e => onChange({ vehicles_detail: vehicles.map((item, index) => index === i ? { ...item, models: [e.target.value] } : item) })} />
      </div>)}
      {clientsProAutorises && <label className="flex items-center gap-3 text-sm cursor-pointer"><input type="checkbox" checked={pro} onChange={e => setPro(e.target.checked)} className="wb-booking-checkbox" />{t('Je réserve pour une entreprise')}</label>}
      {pro && <>
        <div><label className={label} htmlFor="booking-company">{t('Nom de l’entreprise')}</label><input id="booking-company" autoComplete="organization" required minLength={2} value={company} onChange={e => setCompany(e.target.value)} className={input} />
          <p className="text-xs text-zinc-500 mt-2">{factureApresPrestation ? t('La facture sera établie à ce nom.') : t('Le récapitulatif sera établi à ce nom.')}</p></div>
        <div><label className={label} htmlFor="booking-siret">{t('SIRET, n° BCE (Belgique) ou n° IDE (Suisse)')}</label><input id="booking-siret" required value={siret} onChange={e => setSiret(e.target.value)} className={input} /><p className="text-xs text-zinc-500 mt-2">{t('14 chiffres pour identifier votre entreprise (Suisse : CHE-123.456.789).')}</p></div>
        <div><label className={label} htmlFor="booking-billing">{t('Adresse de facturation')} <span className="text-zinc-500 font-normal">{t('facultatif')}</span></label><input id="booking-billing" value={billing} onChange={e => setBilling(e.target.value)} className={input} placeholder={t('Adresse du lavage si vide')} /></div>
      </>}
      <details><summary className="text-sm underline underline-offset-2 cursor-pointer py-2">{t('Ajouter une précision pour le laveur')}</summary><label className="sr-only" htmlFor="booking-notes">{t('Note pour le laveur')}</label><textarea id="booking-notes" value={notes} maxLength={1000} onChange={e => setNotes(e.target.value)} className={input} placeholder={t('Code portail, accès…')} rows={3} /></details>
    </div>
    <div aria-hidden="true" className="absolute w-px h-px overflow-hidden -left-[9999px]"><label>{t('Ne pas remplir ce champ')}<input name="wb-confirm-c7f3" tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="true" value={hp} onChange={e => setHp(e.target.value)} /></label></div>
    <div className="mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-700 text-sm leading-relaxed">
      {fidelite && <div className="mb-4">{fidelite}</div>}
      {acompte
        ? <>
          <EncartAcompte montant={acompte.montant} conditions={acompte.conditions} moyens={acompte.moyens} />
          <label className="mt-3 flex items-start gap-3 cursor-pointer">
            <input type="checkbox" required checked={acompteAccepte} onChange={e => setAcompteAccepte(e.target.checked)} className="wb-booking-checkbox mt-0.5 shrink-0" />
            <span>{t('J’ai lu et j’accepte les conditions de l’acompte.')}</span>
          </label>
        </>
        : <><p className="font-semibold">{t('Rien à payer maintenant')}</p><p className="text-zinc-500 dark:text-zinc-400 mt-1">{t('Vous réglez')} {formatPrice(total)} {t('sur place, une fois le lavage terminé.')}</p></>}
      {whatsappHref && <><p className="font-semibold mt-3">{t('Un empêchement ?')}</p><p className="text-zinc-500 dark:text-zinc-400">{t('Écrivez au laveur sur WhatsApp pour décaler ou annuler.')}</p></>}
    </div>
    {error && <p role="alert" className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-sm">{error}</p>}
    <BookingAction target={actionTarget} accent={accent} disabled={!pret || loading} onClick={() => ref.current?.requestSubmit()}>
      {loading ? 'Envoi en cours…' : pret ? t('Confirmer la réservation') : valid ? t('Acceptez les conditions de l’acompte') : t('Complétez vos coordonnées')}
    </BookingAction>
  </form>
}
