'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce, titre } from '@/components/dashboard/FeuilleV2'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { TAMPONS_PROPOSES, phraseCarte, type ReglagesFidelite, type TypeRecompense } from '@/lib/fidelite'

// « Carte de fidélité » — décisions d'Alexandre, 2026-10-17 : des tampons (une prestation
// terminée = un tampon), une récompense au choix du laveur (offerte, % ou €) appliquée
// automatiquement à la réservation suivante, une page carte pour le client et un rappel sur
// la page de réservation. Rangée dans Prestations et prix. Règles : lib/fidelite.ts.

type Brouillon = { actif: boolean; tampons: number; recompense: TypeRecompense; valeur: string }
const DEFAUT: Brouillon = { actif: false, tampons: 10, recompense: 'offerte', valeur: '20' }

export default function FideliteV2({ slug, liste }: { slug: string; liste: ReglagesListeProps }) {
  const grandEcran = useGrandEcran()
  const [b, setB] = useState<Brouillon | null>(null)
  const [enAttente, setEnAttente] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    let annule = false
    fetch('/api/washer/fidelite')
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (annule) return
        if (!ok) { setErreur(j?.error ?? 'Impossible de charger vos réglages.'); setB(DEFAUT); return }
        setEnAttente(j.enAttente === true)
        const r = j.fidelite as ReglagesFidelite | null
        setB(r ? { ...r, valeur: r.recompense === 'offerte' ? DEFAUT.valeur : String(r.valeur).replace('.', ',') } : DEFAUT)
      })
      .catch(() => { if (!annule) { setErreur('Impossible de charger vos réglages. Vérifiez votre connexion.'); setB(DEFAUT) } })
    return () => { annule = true }
  }, [])

  const maj = (champs: Partial<Brouillon>) => { setFait(false); setB(x => (x ? { ...x, ...champs } : x)) }
  const valeurNum = b ? Number(b.valeur.replace(',', '.')) || 0 : 0

  async function enregistrer() {
    if (!b || enregistrement) return
    setErreur(null)
    if (b.recompense !== 'offerte' && !(valeurNum > 0)) { setErreur('Indiquez le montant de la remise.'); return }
    setEnregistrement(true)
    try {
      const res = await fetch('/api/washer/fidelite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: b.actif, tampons: b.tampons, recompense: b.recompense, valeur: b.recompense === 'offerte' ? 0 : valeurNum }),
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

  const contenu = (
    <div className={grandEcran
      ? 'text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'
      : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      <div className="flex items-center gap-1 pb-3">
        <Link href="/dashboard/parametres/prestations" aria-label="Retour à Prestations et prix" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]">
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Carte de fidélité</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Faites revenir vos clients</p>
        </div>
      </div>

      {enAttente && <Constat>La carte de fidélité arrive très bientôt sur votre compte. Réessayez dans quelques minutes.</Constat>}

      {b && !enAttente && (
        <div className="flex flex-col gap-[22px]">
          <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className={`text-[15px] ${corpsFort}`}>Proposer une carte de fidélité</p>
                <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Un tampon à chaque prestation terminée</p>
              </div>
              <Interrupteur actif={b.actif} enCours={false} libelle="Proposer une carte de fidélité" onClick={() => maj({ actif: !b.actif })} />
            </div>
          </section>

          {b.actif && (
            <>
              <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                <p className={ETIQUETTE}>Nombre de tampons pour une récompense</p>
                <div className="flex flex-wrap gap-2">
                  {TAMPONS_PROPOSES.map(n => <button key={n} type="button" onClick={() => maj({ tampons: n })} className={puce(b.tampons === n)}>{n}</button>)}
                  <input aria-label="Autre nombre de tampons" inputMode="numeric" className={`${CHAMP} !w-24`}
                    value={TAMPONS_PROPOSES.includes(b.tampons as (typeof TAMPONS_PROPOSES)[number]) ? '' : String(b.tampons)} placeholder="Autre"
                    onChange={e => { const n = Number(e.target.value.replace(/\D/g, '')); if (n) maj({ tampons: Math.min(30, Math.max(2, n)) }) }} />
                </div>

                <p className={`${ETIQUETTE} mt-5`}>Récompense</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => maj({ recompense: 'offerte' })} className={puce(b.recompense === 'offerte')}>Prestation offerte</button>
                  <button type="button" onClick={() => maj({ recompense: 'pourcentage' })} className={puce(b.recompense === 'pourcentage')}>Remise en %</button>
                  <button type="button" onClick={() => maj({ recompense: 'montant' })} className={puce(b.recompense === 'montant')}>Remise en €</button>
                </div>
                {b.recompense !== 'offerte' && (
                  <input aria-label={b.recompense === 'pourcentage' ? 'Remise en pourcentage' : 'Remise en euros'} className={`${CHAMP} mt-2.5`} inputMode="decimal"
                    value={b.valeur} onChange={e => maj({ valeur: e.target.value.replace(/[^\d.,]/g, '') })} />
                )}
                <p className={`mt-2.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                  Appliquée automatiquement à la réservation suivante, sur la prestation et ses options (pas sur le déplacement). Vous pouvez ajouter ou retirer un tampon depuis la fiche d’un client.
                </p>
              </section>

              <section>
                <p className={`${ETIQUETTE} px-0.5`}>Ce que voit le client (exemple : 3 prestations faites)</p>
                <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                  <div className="grid grid-cols-5 gap-2" aria-hidden>
                    {Array.from({ length: b.tampons }, (_, i) => (
                      <span key={i} className={`flex aspect-square items-center justify-center rounded-full border-2 text-[13px] ${corpsFort} ${i < 3 ? 'border-[color:var(--v2-color-vert)] bg-[color:var(--v2-color-vert)] text-white' : 'border-dashed border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]'}`}>
                        {i < 3 ? '✓' : i + 1}
                      </span>
                    ))}
                  </div>
                  <p className={`mt-3 text-[14px] ${corps}`}>
                    {phraseCarte({ total: 3, progression: 3, requis: b.tampons, disponibles: 0 }, { recompense: b.recompense, valeur: valeurNum })}
                  </p>
                </div>
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
