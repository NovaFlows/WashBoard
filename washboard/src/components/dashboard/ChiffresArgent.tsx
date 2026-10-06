'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { requiredPlanLabel } from '@/lib/plan'
import { OffreVerrouilleeV2 } from '@/components/dashboard/OffreVerrouilleeV2'
import GraphiqueBarres, { type PointBarre } from '@/components/dashboard/GraphiqueBarres'
import { libelleCategorie } from '@/lib/depenses'
import { deplacer, formaterJour, libelleComparaison, plageDe, type PeriodeChiffres, type PeriodType } from '@/lib/chiffresPeriode'
import {
  encaissementsDesFactures, finitAvant, premierJourDeDonnee, serieArgent, totauxArgent,
  type FactureManuelle, type ReservationArgent,
} from '@/lib/chiffresArgent'
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
//   jours de Paris, PLUS les factures écrites à la main marquées payées
//   (`facturesManuelles`, projetées par `encaissementsDesFactures` : même
//   liste, même calcul). La somme des barres est donc le chiffre « Encaissé »,
//   par construction. `/api/compta/revenue` n'est plus appelée d'ici : elle
//   borne la période en UTC (voir l'en-tête de `chiffresArgent.ts`) ;
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

// Starter : le chiffre d'affaires seul (ce qui est encaissé). La comptabilité — dépenses,
// résultat, factures — est de l'offre Pro : on la voit, floue, avec la porte vers les offres.
function libelleHeroCa(type: PeriodType): string {
  switch (type) {
    case 'jour': return "Chiffre d'affaires du jour"
    case 'semaine': return "Chiffre d'affaires de la semaine"
    case 'annee': return "Chiffre d'affaires de l'année"
    default: return "Chiffre d'affaires du mois"
  }
}

function titreGraphiqueCa(type: PeriodType): string {
  switch (type) {
    case 'jour': return "Encaissé par heure"
    case 'annee': return "Encaissé par mois"
    default: return "Encaissé par jour"
  }
}

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

/** La comptabilité vue depuis Starter : la silhouette des dépenses et des factures, floue et
 *  inerte, sous une pastille qui dit quelle offre l'ouvre. */
function ComptaVerrouillee() {
  const offre = requiredPlanLabel('compta')
  const barre = 'rounded-full bg-[color:var(--v2-filet-fort)]'
  return (
    <div className="relative">
      <div aria-hidden className="select-none blur-[5px]">
        <div className="pb-2 px-0.5">
          <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Dépenses</span>
        </div>
        <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 divide-y divide-[color:var(--v2-filet)]">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-2.5 py-3">
              <span className="flex-1 flex flex-col gap-1.5">
                <span className={`${barre} h-3 w-32`} />
                <span className={`${barre} h-2.5 w-20 opacity-60`} />
              </span>
              <span className={`${barre} h-3 w-12`} />
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2 px-1">
          <span className={`${barre} h-3 w-40`} />
          <span className={`${barre} h-3 w-48`} />
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <Link
          href="/dashboard/abonnement"
          className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-4 py-2.5 text-[13.5px] shadow-lg ${corpsFort}`}
        >
          <Lock size={14} strokeWidth={2.4} aria-hidden />
          Inclus dans l’offre {offre}
        </Link>
        <p className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-encre)]`}>
          Dépenses, résultat et factures — la comptabilité complète.
        </p>
      </div>
    </div>
  )
}

