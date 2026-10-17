'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce, titre } from '@/components/dashboard/FeuilleV2'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { TAMPONS_PROPOSES, phraseCarte, recompenseCourte, type ReglagesFidelite, type TypeRecompense } from '@/lib/fidelite'
import { COULEUR_CARTE_DEFAUT, FINITIONS_CARTE, LIBELLES_FINITION, NUANCES_CARTE, couleurCarte, type EmblemeCarte, type FinitionCarte } from '@/lib/carteFidelite'
import CarteFidelite3D, { type CommandesCarte, type ScenarioCarte } from '@/components/fidelite/CarteFidelite3D'

// « Carte de fidélité » — décisions d'Alexandre, 2026-10-17 : des tampons (une prestation
// terminée = un tampon), une récompense au choix du laveur (offerte, % ou €) appliquée
// automatiquement à la réservation suivante, une page carte pour le client et un rappel sur
// la page de réservation. Rangée dans Prestations et prix. Règles : lib/fidelite.ts.
// Apparence (2026-10-18) : la carte en 3D en aperçu, sa couleur, sa finition, le logo ou
// l'initiale — au choix du laveur (lib/carteFidelite.ts).

type Brouillon = {
  actif: boolean; tampons: number; recompense: TypeRecompense; valeur: string; offre_options: boolean; offre_deplacement: boolean
  tampon_par_vehicule: boolean
  /** `null` : la couleur de marque du laveur (ou le violet par défaut). */
  couleur: string | null; finition: FinitionCarte
  /** `null` : le logo s'il y en a un, sinon l'initiale. */
  embleme: EmblemeCarte | null
}
const DEFAUT: Brouillon = { actif: false, tampons: 10, recompense: 'offerte', valeur: '20', offre_options: true, offre_deplacement: false, tampon_par_vehicule: false, couleur: null, finition: 'holo', embleme: null }

/** L'exemple de départ de l'aperçu : un client qui a fait 3 prestations. Le laveur peut en
 *  ajouter jusqu'à la carte pleine pour voir l'animation de la récompense (2026-10-18). */
const EXEMPLE_TAMPONS = 3

type Props = {
  slug: string
  liste: ReglagesListeProps
  /** Couleur de marque (Apparence de ma page), proposée en premier. */
  marque?: string | null
  /** Logo affichable sur la carte (le laveur en a un ET son offre le permet). */
  logo?: string | null
  /** Le laveur a un logo, mais son offre ne l'affiche pas. */
  logoHorsOffre?: boolean
}

