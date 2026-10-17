'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce, titre } from '@/components/dashboard/FeuilleV2'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import EncartAcompte from '@/components/booking/EncartAcompte'
import {
  APPLIS_PAIEMENT, DELAIS_PAIEMENT, DELAIS_REMBOURSEMENT, conditionsAcompte, montantAcompte, type LiensPaiement, type ReglagesAcompte, type TypeAcompte,
} from '@/lib/acompte'

// « Acompte » — décisions d'Alexandre, 2026-10-17 : option 1 (lien de paiement du laveur),
// et tout au choix du laveur : l'acompte, son montant (fixe ou %), le délai pour le payer
// avant annulation, et le remboursement, annoncé au client avant qu'il réserve.
// Rangé dans Prestations et prix, à côté des promotions. Règles : lib/acompte.ts.

type Brouillon = {
  actif: boolean
  type: TypeAcompte
  valeur: string
  liens: LiensPaiement
  delai_heures: number | null
  remboursable: boolean
  remboursement_heures: number | null
}

const DEFAUT: Brouillon = { actif: false, type: 'pourcentage', valeur: '30', liens: {}, delai_heures: 24, remboursable: true, remboursement_heures: 48 }

function libelleHeures(h: number) {
  return h > 48 && h % 24 === 0 ? `${h / 24} jours` : `${h} h`
}

