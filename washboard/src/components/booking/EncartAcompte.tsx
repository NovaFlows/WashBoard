'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/pricing'

export type LienPaiement = { libelle: string; url: string; montantExact?: boolean }
export type VirementPaiement = { titulaire: string; iban: string; reference: string }
export type WeroPaiement = { telephone: string; qrUrl: string | null }
/** L'acompte tel que le serveur le renvoie après la réservation (`api/bookings`). */
export type AcompteDu = { montant: number; liens: LienPaiement[]; virement?: VirementPaiement | null; wero?: WeroPaiement | null; echeance: string | null; conditions: string[] }

// L'acompte demandé par le laveur (lib/acompte.ts), dit au client à deux moments :
// - AVANT de réserver (`liens` absents) : montant, conditions et moyens de paiement, pour
//   qu'il s'engage en connaissance de cause (remboursement, délai) ;
// - APRÈS (`liens` présents) : un bouton par lien de paiement du laveur, son numéro Wero et
//   les coordonnées du virement s'il les propose — rien de tout ça n'apparaît AVANT.
// Le paiement ne passe jamais par WashBoard : on ne sait pas s'il a eu lieu, c'est le
// laveur qui le confirme dans son tableau de bord.

function Copier({ texte, libelle }: { texte: string; libelle: string }) {
  const [fait, setFait] = useState<'ok' | 'ko' | null>(null)
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(texte.replace(/\s+/g, '')); setFait('ok') } catch { setFait('ko') }
      }}
      aria-label={`Copier ${libelle}`}
      className="shrink-0 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
    >
      {fait === 'ok' ? 'Copié' : fait === 'ko' ? 'Sélectionnez' : 'Copier'}
    </button>
  )
}

function Wero({ wero, montant, autres }: { wero: WeroPaiement; montant: number; autres: boolean }) {
  return (
    <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{autres ? 'Ou par Wero' : 'Par Wero'}</p>
      <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">
        Ouvrez Wero dans l’application de votre banque et envoyez {formatPrice(montant)} à ce numéro :
      </p>
      <p className="mt-2 flex items-center justify-between gap-2 text-[15px]">
        <span className="select-all font-mono font-semibold">{wero.telephone}</span>
        <Copier texte={wero.telephone} libelle="le numéro Wero" />
      </p>
      {/* Le QR code Wero du laveur, photographié dans son application : utile quand la
          réservation est faite sur un ordinateur ; sur téléphone, le numéro suffit. */}
      {wero.qrUrl && (
        <div className="mt-3 hidden items-center gap-3 sm:flex">
          {/* eslint-disable-next-line @next/next/no-img-element -- photo envoyée par le laveur */}
          <img src={wero.qrUrl} alt="QR code Wero du laveur" className="h-[140px] w-[140px] rounded-lg border border-zinc-200 bg-white object-contain dark:border-zinc-700" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ou scannez ce code depuis Wero, puis indiquez {formatPrice(montant)}.</p>
        </div>
      )}
    </div>
  )
}

export default function EncartAcompte({ montant, conditions, liens, virement = null, wero = null, moyens, accent = '#2563eb' }: {
  montant: number
  conditions: string[]
  liens?: LienPaiement[]
  virement?: VirementPaiement | null
  wero?: WeroPaiement | null
  /** Avant la réservation : les moyens de paiement proposés (« PayPal, Stripe, virement »). */
  moyens?: string[]
  accent?: string
}) {
  const apres = liens !== undefined
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
        {apres ? 'Acompte à régler maintenant' : 'Un acompte vous sera demandé'} : {formatPrice(montant)}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-zinc-500 dark:text-zinc-400">
        {conditions.map(c => <li key={c}>{c}</li>)}
        {!apres && moyens && moyens.length > 0 && <li>Paiement par {moyens.join(', ')}.</li>}
      </ul>

      {apres && liens.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {liens.map(l => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold text-white"
              style={{ background: accent }}
            >
              Payer avec {l.libelle}
            </a>
          ))}
          {liens.some(l => !l.montantExact) && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Si la page de paiement vous demande le montant, indiquez {formatPrice(montant)}.</p>
          )}
        </div>
      )}

      {apres && wero && <Wero wero={wero} montant={montant} autres={liens.length > 0} />}

      {apres && virement && (
        <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{liens.length || wero ? 'Ou par virement' : 'Par virement'}</p>
          <dl className="mt-2 space-y-2 text-[13px]">
            <div><dt className="text-zinc-500 dark:text-zinc-400">Titulaire</dt><dd className="font-medium">{virement.titulaire}</dd></div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">IBAN</dt>
              <dd className="flex items-center justify-between gap-2"><span className="select-all break-words font-mono">{virement.iban}</span><Copier texte={virement.iban} libelle="l’IBAN" /></dd>
            </div>
            <div><dt className="text-zinc-500 dark:text-zinc-400">Montant</dt><dd className="font-medium">{formatPrice(montant)}</dd></div>
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">Libellé à indiquer</dt>
              <dd className="flex items-center justify-between gap-2"><span className="select-all font-mono font-semibold">{virement.reference}</span><Copier texte={virement.reference} libelle="le libellé" /></dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Choisissez un virement instantané si votre banque le propose : il arrive en quelques secondes.</p>
        </div>
      )}
    </div>
  )
}
