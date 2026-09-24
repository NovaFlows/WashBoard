'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'
import GraphiqueBarres, { type PointBarre } from '@/components/dashboard/GraphiqueBarres'
import { CATEGORIES } from '@/components/dashboard/ComptaDashboard'
import { deplacer, formaterJour, libelleComparaison, plageDe, type PeriodeChiffres, type PeriodType } from '@/lib/chiffresPeriode'
import { finitAvant, premierJourDeDonnee, serieArgent, totauxArgent, type ReservationArgent } from '@/lib/chiffresArgent'
import { ecartRelatif } from '@/lib/crmStats'

// Onglet « Argent » de Chiffres (refonte 2026, passe 5, repris au 2026-09-24
// pour que le graphique suive la période) — fusion visuelle de la Comptabilité
// existante (`/dashboard/compta`, `ComptaDashboard.tsx`) dans le nouvel écran.
//
// La PÉRIODE (type + jour de référence, flèches précédent/suivant) vit dans
// ChiffresV2 et se partage avec les deux autres onglets ; elle est choisie par
// SelecteurPeriodeV2. Ici on ne fait que la lire.
//
// D'où viennent les chiffres — un seul calcul pour tout l'onglet :
// - l'ENCAISSÉ (héros, ligne « Encaissé » et chaque barre) est calculé dans
//   `chiffresArgent.ts` à partir des réservations que la page a déjà chargées
//   (`bookings`, lues page par page : jamais tronquées), avec la définition de
//   la Comptabilité (terminé seulement, net de remise — `revenuNet`) et les
//   jours de Paris. La somme des barres est donc le chiffre « Encaissé », par
//   construction. `/api/compta/revenue` n'est plus appelée d'ici : elle borne
//   la période en UTC (voir l'en-tête de `chiffresArgent.ts`) ;
// - les DÉPENSES viennent de `/api/expenses?start&end`, la même route que la
//   Comptabilité, pour la période ET la précédente (l'écart). Les frais ont
//   une date, pas d'heure : en vue « Jour », les barres montrent l'encaissé
//   par heure et le résultat du jour reste dans le héros.
//
// Déviation assumée par rapport à la maquette (`project/Chiffres.dc.html`) :
// les pilules de période y sont « Mois · Semaine · Année · Tout ». Le
// sélecteur reste « Jour · Semaine · Mois · Année », celui déjà utilisé par
// ComptaDashboard : une période « Tout » sur l'argent demanderait une
// nouvelle requête d'agrégat (aucune route existante ne somme tout
// l'historique).
//
// Le formulaire d'ajout de frais et la gestion des frais récurrents restent
// sur `/dashboard/compta` (lien « + Ajouter un frais » plus bas) : les
// reconstruire ici aurait dupliqué tout `ComptaDashboard.tsx` pour un même
// résultat. Le menu latéral (Sidebar) garde cet écran atteignable.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

type Expense = { id: string; date: string; category: string; label: string; amount: number }

const nombre = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
const euros = (v: number) => `${nombre.format(Math.round(v))} €`

function libelleHero(type: PeriodType): string {
  switch (type) {
    case 'jour': return 'Résultat du jour'
    case 'semaine': return 'Résultat de la semaine'
    case 'annee': return "Résultat de l'année"
    default: return 'Résultat du mois'
  }
}

function titreGraphique(type: PeriodType): string {
  switch (type) {
    case 'jour': return "Encaissé par heure — les frais n'ont pas d'heure"
    case 'annee': return 'Résultat par mois'
    default: return 'Résultat par jour'
  }
}

type Reponse = { cle: string; frais: Expense[]; fraisPrecedents: Expense[] | null; erreur: boolean }

async function lireFrais(debut: string, fin: string): Promise<Expense[] | null> {
  const res = await fetch(`/api/expenses?start=${debut}&end=${fin}`)
  if (!res.ok) return null
  const json = await res.json()
  return (json.expenses ?? []) as Expense[]
}