export default function FideliteV2({ slug, liste, marque = null, logo = null, logoHorsOffre = false }: Props) {
  const grandEcran = useGrandEcran()
  const [b, setB] = useState<Brouillon | null>(null)
  const [enAttente, setEnAttente] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enregistrement, setEnregistrement] = useState(false)
  const [fait, setFait] = useState(false)
  // L'aperçu suit les réglages ; « Rejouer » montre l'animation que verra le client.
  const [lecture, setLecture] = useState<{ cle: number; scenario: ScenarioCarte }>({ cle: 0, scenario: 'apercu' })
  const [exemple, setExemple] = useState(EXEMPLE_TAMPONS)
  const carte = useRef<CommandesCarte>(null)

  useEffect(() => {
    let annule = false
    fetch('/api/washer/fidelite')
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (annule) return
        if (!ok) { setErreur(j?.error ?? 'Impossible de charger vos réglages.'); setB(DEFAUT); return }
        setEnAttente(j.enAttente === true)
        const r = j.fidelite as ReglagesFidelite | null
        setB(r ? { ...DEFAUT, ...r, couleur: r.couleur ?? null, finition: r.finition ?? 'holo', embleme: r.embleme ?? null, valeur: r.recompense === 'offerte' ? DEFAUT.valeur : String(r.valeur).replace('.', ',') } : DEFAUT)
      })
      .catch(() => { if (!annule) { setErreur('Impossible de charger vos réglages. Vérifiez votre connexion.'); setB(DEFAUT) } })
    return () => { annule = true }
  }, [])

  const maj = (champs: Partial<Brouillon>) => {
    setFait(false)
    setB(x => (x ? { ...x, ...champs } : x))
    // Après « Rejouer », l'aperçu reprend la main pour suivre ce qui change.
    setLecture(l => (l.scenario === 'apercu' ? l : { cle: l.cle + 1, scenario: 'apercu' }))
  }
  const valeurNum = b ? Number(b.valeur.replace(',', '.')) || 0 : 0
  const marqueValide = marque ? couleurCarte(null, marque) : null
  const couleurEffective = couleurCarte(b?.couleur, marque)
  const emblemeEffectif: EmblemeCarte = logo && (b?.embleme ?? 'logo') === 'logo' ? 'logo' : 'initiale'
  // La couleur de marque d'abord (si elle n'est pas déjà dans le nuancier), puis le nuancier.
  const nuances = [
    ...(marqueValide && marqueValide !== COULEUR_CARTE_DEFAUT && !NUANCES_CARTE.some(n => n.hex === marqueValide) ? [{ nom: 'Ma couleur de marque', hex: marqueValide }] : []),
    ...NUANCES_CARTE,
  ]
  const couleurLibre = !nuances.some(n => n.hex === couleurEffective)
  const requis = b?.tampons ?? DEFAUT.tampons
  const exempleAffiche = Math.min(exemple, requis)
  const ajouterTampon = () => {
    if (exempleAffiche >= requis) return
    setExemple(exempleAffiche + 1)
    // Après « Rejouer », l'aperçu repart de zéro ; sinon le nouveau tampon frappe la carte.
    if (lecture.scenario === 'apercu') carte.current?.tamponner(exempleAffiche, requis)
    else setLecture(l => ({ cle: l.cle + 1, scenario: 'apercu' }))
  }
  const retirerTampon = () => {
    if (exempleAffiche <= 0) return
    setExemple(exempleAffiche - 1)
    if (lecture.scenario !== 'apercu') setLecture(l => ({ cle: l.cle + 1, scenario: 'apercu' }))
  }

  async function enregistrer() {
    if (!b || enregistrement) return
    setErreur(null)
    if (b.recompense !== 'offerte' && !(valeurNum > 0)) { setErreur('Indiquez le montant de la remise.'); return }
    setEnregistrement(true)
    try {
      const res = await fetch('/api/washer/fidelite', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actif: b.actif, tampons: b.tampons, recompense: b.recompense, valeur: b.recompense === 'offerte' ? 0 : valeurNum, offre_options: b.offre_options, offre_deplacement: b.offre_deplacement,
          tampon_par_vehicule: b.tampon_par_vehicule, finition: b.finition, ...(b.couleur ? { couleur: b.couleur } : {}), ...(b.embleme ? { embleme: b.embleme } : {}),
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

                <div className="mt-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] ${corps}`}>Un tampon par véhicule</p>
                    <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>Une réservation pour 3 véhicules donne 3 tampons</p>
                  </div>
                  <Interrupteur actif={b.tampon_par_vehicule} enCours={false} libelle="Un tampon par véhicule" onClick={() => maj({ tampon_par_vehicule: !b.tampon_par_vehicule })} />
                </div>

                <p className={`${ETIQUETTE} mt-5`}>Récompense</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => maj({ recompense: 'offerte' })} className={puce(b.recompense === 'offerte')}>Prestation offerte</button>
                  <button type="button" onClick={() => maj({ recompense: 'pourcentage' })} className={puce(b.recompense === 'pourcentage')}>Remise en %</button>
                  <button type="button" onClick={() => maj({ recompense: 'montant' })} className={puce(b.recompense === 'montant')}>Remise en €</button>
                </div>
                {b.recompense === 'offerte' && (
                  <div className="mt-3 flex flex-col">
                    <div className="flex items-center gap-3">
                      <p className={`min-w-0 flex-1 text-[15px] ${corps}`}>Offrir aussi les options</p>
                      <Interrupteur actif={b.offre_options} enCours={false} libelle="Offrir aussi les options" onClick={() => maj({ offre_options: !b.offre_options })} />
                    </div>
                    <div className="flex items-center gap-3">
                      <p className={`min-w-0 flex-1 text-[15px] ${corps}`}>Offrir aussi les frais de déplacement</p>
                      <Interrupteur actif={b.offre_deplacement} enCours={false} libelle="Offrir aussi les frais de déplacement" onClick={() => maj({ offre_deplacement: !b.offre_deplacement })} />
                    </div>
                  </div>
                )}
                {b.recompense !== 'offerte' && (
                  <input aria-label={b.recompense === 'pourcentage' ? 'Remise en pourcentage' : 'Remise en euros'} className={`${CHAMP} mt-2.5`} inputMode="decimal"
                    value={b.valeur} onChange={e => maj({ valeur: e.target.value.replace(/[^\d.,]/g, '') })} />
                )}
                <p className={`mt-2.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                  Appliquée automatiquement à la réservation suivante{b.recompense === 'offerte' ? '' : ', sur la prestation et ses options (pas sur le déplacement)'}. Vous pouvez ajouter ou retirer un tampon depuis la fiche d’un client.
                </p>
              </section>

              <section className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className={`${ETIQUETTE} !mb-0`}>Ce que voit le client</p>
                  <button type="button" onClick={() => setLecture(l => ({ cle: l.cle + 1, scenario: 'tampon' }))}
                    className={`shrink-0 text-[13px] ${corpsFort} underline decoration-[color:var(--v2-filet-fort)] underline-offset-4`}>
                    Rejouer l’animation
                  </button>
                </div>
                <div className="-mx-4">
                  <CarteFidelite3D
                    key={lecture.cle}
                    ref={carte}
                    scenario={lecture.scenario}
                    couleur={couleurEffective}
                    finition={b.finition}
                    nom={liste.nom}
                    logo={emblemeEffectif === 'logo' ? logo : null}
                    numero="0427"
                    requis={b.tampons}
                    tampons={exempleAffiche}
                    recompense={recompenseCourte({ recompense: b.recompense, valeur: valeurNum })}
                    largeur={340}
                  />
                </div>
                <div className="-mt-4 flex items-center justify-center gap-3">
                  <button type="button" onClick={retirerTampon} disabled={exempleAffiche <= 0} aria-label="Retirer un tampon de l’exemple"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--v2-filet-fort)] text-[22px] leading-none transition-transform active:scale-90 disabled:opacity-35">−</button>
                  <p className={`min-w-[150px] text-center text-[14px] ${corpsFort} tabular-nums`} aria-live="polite">
                    {exempleAffiche} tampon{exempleAffiche > 1 ? 's' : ''} sur {requis}
                  </p>
                  <button type="button" onClick={ajouterTampon} disabled={exempleAffiche >= requis} aria-label="Ajouter un tampon à l’exemple"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[22px] leading-none transition-transform active:scale-90 disabled:opacity-35"
                    style={{ background: 'var(--v2-color-encre)', color: 'var(--v2-color-fond)' }}>+</button>
                </div>
                <p className={`mt-2 text-center text-[14px] ${corps}`}>
                  {phraseCarte(
                    exempleAffiche >= requis
                      ? { total: requis, progression: 0, requis, disponibles: 1 }
                      : { total: exempleAffiche, progression: exempleAffiche, requis, disponibles: 0 },
                    { recompense: b.recompense, valeur: valeurNum, offre_options: b.offre_options, offre_deplacement: b.offre_deplacement },
                  )}
                </p>
                <p className={`mt-1 text-center text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Ajoutez des tampons pour voir l’animation de la récompense. Touchez la carte pour la retourner.</p>

                <p className={`${ETIQUETTE} mt-5`}>Couleur de la carte</p>
                <div className="flex flex-wrap items-center gap-2.5">
                  {nuances.map(n => (
                    <button key={n.hex} type="button" title={n.nom} aria-label={n.nom} aria-pressed={couleurEffective === n.hex}
                      onClick={() => maj({ couleur: n.hex === marqueValide ? null : n.hex })}
                      className="h-9 w-9 rounded-full border-2 transition-transform active:scale-90"
                      style={{ background: n.hex, borderColor: couleurEffective === n.hex ? 'var(--v2-color-encre)' : 'transparent', boxShadow: 'inset 0 0 0 2px var(--v2-color-surface), 0 0 0 1px var(--v2-filet-fort)' }} />
                  ))}
                  <label className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] ${corpsFort}`}
                    style={{ borderColor: couleurLibre ? 'var(--v2-color-encre)' : 'var(--v2-filet-fort)' }}>
                    <input type="color" aria-label="Autre couleur" value={couleurEffective.toLowerCase()} onChange={e => maj({ couleur: e.target.value.toUpperCase() })}
                      className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" />
                    Autre
                  </label>
                </div>

                <p className={`${ETIQUETTE} mt-5`}>Finition</p>
                <div className="flex flex-wrap gap-2">
                  {FINITIONS_CARTE.map(f => <button key={f} type="button" onClick={() => maj({ finition: f })} className={puce(b.finition === f)}>{LIBELLES_FINITION[f]}</button>)}
                </div>

                <p className={`${ETIQUETTE} mt-5`}>Sur la carte</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!logo} onClick={() => maj({ embleme: 'logo' })} className={`${puce(emblemeEffectif === 'logo')} disabled:opacity-40`}>Mon logo</button>
                  <button type="button" onClick={() => maj({ embleme: 'initiale' })} className={puce(emblemeEffectif === 'initiale')}>Mon initiale</button>
                </div>
                {!logo && (
                  <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                    {logoHorsOffre
                      ? 'Votre offre actuelle n’affiche pas votre logo sur vos pages : la carte porte votre initiale.'
                      : <>Ajoutez votre logo dans <Link href="/dashboard/parametres/apparence" className="underline underline-offset-2">Apparence de ma page</Link> pour l’afficher sur la carte.</>}
                  </p>
                )}
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
