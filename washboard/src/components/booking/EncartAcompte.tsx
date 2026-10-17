'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { formatPrice } from '@/lib/pricing'

export type LienPaiement = { libelle: string; url: string; montantExact?: boolean }
export type VirementPaiement = { titulaire: string; iban: string; reference: string }
export type WeroPaiement = { telephone: string; lien: string | null }
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

/** QR code net, redessiné à partir d'un lien (ici celui du QR code Wero du laveur) :
 *  scannable avec l'appareil photo de n'importe quel téléphone. */
export function QrDepuisLien({ lien, taille = 160, alt }: { lien: string; taille?: number; alt: string }) {
  const [image, setImage] = useState<string | null>(null)
  useEffect(() => {
    let annule = false
    QRCode.toDataURL(lien, { errorCorrectionLevel: 'M', margin: 1, width: taille * 2 })
      .then(url => { if (!annule) setImage(url) })
      .catch(() => { /* sans QR code, le bouton et le numéro suffisent */ })
    return () => { annule = true }
  }, [lien, taille])
  if (!image) return <div style={{ width: taille, height: taille }} aria-hidden />
  // eslint-disable-next-line @next/next/no-img-element -- image générée dans le navigateur (data:)
  return <img src={image} alt={alt} width={taille} height={taille} className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700" style={{ width: taille, height: taille }} />
}

// Wero et virement ne sont pas des liens : ils demandent des informations à lire (numéro,
// IBAN, libellé). Pour ne pas allonger l'écran, chacun est un BOUTON comme les liens de
// paiement, qui déplie ses informations au toucher ; un seul ouvert à la fois (demande
// d'Alexandre, 2026-10-17 : « ça prend trop de place »).
function PanneauWero({ wero, montant, accent }: { wero: WeroPaiement; montant: number; accent: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 text-[13px] dark:border-zinc-700">
      <p className="text-zinc-500 dark:text-zinc-400">Envoyez {formatPrice(montant)} avec Wero, depuis l’application de votre banque.</p>
      {wero.lien && (
        <a href={wero.lien} target="_blank" rel="noopener noreferrer"
          className="mt-2.5 flex min-h-10 w-full items-center justify-center rounded-lg border px-3 text-[14px] font-semibold"
          style={{ borderColor: accent, color: accent }}>
          Ouvrir Wero
        </a>
      )}
      {/* Sur ordinateur : le QR code se scanne avec l'appareil photo du téléphone. */}
      {wero.lien && (
        <div className="mt-2.5 hidden items-center gap-3 sm:flex">
          <QrDepuisLien lien={wero.lien} taille={112} alt="QR code Wero du laveur" />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Ou scannez ce code avec l’appareil photo de votre téléphone.</p>
        </div>
      )}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span><span className="text-zinc-500 dark:text-zinc-400">Numéro Wero : </span><span className="select-all font-mono font-semibold">{wero.telephone}</span></span>
        <Copier texte={wero.telephone} libelle="le numéro Wero" />
      </div>
    </div>
  )
}

function PanneauVirement({ virement, montant }: { virement: VirementPaiement; montant: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-3 text-[13px] dark:border-zinc-700">
      <dl className="space-y-1.5">
        <div className="flex justify-between gap-2"><dt className="text-zinc-500 dark:text-zinc-400">Titulaire</dt><dd className="text-right font-medium">{virement.titulaire}</dd></div>
        <div>
          <div className="flex items-center justify-between gap-2"><dt className="text-zinc-500 dark:text-zinc-400">IBAN</dt><Copier texte={virement.iban} libelle="l’IBAN" /></div>
          <dd className="mt-1 select-all whitespace-nowrap font-mono text-[12.5px] tracking-tight">{virement.iban}</dd>
        </div>
        <div className="flex justify-between gap-2"><dt className="text-zinc-500 dark:text-zinc-400">Montant</dt><dd className="font-medium">{formatPrice(montant)}</dd></div>
        <div className="flex items-center justify-between gap-2"><dt className="text-zinc-500 dark:text-zinc-400">Libellé</dt><dd className="flex items-center gap-2"><span className="select-all font-mono font-semibold">{virement.reference}</span><Copier texte={virement.reference} libelle="le libellé" /></dd></div>
      </dl>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Un virement instantané arrive en quelques secondes.</p>
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
  const [ouvert, setOuvert] = useState<'wero' | 'virement' | null>(null)
  const bouton = 'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold text-white'
  const basculer = (cle: 'wero' | 'virement') => setOuvert(o => (o === cle ? null : cle))
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-left text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-semibold text-zinc-900 dark:text-zinc-100">
        {apres ? 'Acompte à régler maintenant' : 'Un acompte vous sera demandé'} : {formatPrice(montant)}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-zinc-500 dark:text-zinc-400">
        {conditions.map(c => <li key={c}>{c}</li>)}
        {!apres && moyens && moyens.length > 0 && <li>Paiement par {moyens.join(', ')}.</li>}
      </ul>

      {apres && (liens.length > 0 || wero || virement) && (
        <div className="mt-3 flex flex-col gap-2">
          {liens.map(l => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={bouton} style={{ background: accent }}>
              Payer avec {l.libelle}
            </a>
          ))}
          {wero && (
            <>
              <button type="button" onClick={() => basculer('wero')} aria-expanded={ouvert === 'wero'} className={bouton} style={{ background: accent }}>
                Payer avec Wero <span aria-hidden className={`transition-transform ${ouvert === 'wero' ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {ouvert === 'wero' && <PanneauWero wero={wero} montant={montant} accent={accent} />}
            </>
          )}
          {virement && (
            <>
              <button type="button" onClick={() => basculer('virement')} aria-expanded={ouvert === 'virement'} className={bouton} style={{ background: accent }}>
                Payer par virement <span aria-hidden className={`transition-transform ${ouvert === 'virement' ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {ouvert === 'virement' && <PanneauVirement virement={virement} montant={montant} />}
            </>
          )}
          {(liens.some(l => !l.montantExact) || wero) && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Si on vous demande le montant, indiquez {formatPrice(montant)}.</p>
          )}
        </div>
      )}
    </div>
  )
}
