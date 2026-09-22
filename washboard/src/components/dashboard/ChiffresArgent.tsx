'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'
import { CATEGORIES } from '@/components/dashboard/ComptaDashboard'
import { getPeriodRange, navigatePeriod, type PeriodType } from '@/lib/comptaPeriod'
import { getLast6Months, ecartRelatif } from '@/lib/crmStats'

// Onglet « Argent » de Chiffres (refonte 2026, passe 5) — fusion visuelle de
// la Comptabilité existante (`/dashboard/compta`, `ComptaDashboard.tsx`) dans
// le nouvel écran. La logique n'a pas bougé : mêmes routes API
// (`/api/expenses`, `/api/compta/revenue`, `/api/compta/year-summary`), même
// moteur de période (`comptaPeriod.ts`) — seule la présentation change.
//
// Déviation assumée par rapport à la maquette (`project/Chiffres.dc.html`) :
// les pilules de période y sont « Mois · Semaine · Année · Tout ». Le
// sélecteur ici reste « Jour · Semaine · Mois · Année », celui déjà utilisé
// par ComptaDashboard : une période « Tout » sur l'argent demanderait une
// nouvelle requête d'agrégat (aucune route existante ne somme tout
// l'historique), ce qui sort du périmètre d'une passe de présentation.
// Signalé dans le compte rendu de la passe pour arbitrage si Alexandre y
// tient.
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

const PERIODES: { cle: PeriodType; libelle: string }[] = [
  { cle: 'jour', libelle: 'Jour' },
  { cle: 'semaine', libelle: 'Semaine' },
  { cle: 'mois', libelle: 'Mois' },
  { cle: 'annee', libelle: 'Année' },
]

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

function libelleComparaison(type: PeriodType, precedent: { label: string }): string {
  switch (type) {
    case 'jour': return 'par rapport à la veille'
    case 'semaine': return 'par rapport à la semaine précédente'
    case 'annee': return `par rapport à ${precedent.label}`
    default: return `par rapport à ${precedent.label.split(' ')[0].toLowerCase()}`
  }
}