export default function ChiffresArgent({
  hasCa, hasCompta, facturesCount, facturesImpayees, bookings, facturesManuelles, periode, maintenant,
  reservationsIncompletes, grandEcran,
}: {
  hasCa: boolean
  hasCompta: boolean
  facturesCount: number
  /** Factures écrites à la main, pas encore marquées payées — colonne de gauche sur grand
   *  écran uniquement (écran 7 de la maquette). */
  facturesImpayees?: number
  bookings: ReservationArgent[]
  /** Factures écrites à la main et marquées payées (voir `encaissementsDesFactures`). */
  facturesManuelles?: FactureManuelle[]
  periode: PeriodeChiffres
  maintenant: number
  reservationsIncompletes?: boolean
  /** `useGrandEcran()`, lu une seule fois par ChiffresV2 et partagé entre les trois onglets —
   *  voir son en-tête. Bascule entre la pile mobile (inchangée) et les deux colonnes de l'écran
   *  7 de la maquette (260px détail à gauche, graphique + dépenses à droite). */
  grandEcran?: boolean
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

  // Tout ce qui est rentré : les rendez-vous terminés ET les factures écrites à la main que le
  // laveur a marquées payées, projetées en lignes d'encaissement. Une seule liste, donc un seul
  // calcul — le total, les barres et l'écart avec la période précédente restent d'accord entre
  // eux par construction.
  const encaissements = useMemo(
    () => [...bookings, ...encaissementsDesFactures(facturesManuelles ?? [])],
    [bookings, facturesManuelles],
  )

  const serie = useMemo(() => {
    if (!hasCompta) return serieArgent(periode, encaissements, [], maintenant)
    return reponse && reponse.cle === cle && !reponse.erreur ? serieArgent(periode, encaissements, reponse.frais, maintenant) : null
  }, [hasCompta, reponse, cle, periode, encaissements, maintenant])

  const totauxPrecedents = useMemo(() => {
    if (!hasCompta) return totauxArgent(precedente, encaissements, [])
    return reponse?.fraisPrecedents ? totauxArgent(precedente, encaissements, reponse.fraisPrecedents) : null
  }, [hasCompta, reponse, precedente, encaissements])

  // Sans comptabilité, tout se lit en « encaissé » : ni résultat ni dépensé n'existent pour ce laveur.
  const enResultat = hasCompta

  const points: PointBarre[] = useMemo(() => (serie?.points ?? []).map(pt => ({
    cle: pt.cle,
    label: pt.label,
    afficherLabel: pt.afficherLabel,
    libelleLong: pt.libelleLong,
    valeur: enResultat && serie!.fraisParCreneau ? pt.resultat : pt.encaisse,
    detail: enResultat && serie!.fraisParCreneau ? `Encaissé ${euros(pt.encaisse)} · Dépensé ${euros(pt.depense)}` : undefined,
    futur: pt.futur,
    courant: pt.courant,
  })), [serie, enResultat])

  if (!hasCa) {
    return (
      <OffreVerrouilleeV2
        titre="Suivez votre chiffre d’affaires"
        description="Ce que vous encaissez, jour après jour et mois après mois."
        feature="ca_simple"
        rassurance="Vos encaissements sont déjà comptés en coulisse : rien n’est perdu en attendant, seul l’affichage est fermé."
      />
    )
  }

  const erreur = hasCompta && reponse?.cle === cle && reponse.erreur
  const resultat = (enResultat ? serie?.resultat : serie?.encaisse) ?? 0
  const ecart = serie && totauxPrecedents
    ? ecartRelatif(resultat, enResultat ? totauxPrecedents.resultat : totauxPrecedents.encaisse)
    : null
  const recentes = [...(reponse?.cle === cle ? reponse.frais : [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const meilleur = points.filter(p => !p.futur).reduce<PointBarre | null>((m, p) => (!m || p.valeur > m.valeur ? p : m), null)
  const parResultat = enResultat && !!serie?.fraisParCreneau
  const resume = serie && !serie.vide
    ? `${enResultat ? titreGraphique(periode.type) : titreGraphiqueCa(periode.type)}, ${plage.label}. ${parResultat ? 'Résultat' : 'Encaissé'} total ${euros(parResultat ? serie.resultat : serie.encaisse)}.`
      + (meilleur ? ` Meilleur créneau : ${meilleur.libelleLong}, ${euros(meilleur.valeur)}.` : '')
      + ' Flèches gauche et droite pour parcourir les barres.'
    : ''

  // Les blocs ci-dessous sont partagés par les deux dispositions : mobile les empile tous dans
  // une seule colonne (inchangé) ; grand écran les répartit en deux colonnes (écran 7 de la
  // maquette) — c'est le SEUL changement, jamais le calcul qui les nourrit.

  const blocHero = (
    <div className="flex flex-col gap-[3px]">
      <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{enResultat ? libelleHero(periode.type) : libelleHeroCa(periode.type)}</span>
      <span className={`${grandEcran ? 'text-[50px]' : 'text-[44px] sm:text-[52px]'} leading-none ${hero}`}>
        {serie ? euros(resultat) : '—'}
      </span>
      {serie && ecart !== null && (
        <span className={`text-[13.5px] ${corps}`} style={{ color: ecart >= 0 ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)' }}>
          {ecart >= 0 ? '+' : ''}{ecart} % {libelleComparaison(periode.type)}
        </span>
      )}
    </div>
  )

  // Grand écran seulement (écran 7) : les mêmes nombres qu'« Encaissé »/« Dépensé » plus bas,
  // sous les libellés de la maquette, plus « Factures impayées » — compte réel
  // (`estPayee()`/`lib/documents.ts`), jamais affiché avant cette passe.
  const blocDetailBureau = enResultat && (
    <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] divide-y divide-[color:var(--v2-filet)] px-4">
      <div className="flex items-center justify-between py-2.5">
        <span className={`text-[13px] ${corps} flex-1`}>Chiffre d’affaires</span>
        <span className={`text-[14.5px] ${corpsFort} tabular-nums`}>{serie ? euros(serie.encaisse) : '—'}</span>
      </div>
      <div className="flex items-center justify-between py-2.5">
        <span className={`text-[13px] ${corps} flex-1`}>Dépenses</span>
        <span className={`text-[14.5px] ${corpsFort} tabular-nums`}>{serie ? euros(serie.depense) : '—'}</span>
      </div>
      {facturesImpayees !== undefined && (
        <div className="flex items-center justify-between py-2.5">
          <span className={`text-[13px] ${corps} flex-1`}>Factures impayées</span>
          <span
            className={`text-[14.5px] ${corpsFort} tabular-nums`}
            style={facturesImpayees > 0 ? { color: 'var(--v2-color-ambre)' } : undefined}
          >
            {nombre.format(facturesImpayees)}
          </span>
        </div>
      )}
    </div>
  )

  // Les rows « Encaissé / Dépensé » au-dessus du graphique — présentation mobile uniquement,
  // remplacées sur grand écran par `blocDetailBureau` dans la colonne de gauche.
  const blocEncaisseDepenseRows = enResultat && (
    <>
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
    </>
  )

  const blocGrapheContenu = !serie ? (
    <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] text-center py-12`}>Chargement…</p>
  ) : serie.vide || points.every(p => p.valeur === 0) ? (
    <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] text-center py-12 leading-relaxed`}>
      {serie.vide && finitAvant(periode, premierJour)
        ? `Pas de données avant le ${formaterJour(premierJour!)}, date de votre premier rendez-vous.`
        : serie.vide
          ? (enResultat ? 'Aucun rendez-vous terminé ni frais sur cette période.' : 'Aucun rendez-vous terminé sur cette période.')
          : 'Aucun encaissement à tracer sur cette période.'}
    </p>
  ) : (
    <GraphiqueBarres
      key={cle}
      points={points}
      formaterValeur={euros}
      resume={resume}
      titreParDefaut={`${enResultat ? titreGraphique(periode.type) : titreGraphiqueCa(periode.type)} · touchez une barre pour lire sa valeur`}
      hauteur={grandEcran ? 140 : undefined}
    />
  )

  const blocDepenses = !hasCompta ? <ComptaVerrouillee /> : (
    <div>
      <div className="flex items-baseline justify-between px-0.5 pb-2">
        <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Dépenses</span>
        {/* Écran v2 (2026-09-26) : « + Ajouter un frais » tombait sur l'ancienne page de
            comptabilité, en plein milieu de la PWA refaite. */}
        <Link href="/dashboard/chiffres/depenses" className={`text-[12.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
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
                    {libelleCategorie(e.category)} · {new Date(e.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className={`text-[14.5px] ${corpsFort} tabular-nums shrink-0`}>{euros(Number(e.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  // Deux portes différentes, et c'est voulu : les factures de rendez-vous naissent toutes
  // seules et se consultent ; les devis et factures écrits à la main se créent (Alexandre,
  // 2026-09-27).
  const blocFacturesLiens = hasCompta && (
    <>
      {([
        { href: '/dashboard/factures', texte: `Factures · ${nombre.format(facturesCount)} émise${facturesCount > 1 ? 's' : ''}` },
        { href: '/dashboard/chiffres/documents', texte: 'Devis et factures à la main' },
      ] as const).map(l => (
        <Link key={l.href} href={l.href} className="flex items-center justify-between px-1 h-11">
          <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{l.texte}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-[color:var(--v2-color-gris)]">
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
          </svg>
        </Link>
      ))}
    </>
  )

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
      ) : grandEcran ? (
        // Grand écran (écran 7 de la maquette) : colonne étroite à gauche (héros + détail),
        // matière large à droite (graphique, dépenses, liens vers les factures).
        <div className="grid gap-[26px]" style={{ gridTemplateColumns: '260px 1fr' }}>
          <div className="flex flex-col gap-[18px]">
            {blocHero}
            {blocDetailBureau}
          </div>
          <div className="space-y-5">
            <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] px-4 py-3.5">
              {blocGrapheContenu}
            </div>
            {blocDepenses}
            {blocFacturesLiens}
          </div>
        </div>
      ) : (
        <>
          {blocHero}

          <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
            {blocEncaisseDepenseRows}
            <div className="px-4 py-3.5">
              {blocGrapheContenu}
            </div>
          </div>

          {blocDepenses}
          {blocFacturesLiens}
        </>
      )}
    </div>
  )
}