export default function AcompteV2({ slug, liste }: { slug: string; liste: ReglagesListeProps }) {
  const grandEcran = useGrandEcran()
  const [b, setB] = useState<Brouillon | null>(null)
  const [enAttente, setEnAttente] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    let annule = false
    fetch('/api/washer/acompte')
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (annule) return
        if (!ok) { setErreur(j?.error ?? 'Impossible de charger vos réglages.'); setB(DEFAUT); return }
        setEnAttente(j.enAttente === true)
        // Réglages enregistrés avant le passage à un lien par application : un seul `lien`,
        // repris dans « Autre » (même règle que lib/acompte.ts).
        const r = j.acompte as (ReglagesAcompte & { lien?: string }) | null
        setB(r ? { ...DEFAUT, ...r, liens: r.liens ?? (r.lien ? { autre: r.lien } : {}), valeur: String(r.valeur).replace('.', ',') } : DEFAUT)
      })
      .catch(() => { if (!annule) { setErreur('Impossible de charger vos réglages. Vérifiez votre connexion.'); setB(DEFAUT) } })
    return () => { annule = true }
  }, [])

  const maj = (champs: Partial<Brouillon>) => { setFait(false); setB(x => (x ? { ...x, ...champs } : x)) }

  async function enregistrer() {
    if (!b || enregistrement) return
    setErreur(null)
    const valeur = Number(b.valeur.replace(',', '.'))
    if (b.actif && !(valeur > 0)) { setErreur('Indiquez le montant de l’acompte.'); return }
    if (b.actif && !APPLIS_PAIEMENT.some(a => (b.liens[a.cle] ?? '').trim())) { setErreur('Ajoutez au moins un lien de paiement.'); return }
    setEnregistrement(true)
    try {
      const res = await fetch('/api/washer/acompte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...b, valeur: valeur > 0 ? valeur : 1,
          liens: Object.fromEntries(APPLIS_PAIEMENT.map(a => [a.cle, (b.liens[a.cle] ?? '').trim()]).filter(([, v]) => v)),
          remboursement_heures: b.remboursable ? b.remboursement_heures : null,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErreur(json?.error ?? 'Enregistrement impossible. Réessayez.'); return }
      setFait(true)
    } catch {
      setErreur('Enregistrement impossible. Vérifiez votre connexion.')
    } finally {
      setEnregistrement(false)
    }
  }

  const valeurNum = b ? Number(b.valeur.replace(',', '.')) || 0 : 0
  const exempleTotal = 100

  const contenu = (
    <div className={grandEcran
      ? 'text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'
      : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      <div className="flex items-center gap-1 pb-3">
        <Link href="/dashboard/parametres/prestations" aria-label="Retour à Prestations et prix" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]">
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Acompte</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Payé par vos propres liens de paiement</p>
        </div>
      </div>

      {enAttente && <Constat>L’acompte arrive très bientôt sur votre compte. Réessayez dans quelques minutes.</Constat>}

      {b && !enAttente && (
        <div className="flex flex-col gap-[22px]">
          <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] ${corpsFort}`}>Demander un acompte</p>
                <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>À chaque réservation faite par un client sur votre page</p>
              </div>
              <Interrupteur actif={b.actif} enCours={false} libelle="Demander un acompte" onClick={() => maj({ actif: !b.actif })} />
            </div>
          </section>

          {b.actif && (
            <>
              <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                <p className={ETIQUETTE}>Montant</p>
                <div className="flex gap-2.5">
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => maj({ type: 'pourcentage' })} className={puce(b.type === 'pourcentage')}>En %</button>
                    <button type="button" onClick={() => maj({ type: 'montant' })} className={puce(b.type === 'montant')}>En €</button>
                  </div>
                  <input aria-label={b.type === 'pourcentage' ? 'Acompte en pourcentage du total' : 'Acompte en euros'} className={CHAMP} inputMode="decimal" value={b.valeur} onChange={e => maj({ valeur: e.target.value.replace(/[^\d.,]/g, '') })} />
                </div>

                {b.type === 'pourcentage' ? (
                  <p className={`mt-2.5 flex items-start gap-2 text-[12.5px] leading-snug ${corps}`}>
                    <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-ambre)' }} aria-hidden />
                    <span>
                      En pourcentage, le montant change à chaque réservation : <strong className={corpsFort}>seul PayPal</strong> affichera
                      automatiquement le bon prix. Avec Stripe, SumUp ou Lydia, le client devra taper le montant ; pour un prix
                      toujours juste, choisissez un acompte en € et créez des liens de ce montant.
                    </span>
                  </p>
                ) : (
                  <p className={`mt-2.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                    Créez dans chaque application un lien du même montant ({b.valeur || '…'} €).
                  </p>
                )}
              </section>

              <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                <p className={`text-[15px] ${corpsFort}`}>Vos liens de paiement</p>
                <p className={`mt-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                  Remplissez ceux que vous utilisez : le client verra un bouton par lien. L’argent arrive directement chez vous.
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  {APPLIS_PAIEMENT.map(a => (
                    <div key={a.cle}>
                      <label htmlFor={`acompte-lien-${a.cle}`} className={ETIQUETTE}>
                        {a.libelle}{a.montantAuto ? ' · montant rempli automatiquement' : ''}
                      </label>
                      <input id={`acompte-lien-${a.cle}`} className={CHAMP} inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                        placeholder={a.exemple} value={b.liens[a.cle] ?? ''} onChange={e => maj({ liens: { ...b.liens, [a.cle]: e.target.value } })} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                <p className={ETIQUETTE}>Délai pour payer</p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {DELAIS_PAIEMENT.map(h => (
                    <button key={h} type="button" onClick={() => maj({ delai_heures: h })} className={puce(b.delai_heures === h)}>{libelleHeures(h)}</button>
                  ))}
                  <button type="button" onClick={() => maj({ delai_heures: null })} className={puce(b.delai_heures === null)}>Pas de limite</button>
                </div>
                <p className={`mt-1.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                  {b.delai_heures
                    ? `Sans paiement confirmé par vous dans les ${libelleHeures(b.delai_heures)}, une réservation encore en attente est annulée et le créneau libéré.`
                    : 'La réservation n’est jamais annulée automatiquement.'}
                </p>

                <p className={`${ETIQUETTE} mt-5`}>Si le client annule</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => maj({ remboursable: true, remboursement_heures: b.remboursement_heures ?? 48 })} className={puce(b.remboursable)}>Remboursé</button>
                  <button type="button" onClick={() => maj({ remboursable: false })} className={puce(!b.remboursable)}>Non remboursé</button>
                </div>
                {b.remboursable && (
                  <>
                    <p className={`${ETIQUETTE} mt-3`}>S’il annule au moins</p>
                    <div className="flex gap-2">
                      {DELAIS_REMBOURSEMENT.map(h => (
                        <button key={h} type="button" onClick={() => maj({ remboursement_heures: h })} className={puce(b.remboursement_heures === h)}>{libelleHeures(h)} avant</button>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section>
                <p className={`${ETIQUETTE} px-0.5`}>Ce que voit le client avant de réserver (pour un total de {exempleTotal} €)</p>
                <EncartAcompte
                  montant={montantAcompte({ type: b.type, valeur: valeurNum }, exempleTotal)}
                  conditions={conditionsAcompte(b)}
                />
              </section>
            </>
          )}

          {erreur && <Constat>{erreur}</Constat>}

          <div className="flex flex-col gap-2">
            <button type="button" onClick={enregistrer} disabled={enregistrement} className={`${BOUTON} w-full`} style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)', ...PRESSION }}>
              {enregistrement ? 'Enregistrement…' : fait ? 'Enregistré' : 'Enregistrer'}
            </button>
            <a href={`/book/${slug}`} target="_blank" rel="noopener" className={`mt-1 self-center text-[13.5px] ${corpsFort} underline decoration-[color:var(--v2-filet-fort)] underline-offset-4`}>
              Voir ma page de réservation
            </a>
          </div>
        </div>
      )}
    </div>
  )

  if (!grandEcran) return contenu
  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="prestations" />
      </div>
      <div className="min-w-0 max-w-[620px] flex-1">{contenu}</div>
    </div>
  )
}

function Constat({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className={`mb-3 flex items-start gap-2 text-[13.5px] leading-snug ${corps}`}>
      <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-rouge)' }} aria-hidden />
      {children}
    </p>
  )
}