export default function ChiffresArgent({ hasCompta, comptaPlanLabel, facturesCount }: {
  hasCompta: boolean
  comptaPlanLabel: string
  facturesCount: number
}) {
  const [periodType, setPeriodType] = useState<PeriodType>('mois')
  const [refDate] = useState(() => new Date())

  const [revenue, setRevenue] = useState<number | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [revenuePrecedent, setRevenuePrecedent] = useState<number | null>(null)
  const [expensesPrecedent, setExpensesPrecedent] = useState<number | null>(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(false)

  const [sixMois, setSixMois] = useState<{ label: string; resultat: number }[] | null>(null)

  const chargerPeriode = useCallback(async () => {
    if (!hasCompta) return
    setChargement(true)
    setErreur(false)
    try {
      const courante = getPeriodRange(periodType, refDate)
      const precedenteRef = navigatePeriod(periodType, refDate, -1)
      const precedente = getPeriodRange(periodType, precedenteRef)

      const [exRes, revRes, revPrecRes, exPrecRes] = await Promise.all([
        fetch(`/api/expenses?start=${courante.start}&end=${courante.end}`),
        fetch(`/api/compta/revenue?start=${courante.start}&end=${courante.end}`),
        fetch(`/api/compta/revenue?start=${precedente.start}&end=${precedente.end}`),
        fetch(`/api/expenses?start=${precedente.start}&end=${precedente.end}`),
      ])
      if (!exRes.ok || !revRes.ok) { setErreur(true); return }

      const exJson = await exRes.json()
      const revJson = await revRes.json()
      setExpenses(exJson.expenses ?? [])
      setRevenue(revJson.revenue ?? 0)

      if (revPrecRes.ok && exPrecRes.ok) {
        const revPrecJson = await revPrecRes.json()
        const exPrecJson = await exPrecRes.json()
        setRevenuePrecedent(revPrecJson.revenue ?? 0)
        const totalExPrec = (exPrecJson.expenses ?? []).reduce((s: number, e: Expense) => s + Number(e.amount), 0)
        setExpensesPrecedent(totalExPrec)
      } else {
        setRevenuePrecedent(null)
        setExpensesPrecedent(null)
      }
    } catch {
      setErreur(true)
    } finally {
      setChargement(false)
    }
  }, [hasCompta, periodType, refDate])

  useEffect(() => { chargerPeriode() }, [chargerPeriode])

  // Frise des 6 derniers mois : indépendante de la période choisie plus haut
  // (comme la maquette, qui garde toujours "Avr → Sep" quel que soit l'onglet
  // Mois/Semaine/Année sélectionné). `getLast6Months` peut couvrir deux
  // années civiles (ex. avril à septembre ne déborde pas, mais
  // octobre à mars si) : on ne demande le bilan annuel qu'aux années
  // réellement concernées.
  useEffect(() => {
    if (!hasCompta) return
    let annule = false
    ;(async () => {
      const mois = getLast6Months()
      const annees = [...new Set(mois.map(m => m.year))]
      const bilans = await Promise.all(annees.map(async annee => {
        const res = await fetch(`/api/compta/year-summary?year=${annee}`)
        if (!res.ok) return null
        const j = await res.json()
        return { annee, months: j.months as { month: number; revenue: number; expenses: number }[] }
      }))
      if (annule) return
      const parAnnee = new Map(bilans.filter(Boolean).map(b => [b!.annee, b!.months]))
      setSixMois(mois.map(m => {
        const ligne = parAnnee.get(m.year)?.find(x => x.month === m.month + 1)
        return { label: m.label, resultat: (ligne?.revenue ?? 0) - (ligne?.expenses ?? 0) }
      }))
    })()
    return () => { annule = true }
  }, [hasCompta])

  if (!hasCompta) {
    return (
      <UpgradePrompt
        title="Gérez votre comptabilité"
        description="Suivez votre chiffre d'affaires, vos dépenses et votre résultat chaque mois. Disponible à partir du plan Pro."
        planLabel={comptaPlanLabel}
      />
    )
  }

  const precedente = getPeriodRange(periodType, navigatePeriod(periodType, refDate, -1))
  const resultat = (revenue ?? 0) - expenses.reduce((s, e) => s + Number(e.amount), 0)
  const resultatPrecedent = revenuePrecedent !== null && expensesPrecedent !== null
    ? revenuePrecedent - expensesPrecedent
    : null
  const ecart = resultatPrecedent !== null ? ecartRelatif(resultat, resultatPrecedent) : null

  const totalDepenses = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const recentes = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const maxAbs = sixMois ? Math.max(1, ...sixMois.map(m => Math.abs(m.resultat))) : 1

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Période">
        {PERIODES.map(p => (
          <button
            key={p.cle}
            type="button"
            role="tab"
            aria-selected={periodType === p.cle}
            onClick={() => setPeriodType(p.cle)}
            className={`shrink-0 h-[34px] px-3.5 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} transition-colors ${
              periodType === p.cle
                ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border border-[color:var(--v2-color-encre)]'
                : 'bg-transparent text-[color:var(--v2-color-gris)] border border-[color:var(--v2-filet-fort)]'
            }`}
          >
            {p.libelle}
          </button>
        ))}
      </div>

      {erreur ? (
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-rouge)]`}>
          Impossible de charger vos chiffres pour le moment. Rechargez la page dans un instant.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-[3px]">
            <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{libelleHero(periodType)}</span>
            <span className={`text-[44px] sm:text-[52px] leading-none ${hero}`}>
              {chargement ? '—' : euros(resultat)}
            </span>
            {!chargement && ecart !== null && (
              <span className={`text-[13.5px] ${corps}`} style={{ color: ecart >= 0 ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)' }}>
                {ecart >= 0 ? '+' : ''}{ecart} % {libelleComparaison(periodType, precedente)}
              </span>
            )}
          </div>

          <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
            <div className="flex justify-between px-4 py-3.5">
              <span className="flex flex-col gap-0.5">
                <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Encaissé</span>
                <span className={`text-[19px] ${corpsFort} tabular-nums`}>{chargement ? '—' : euros(revenue ?? 0)}</span>
              </span>
              <span className="flex flex-col gap-0.5 items-end">
                <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Dépensé</span>
                <span className={`text-[19px] ${corpsFort} tabular-nums`}>{chargement ? '—' : euros(totalDepenses)}</span>
              </span>
            </div>
            <div className="h-px bg-[color:var(--v2-filet)]" />
            {sixMois && (
              <div className="flex items-end gap-2 px-4 py-3.5" role="img" aria-label={sixMois.map(m => `${m.label} ${euros(m.resultat)}`).join(', ')}>
                {sixMois.map((m, i) => {
                  const hauteur = Math.max(6, Math.round((Math.abs(m.resultat) / maxAbs) * 104))
                  const dernier = i === sixMois.length - 1
                  return (
                    <div key={m.label} className="flex-1 flex flex-col items-center gap-[7px]">
                      <div className="w-full h-[104px] flex items-end">
                        <span
                          className="w-full rounded-[5px]"
                          style={{
                            height: hauteur,
                            backgroundColor: dernier ? 'var(--v2-color-encre)' : 'var(--v2-filet-fort)',
                          }}
                        />
                      </div>
                      <span className={`text-[11px] ${corpsFort}`} style={{ color: dernier ? 'var(--v2-color-encre)' : 'var(--v2-color-gris)' }}>
                        {m.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(22,22,26,0.28)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
            </svg>
          </Link>
        </>
      )}
    </div>
  )
}