export default function ChiffresArgent({ hasCompta, comptaPlanLabel, facturesCount, bookings, periode, maintenant, reservationsIncompletes }: {
  hasCompta: boolean
  comptaPlanLabel: string
  facturesCount: number
  bookings: ReservationArgent[]
  periode: PeriodeChiffres
  maintenant: number
  reservationsIncompletes?: boolean
}) {
  const plage = plageDe(periode)
  const precedente: PeriodeChiffres = useMemo(
    // On recule depuis `ref`, qui n'est jamais après aujourd'hui : le plafond
    // de `deplacer` (3e argument) ne joue donc jamais ici.
    () => deplacer({ type: periode.type, ref: periode.ref }, -1, periode.ref),
    [periode.type, periode.ref],
  )
  const plagePrec = plageDe(precedente)
  const cle = `${plage.debut}|${plage.fin}`

  const [reponse, setReponse] = useState<Reponse | null>(null)
  const chargement = reponse?.cle !== cle

  // Les dépenses de la période et de la précédente. `annule` écarte la réponse
  // d'une période qu'on a déjà quittée (flèche tapée deux fois vite) : sans
  // lui, la plus lente écraserait la plus récente.
  useEffect(() => {
    if (!hasCompta) return
    let annule = false
    ;(async () => {
      try {
        const [courant, precedent] = await Promise.all([
          lireFrais(plage.debut, plage.fin),
          lireFrais(plagePrec.debut, plagePrec.fin).catch(() => null),
        ])
        if (annule) return
        setReponse({ cle, frais: courant ?? [], fraisPrecedents: precedent, erreur: courant === null })
      } catch {
        if (!annule) setReponse({ cle, frais: [], fraisPrecedents: null, erreur: true })
      }
    })()
    return () => { annule = true }
  }, [hasCompta, cle, plage.debut, plage.fin, plagePrec.debut, plagePrec.fin])

  const premierJour = useMemo(() => premierJourDeDonnee(bookings), [bookings])

  const serie = useMemo(
    () => (reponse && reponse.cle === cle && !reponse.erreur ? serieArgent(periode, bookings, reponse.frais, maintenant) : null),
    [reponse, cle, periode, bookings, maintenant],
  )

  const totauxPrecedents = useMemo(
    () => (reponse?.fraisPrecedents ? totauxArgent(precedente, bookings, reponse.fraisPrecedents) : null),
    [reponse, precedente, bookings],
  )

  const points: PointBarre[] = useMemo(() => (serie?.points ?? []).map(pt => ({
    cle: pt.cle,
    label: pt.label,
    afficherLabel: pt.afficherLabel,
    libelleLong: pt.libelleLong,
    valeur: serie!.fraisParCreneau ? pt.resultat : pt.encaisse,
    detail: serie!.fraisParCreneau ? `Encaissé ${euros(pt.encaisse)} · Dépensé ${euros(pt.depense)}` : undefined,
    futur: pt.futur,
    courant: pt.courant,
  })), [serie])

  if (!hasCompta) {
    return (
      <UpgradePrompt
        title="Gérez votre comptabilité"
        description="Suivez votre chiffre d'affaires, vos dépenses et votre résultat chaque mois. Disponible à partir du plan Pro."
        planLabel={comptaPlanLabel}
      />
    )
  }

  const erreur = reponse?.cle === cle && reponse.erreur
  const resultat = serie?.resultat ?? 0
  const ecart = serie && totauxPrecedents ? ecartRelatif(resultat, totauxPrecedents.resultat) : null
  const recentes = [...(reponse?.cle === cle ? reponse.frais : [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const meilleur = points.filter(p => !p.futur).reduce<PointBarre | null>((m, p) => (!m || p.valeur > m.valeur ? p : m), null)
  const resume = serie && !serie.vide
    ? `${titreGraphique(periode.type)}, ${plage.label}. ${serie.fraisParCreneau ? 'Résultat' : 'Encaissé'} total ${euros(serie.fraisParCreneau ? serie.resultat : serie.encaisse)}.`
      + (meilleur ? ` Meilleur créneau : ${meilleur.libelleLong}, ${euros(meilleur.valeur)}.` : '')
      + ' Flèches gauche et droite pour parcourir les barres.'
    : ''

  return (
    <div className="space-y-5">
      {reservationsIncompletes && (
        <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-ambre)]`} role="status">
          Une partie de vos rendez-vous n’a pas pu être chargée : ces chiffres peuvent être incomplets.
        </p>
      )}

      {erreur ? (
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-rouge)]`}>
          Impossible de charger vos chiffres pour le moment. Rechargez la page dans un instant.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-[3px]">
            <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{libelleHero(periode.type)}</span>
            <span className={`text-[44px] sm:text-[52px] leading-none ${hero}`}>
              {serie ? euros(resultat) : '—'}
            </span>
            {serie && ecart !== null && (
              <span className={`text-[13.5px] ${corps}`} style={{ color: ecart >= 0 ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)' }}>
                {ecart >= 0 ? '+' : ''}{ecart} % {libelleComparaison(periode.type)}
              </span>
            )}
          </div>

          <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
            <div className="flex justify-between px-4 py-3.5">
              <span className="flex flex-col gap-0.5">
                <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Encaissé</span>
                <span className={`text-[19px] ${corpsFort} tabular-nums`}>{serie ? euros(serie.encaisse) : '—'}</span>
              </span>
              <span className="flex flex-col gap-0.5 items-end">
                <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Dépensé</span>
                <span className={`text-[19px] ${corpsFort} tabular-nums`}>{serie ? euros(serie.depense) : '—'}</span>
              </span>
            </div>
            <div className="h-px bg-[color:var(--v2-filet)]" />
            <div className="px-4 py-3.5">
              {!serie ? (
                <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] text-center py-12`}>Chargement…</p>
              ) : serie.vide || points.every(p => p.valeur === 0) ? (
                <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] text-center py-12 leading-relaxed`}>
                  {serie.vide && finitAvant(periode, premierJour)
                    ? `Pas de données avant le ${formaterJour(premierJour!)}, date de votre premier rendez-vous.`
                    : serie.vide
                      ? 'Aucun rendez-vous terminé ni frais sur cette période.'
                      : 'Aucun encaissement à tracer sur cette période.'}
                </p>
              ) : (
                <GraphiqueBarres
                  key={cle}
                  points={points}
                  formaterValeur={euros}
                  resume={resume}
                  titreParDefaut={`${titreGraphique(periode.type)} · touchez une barre pour lire sa valeur`}
                />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between px-0.5 pb-2">
              <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Dépenses</span>
              <Link href="/dashboard/compta" className={`text-[12.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
                + Ajouter un frais
              </Link>
            </div>
            <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
              {chargement ? (
                <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] text-center py-6`}>Chargement…</p>
              ) : recentes.length === 0 ? (
                <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] text-center py-6`}>Aucun frais sur cette période</p>
              ) : (
                <ul className="px-4 divide-y divide-[color:var(--v2-filet)]">
                  {recentes.map(e => (
                    <li key={e.id} className="flex items-center gap-2.5 py-2.5">
                      <span className="flex-1 min-w-0 flex flex-col gap-px">
                        <span className={`text-[14.5px] ${corpsFort} truncate`}>{e.label}</span>
                        <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
                          {CATEGORIES.find(c => c.value === e.category)?.label ?? e.category} · {new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </span>
                      <span className={`text-[14.5px] ${corpsFort} tabular-nums shrink-0`}>{euros(Number(e.amount))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <Link href="/dashboard/factures" className="flex items-center justify-between px-1 h-11">
            <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Factures · {nombre.format(facturesCount)} émise{facturesCount > 1 ? 's' : ''}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-[color:var(--v2-color-gris)]">
              <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
            </svg>
          </Link>
        </>
      )}
    </div>
  )
}
