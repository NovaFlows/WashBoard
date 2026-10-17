'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce, titre } from '@/components/dashboard/FeuilleV2'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import { lireQrCode } from '@/lib/lireQrCode'
import { QrDepuisLien } from '@/components/booking/EncartAcompte'
import { isValidPhone } from '@/lib/phone'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import EncartAcompte from '@/components/booking/EncartAcompte'
import {
  APPLIS_PAIEMENT, DELAIS_PAIEMENT, estLienWero, formaterIban, ibanValide, normaliserIban, DELAIS_REMBOURSEMENT, conditionsAcompte, montantAcompte, moyensPaiement, type LiensPaiement, type ReglagesAcompte, type TypeAcompte,
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
  virementActif: boolean
  titulaire: string
  iban: string
  weroActif: boolean
  weroTel: string
  weroLien: string | null
}

const DEFAUT: Brouillon = { actif: false, type: 'pourcentage', valeur: '30', liens: {}, delai_heures: 24, remboursable: true, remboursement_heures: 48, virementActif: false, titulaire: '', iban: '', weroActif: false, weroTel: '', weroLien: null }

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
        setB(r ? {
          ...DEFAUT, ...r,
          liens: r.liens ?? (r.lien ? { autre: r.lien } : {}),
          valeur: String(r.valeur).replace('.', ','),
          virementActif: !!r.virement, titulaire: r.virement?.titulaire ?? '', iban: r.virement ? formaterIban(r.virement.iban) : '',
          weroActif: !!r.wero, weroTel: r.wero?.telephone ?? '', weroLien: r.wero?.lien ?? null,
        } : DEFAUT)
      })
      .catch(() => { if (!annule) { setErreur('Impossible de charger vos réglages. Vérifiez votre connexion.'); setB(DEFAUT) } })
    return () => { annule = true }
  }, [])

  const maj = (champs: Partial<Brouillon>) => { setFait(false); setB(x => (x ? { ...x, ...champs } : x)) }

  // La capture du QR code Wero n'est PAS envoyée : elle est lue ici, dans le navigateur, et
  // seul le lien qu'elle contient (`https://share.weropay.eu/…`) est gardé. Le client voit
  // ensuite un QR code net, redessiné à partir de ce lien, et un bouton « Payer avec Wero ».
  const [lectureQr, setLectureQr] = useState(false)
  async function lireCapture(fichier: File) {
    setErreur(null)
    setLectureQr(true)
    try {
      const lien = await lireQrCode(fichier)
      if (!lien) { setErreur('Aucun QR code trouvé sur cette image. Faites une capture où le QR code Wero est bien visible.'); return }
      if (!estLienWero(lien)) { setErreur('Ce QR code n’est pas un QR code Wero. Prenez celui de Wero › Recevoir, dans l’application de votre banque.'); return }
      maj({ weroLien: lien })
    } catch {
      setErreur('L’image n’a pas pu être lue. Essayez avec une autre capture.')
    } finally {
      setLectureQr(false)
    }
  }

  async function enregistrer() {
    if (!b || enregistrement) return
    setErreur(null)
    const valeur = Number(b.valeur.replace(',', '.'))
    if (b.actif && !(valeur > 0)) { setErreur('Indiquez le montant de l’acompte.'); return }
    if (b.actif && !b.virementActif && !b.weroActif && !APPLIS_PAIEMENT.some(a => (b.liens[a.cle] ?? '').trim())) { setErreur('Ajoutez au moins un moyen de paiement : un lien, Wero ou le virement.'); return }
    if (b.weroActif && !isValidPhone(b.weroTel)) { setErreur('Wero : indiquez le numéro de téléphone de votre compte Wero.'); return }
    if (b.virementActif && !b.titulaire.trim()) { setErreur('Virement : indiquez le nom du titulaire du compte.'); return }
    if (b.virementActif && !ibanValide(b.iban)) { setErreur('Virement : cet IBAN n’est pas valide. Vérifiez-le sur votre RIB.'); return }
    setEnregistrement(true)
    try {
      const res = await fetch('/api/washer/acompte', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...b, valeur: valeur > 0 ? valeur : 1,
          liens: Object.fromEntries(APPLIS_PAIEMENT.map(a => [a.cle, (b.liens[a.cle] ?? '').trim()]).filter(([, v]) => v)),
          virement: b.virementActif ? { titulaire: b.titulaire.trim(), iban: normaliserIban(b.iban) } : null,
          wero: b.weroActif ? { telephone: b.weroTel.trim(), lien: b.weroLien } : null,
          virementActif: undefined, titulaire: undefined, iban: undefined, weroActif: undefined, weroTel: undefined, weroLien: undefined,
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
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] ${corpsFort}`}>Wero</p>
                    <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Le client paie depuis l’application de sa banque, avec votre numéro.</p>
                  </div>
                  <Interrupteur actif={b.weroActif} enCours={false} libelle="Proposer Wero" onClick={() => maj({ weroActif: !b.weroActif })} />
                </div>
                {b.weroActif && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      <label htmlFor="acompte-wero-tel" className={ETIQUETTE}>Numéro de votre compte Wero</label>
                      <input id="acompte-wero-tel" type="tel" inputMode="tel" className={CHAMP} value={b.weroTel} onChange={e => maj({ weroTel: e.target.value })} placeholder="06 12 34 56 78" />
                    </div>
                    <div>
                      <p className={ETIQUETTE}>Votre QR code Wero (facultatif)</p>
                      <p className={`mb-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                        Dans l’application de votre banque : Wero › Recevoir › QR code, <strong className={corpsFort}>sans montant</strong>. Faites une capture d’écran et ajoutez-la ici : WashBoard y lit votre lien Wero.
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        {b.weroLien && <QrDepuisLien lien={b.weroLien} taille={80} alt="Votre QR code Wero" />}
                        <label className={`${BOUTON} cursor-pointer border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>
                          {lectureQr ? 'Lecture…' : b.weroLien ? 'Changer la capture' : 'Ajouter la capture'}
                          <input type="file" accept="image/*" className="sr-only" disabled={lectureQr} onChange={e => { const f = e.target.files?.[0]; if (f) void lireCapture(f); e.target.value = '' }} />
                        </label>
                        {b.weroLien && <button type="button" onClick={() => maj({ weroLien: null })} className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] underline underline-offset-2`}>Retirer</button>}
                      </div>
                      {b.weroLien && <p className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-vert)' }}>QR code Wero reconnu : vos clients auront un bouton « Payer avec Wero ».</p>}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] ${corpsFort}`}>Virement bancaire</p>
                    <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Sans frais. Votre IBAN n’est montré qu’après la réservation.</p>
                  </div>
                  <Interrupteur actif={b.virementActif} enCours={false} libelle="Proposer le virement" onClick={() => maj({ virementActif: !b.virementActif })} />
                </div>
                {b.virementActif && (
                  <div className="mt-3 flex flex-col gap-3">
                    <div>
                      <label htmlFor="acompte-titulaire" className={ETIQUETTE}>Titulaire du compte</label>
                      <input id="acompte-titulaire" className={CHAMP} maxLength={70} value={b.titulaire} onChange={e => maj({ titulaire: e.target.value })} placeholder="Nom inscrit sur votre RIB" />
                    </div>
                    <div>
                      <label htmlFor="acompte-iban" className={ETIQUETTE}>IBAN</label>
                      <input id="acompte-iban" className={`${CHAMP} font-mono`} autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={42}
                        value={b.iban} onChange={e => maj({ iban: e.target.value.toUpperCase() })} placeholder="FR76 …" />
                      {b.iban.trim() && !ibanValide(b.iban) && (
                        <p className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>Cet IBAN n’est pas valide : vérifiez-le sur votre RIB.</p>
                      )}
                    </div>
                    <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                      Le client reçoit le montant et une référence à mettre dans le libellé (par exemple WB-54CF8F67), pour que vous retrouviez sa réservation sur votre compte.
                    </p>
                  </div>
                )}
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
                  {b.virementActif && b.delai_heures !== null && b.delai_heures < 24 && (
                    <span className="mt-1.5 flex items-start gap-2" style={{ color: 'var(--v2-color-encre)' }}>
                      <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-ambre)' }} aria-hidden />
                      Un virement classique peut mettre 1 à 2 jours : avec ce délai, la réservation d’un client qui a payé par virement risque d’être annulée. Choisissez au moins 48 h si vous proposez le virement.
                    </span>
                  )}
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
                  moyens={moyensPaiement({ liens: b.liens, virementPropose: b.virementActif, weroPropose: b.weroActif })}
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
