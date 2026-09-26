'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { useLigneGlissante, LARGEUR_ACTION_PX } from '@/hooks/useLigneGlissante'
import { PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, nom } from '@/components/dashboard/PrestationsUiV2'
import SelecteurPeriodeV2 from '@/components/dashboard/SelecteurPeriodeV2'
import { FeuilleAjoutDepenseV2, FeuilleAjoutRecurrentV2 } from '@/components/dashboard/FeuillesDepenseV2'
import { aujourdhuiParis, plageDe, type PeriodeChiffres } from '@/lib/chiffresPeriode'
import {
  jourCourt, libelleCategorie, libelleJourDuMois, totalDepenses,
  type Depense, type DepenseRecurrente,
} from '@/lib/depenses'
import {
  ajouterDepense, ajouterRecurrent, basculerRecurrent, lireDepenses, lireRecurrents,
  supprimerDepense, supprimerRecurrent,
} from '@/lib/depensesApi'

// « Dépenses » — refonte 2026, destination NEUVE, ouverte depuis Chiffres › Argent
// (Alexandre, 2026-09-26 : « quand je clique sur ajouter des frais j'arrive sur l'ancienne page
// de comptabilité »). Réservée à la PWA installée (voir `Depenses.tsx`, le garde-fou : le site
// est renvoyé vers `/dashboard/compta`, l'ancien écran, inchangé).
//
// Ce que cet écran fait, et seulement ça : saisir, lire et supprimer des frais. Le chiffre
// d'affaires, le résultat et les graphiques vivent dans Chiffres › Argent — les répéter ici
// ferait deux présentations d'une même donnée, qui finiraient par diverger. Seul le TOTAL de
// la période est rappelé, parce que c'est ce qu'on vient vérifier en ajoutant un frais.
//
// L'adresse est sous `/dashboard/chiffres/` pour que « Chiffres » reste allumé dans la barre
// du bas (BarreBasV2 : `startsWith('/dashboard/chiffres')`).
//
// Un frais venu d'un frais récurrent (`recurring_expense_id`) se supprime comme un autre : la
// ligne du mois disparaît, le frais récurrent lui-même reste — c'est ce que fait déjà l'ancien
// écran, et ce qu'on veut (un mois sauté n'annule pas l'abonnement).

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

type Suppression = { quoi: 'frais'; depense: Depense } | { quoi: 'recurrent'; recurrent: DepenseRecurrente } | null

function LigneFrais({
  depense, ouverte, onOuvrirLigne, onFermerLigne, onSupprimer,
}: {
  depense: Depense
  ouverte: boolean
  onOuvrirLigne: () => void
  onFermerLigne: () => void
  onSupprimer: () => void
}) {
  const { refLigne, poignee, styleContenu } = useLigneGlissante({ ouverte, onOuvrir: onOuvrirLigne, onFermer: onFermerLigne })
  return (
    <li ref={refLigne} className="relative overflow-hidden">
      <button
        type="button"
        onClick={onSupprimer}
        tabIndex={ouverte ? 0 : -1}
        aria-hidden={!ouverte}
        aria-label={`Supprimer le frais ${depense.label}`}
        className={`absolute inset-y-1.5 right-0 flex flex-col items-center justify-center gap-1 rounded-[12px] text-[12px] text-white ${corpsFort}`}
        style={{ width: LARGEUR_ACTION_PX, background: 'var(--v2-color-rouge)' }}
      >
        <Trash2 size={20} strokeWidth={2} aria-hidden />
        Supprimer
      </button>
      <div
        {...poignee}
        style={styleContenu}
        className="flex min-h-[58px] items-center gap-3 bg-[color:var(--v2-color-surface)] py-2.5 motion-reduce:!transition-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate text-[15px] ${nom}`}>{depense.label}</span>
          <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {libelleCategorie(depense.category)} · {jourCourt(depense.date)}
            {depense.recurring_expense_id ? ' · chaque mois' : ''}
          </span>
        </span>
        <span className={`shrink-0 text-[15px] ${corpsFort} tabular-nums`}>{euros.format(Number(depense.amount))}</span>
      </div>
    </li>
  )
}

export default function DepensesV2() {
  const [maintenant] = useState(() => Date.now())
  const aujourdhui = useMemo(() => aujourdhuiParis(maintenant), [maintenant])
  const [periode, setPeriode] = useState<PeriodeChiffres>(() => ({ type: 'mois', ref: aujourdhui }))
  const { debut, fin } = plageDe(periode)

  const [depenses, setDepenses] = useState<Depense[] | null>(null)
  const [recurrents, setRecurrents] = useState<DepenseRecurrente[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [feuille, setFeuille] = useState<'frais' | 'recurrent' | null>(null)
  const [ligneOuverte, setLigneOuverte] = useState<string | null>(null)
  const [suppression, setSuppression] = useState<Suppression>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null)
  const [bascule, setBascule] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const r = await lireDepenses(debut, fin)
    // Une panne ne vide pas la liste : on garde ce qui est affiché et on le dit.
    if (r.ok) { setDepenses(r.data); setErreur(null) }
    else setErreur(r.message)
  }, [debut, fin])

  useEffect(() => { void charger() }, [charger])

  const chargerRecurrents = useCallback(async () => {
    const r = await lireRecurrents()
    if (r.ok) setRecurrents(r.data)
  }, [])

  useEffect(() => { void chargerRecurrents() }, [chargerRecurrents])

  const total = depenses ? totalDepenses(depenses) : 0

  async function confirmerSuppression() {
    if (!suppression || suppressionEnCours) return
    setSuppressionEnCours(true)
    setSuppressionErreur(null)
    const r = suppression.quoi === 'frais'
      ? await supprimerDepense(suppression.depense.id)
      : await supprimerRecurrent(suppression.recurrent.id)
    setSuppressionEnCours(false)
    if (!r.ok) { setSuppressionErreur(r.message); return }
    if (suppression.quoi === 'frais') {
      setDepenses(d => (d ?? []).filter(x => x.id !== suppression.depense.id))
    } else {
      setRecurrents(rs => rs.filter(x => x.id !== suppression.recurrent.id))
      // Un récurrent supprimé retire aussi ses lignes déjà posées ce mois-ci.
      void charger()
    }
    setSuppression(null)
  }

  async function basculer(r: DepenseRecurrente) {
    if (bascule) return
    setBascule(r.id)
    const res = await basculerRecurrent(r.id, !r.active)
    setBascule(null)
    if (!res.ok) { setErreur(res.message); return }
    setRecurrents(rs => rs.map(x => (x.id === r.id ? { ...x, active: !r.active } : x)))
    void charger()
  }

  return (
    <div className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]">
      <div className="flex items-center gap-1 pb-2">
        <Link
          href="/dashboard/chiffres"
          aria-label="Retour à Chiffres"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Dépenses</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Ce que vous dépensez pour travailler
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFeuille('frais')}
          aria-label="Ajouter un frais"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition-transform active:scale-[.94] motion-reduce:transition-none"
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          <Plus size={22} strokeWidth={2.4} aria-hidden />
        </button>
      </div>

      <div className="mt-1">
        <SelecteurPeriodeV2 periode={periode} aujourdhui={aujourdhui} onChange={setPeriode} />
      </div>

      <div className="mt-4 flex items-baseline justify-between rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3.5">
        <span className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Total de la période</span>
        <span className={`text-[22px] ${corpsFort} tabular-nums`}>{depenses ? euros.format(total) : '—'}</span>
      </div>

      {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}

      <section aria-label="Frais de la période" className="mt-[26px]">
        <h2 className={`px-0.5 pb-1.5 text-[19px] leading-tight ${titre}`}>Les frais</h2>
        <div className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
          {!depenses ? (
            <p className={`py-8 text-center text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Chargement…</p>
          ) : depenses.length === 0 ? (
            /* Un seul bouton d'ajout sur l'écran : le « + » de l'en-tête. Un second ici
               faisait doublon (Alexandre, 2026-09-26). */
            <p className={`px-4 py-6 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Aucun frais sur cette période. Touchez « + » en haut pour en ajouter un : carburant,
              produits, matériel… tout ce que vous notez ici se retire de votre chiffre d’affaires
              dans Chiffres.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--v2-filet)] px-4">
              {depenses.map(d => (
                <LigneFrais
                  key={d.id}
                  depense={d}
                  ouverte={ligneOuverte === d.id}
                  onOuvrirLigne={() => setLigneOuverte(d.id)}
                  onFermerLigne={() => setLigneOuverte(cur => (cur === d.id ? null : cur))}
                  onSupprimer={() => { setLigneOuverte(null); setSuppressionErreur(null); setSuppression({ quoi: 'frais', depense: d }) }}
                />
              ))}
            </ul>
          )}
        </div>
        {depenses && depenses.length > 0 && (
          <p className={`mt-2 px-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Glissez une ligne vers la gauche pour la supprimer.
          </p>
        )}
      </section>

      <section aria-label="Frais qui reviennent chaque mois" className="mt-[26px]">
        <div className="flex items-center justify-between gap-3 pb-1.5">
          <h2 className={`px-0.5 text-[19px] leading-tight ${titre}`}>Chaque mois</h2>
          <button
            type="button"
            onClick={() => setFeuille('recurrent')}
            aria-label="Ajouter un frais qui revient chaque mois"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)] transition-transform active:scale-[.94] motion-reduce:transition-none"
            style={PRESSION}
          >
            <Plus size={20} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
          {recurrents.length === 0 ? (
            <p className={`px-4 py-6 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Assurance, abonnement, loyer : ajoutez-les une fois, ils s’inscrivent tout seuls chaque mois.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--v2-filet)] px-4">
              {recurrents.map(r => (
                <li key={r.id} className="py-3">
                  <div className="flex items-baseline gap-3">
                    <span className={`min-w-0 flex-1 truncate text-[15px] ${nom} ${r.active ? '' : 'opacity-50'}`}>{r.label}</span>
                    <span className={`shrink-0 text-[15px] ${corpsFort} tabular-nums ${r.active ? '' : 'opacity-50'}`}>
                      {euros.format(Number(r.amount))}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    {libelleJourDuMois(r.day_of_month)}{r.active ? '' : ' · en pause'}
                  </p>
                  {/* Les deux actions sur leur propre ligne : côte à côte du libellé, « Mettre en
                      pause » ne laissait plus la place de lire le jour du mois. */}
                  <div className="mt-1.5 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => void basculer(r)}
                      disabled={bascule === r.id}
                      className={`min-h-9 text-[13px] ${corpsFort} disabled:opacity-50`}
                      style={{ color: 'var(--v2-color-accent)' }}
                    >
                      {r.active ? 'Mettre en pause' : 'Reprendre'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSuppressionErreur(null); setSuppression({ quoi: 'recurrent', recurrent: r }) }}
                      className={`min-h-9 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {feuille === 'frais' && (
        <FeuilleAjoutDepenseV2
          aujourdhui={aujourdhui}
          onEnregistrer={async champs => {
            const r = await ajouterDepense(champs)
            if (!r.ok) return r.message
            await charger()
            return null
          }}
          onClose={() => setFeuille(null)}
        />
      )}
      {feuille === 'recurrent' && (
        <FeuilleAjoutRecurrentV2
          onEnregistrer={async champs => {
            const r = await ajouterRecurrent(champs)
            if (!r.ok) return r.message
            await Promise.all([chargerRecurrents(), charger()])
            return null
          }}
          onClose={() => setFeuille(null)}
        />
      )}
      {suppression && (
        <ConfirmationSuppression
          titre={suppression.quoi === 'frais'
            ? `Supprimer « ${suppression.depense.label} » ?`
            : `Supprimer « ${suppression.recurrent.label} » ?`}
          texte={suppression.quoi === 'frais'
            ? 'Ce frais ne comptera plus dans vos chiffres.'
            : 'Il ne s’inscrira plus chaque mois. Les frais déjà posés ce mois-ci disparaissent aussi.'}
          enCours={suppressionEnCours}
          erreur={suppressionErreur}
          onConfirmer={confirmerSuppression}
          onClose={() => setSuppression(null)}
        />
      )}
    </div>
  )
}
