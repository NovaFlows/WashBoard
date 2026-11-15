'use client'

import { useState } from 'react'
import { Feuille, CHAMP, PRESSION, corps, puce } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { CATEGORIES_DEPENSE, montantNombre, validerDepense, validerRecurrent } from '@/lib/depenses'
import { useT } from '@/components/i18n/I18nProvider'

// Feuilles du bas de l'écran « Dépenses » (PWA) : ajouter un frais, ajouter un frais qui
// revient chaque mois. Mêmes champs et mêmes routes que l'ancien écran de comptabilité
// (`ComptaDashboard`, conservé pour le site) — seule la présentation change.
//
// `onEnregistrer` rend `null` quand c'est enregistré, sinon la phrase à afficher sur place :
// la feuille reste ouverte, la saisie n'est jamais perdue.

function ChoixCategorie({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('Catégorie')}>
      {CATEGORIES_DEPENSE.map(c => (
        <button
          key={c.value}
          type="button"
          aria-pressed={valeur === c.value}
          onClick={() => onChange(c.value)}
          className={puce(valeur === c.value)}
          style={PRESSION}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

/** Montant : un champ large, en gros, avec le « € » collé — c'est ce qu'on tape en premier. */
function ChampMontant({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const t = useT()
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={valeur}
        onChange={e => onChange(e.target.value)}
        placeholder="0,00"
        aria-label={t('Montant en euros')}
        className={`${CHAMP} h-14 pr-10 text-[22px] [font-weight:var(--v2-type-corps-fort-poids)] tabular-nums`}
      />
      <span
        aria-hidden
        className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[18px] ${corps} text-[color:var(--v2-color-gris)]`}
      >
        €
      </span>
    </div>
  )
}

export function FeuilleAjoutDepenseV2({
  aujourdhui, onEnregistrer, onClose,
}: {
  /** Jour proposé par défaut (`AAAA-MM-JJ`), à l'heure de Paris. */
  aujourdhui: string
  onEnregistrer: (champs: { date: string; category: string; label: string; amount: number }) => Promise<string | null>
  onClose: () => void
}) {
  const t = useT()
  const [date, setDate] = useState(aujourdhui)
  const [categorie, setCategorie] = useState<string>(CATEGORIES_DEPENSE[0].value)
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerDepense({ label: libelle, amount: montant, date })
    if (refus) { setErreur(refus); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer({
      date,
      category: categorie,
      label: libelle.trim(),
      amount: montantNombre(montant),
    })
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre={t('Ajouter un frais')}
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle={t('Ajouter')} onClose={onClose} formulaire="depense-ajout" />}
    >
      <form id="depense-ajout" onSubmit={soumettre} noValidate>
        <Bloc titre={t('Montant')}>
          <ChampMontant valeur={montant} onChange={v => { setMontant(v); setErreur(null) }} />
        </Bloc>
        <Bloc titre={t('Libellé')}>
          <input
            type="text"
            value={libelle}
            onChange={e => { setLibelle(e.target.value); setErreur(null) }}
            placeholder={t('Plein essence')}
            aria-label={t('Libellé')}
            className={CHAMP}
          />
        </Bloc>
        <Bloc titre={t('Catégorie')}>
          <ChoixCategorie valeur={categorie} onChange={setCategorie} />
        </Bloc>
        <Bloc titre={t('Date')}>
          <input
            type="date"
            value={date}
            max={aujourdhui}
            onChange={e => { setDate(e.target.value); setErreur(null) }}
            aria-label={t('Date du frais')}
            className={CHAMP}
          />
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
        </Bloc>
      </form>
    </Feuille>
  )
}

const JOURS_PROPOSES = [1, 5, 10, 15, 20, 25]

export function FeuilleAjoutRecurrentV2({
  onEnregistrer, onClose,
}: {
  onEnregistrer: (champs: { category: string; label: string; amount: number; day_of_month: number }) => Promise<string | null>
  onClose: () => void
}) {
  const t = useT()
  const [categorie, setCategorie] = useState<string>('abonnement')
  const [libelle, setLibelle] = useState('')
  const [montant, setMontant] = useState('')
  const [jour, setJour] = useState('1')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerRecurrent({ label: libelle, amount: montant, day_of_month: jour })
    if (refus) { setErreur(refus); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer({
      category: categorie,
      label: libelle.trim(),
      amount: montantNombre(montant),
      day_of_month: Number(jour),
    })
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre={t('Frais qui revient chaque mois')}
      sousTitre={t('Assurance, abonnement, loyer… ajouté tout seul, chaque mois.')}
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle={t('Ajouter')} onClose={onClose} formulaire="depense-recurrent" />}
    >
      <form id="depense-recurrent" onSubmit={soumettre} noValidate>
        <Bloc titre={t('Montant')}>
          <ChampMontant valeur={montant} onChange={v => { setMontant(v); setErreur(null) }} />
        </Bloc>
        <Bloc titre={t('Libellé')}>
          <input
            type="text"
            value={libelle}
            onChange={e => { setLibelle(e.target.value); setErreur(null) }}
            placeholder={t('Assurance véhicule')}
            aria-label={t('Libellé')}
            className={CHAMP}
          />
        </Bloc>
        <Bloc titre={t('Catégorie')}>
          <ChoixCategorie valeur={categorie} onChange={setCategorie} />
        </Bloc>
        <Bloc titre={t('Jour du mois')} aide="1 à 28">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Jour du mois')}>
            {JOURS_PROPOSES.map(j => (
              <button
                key={j}
                type="button"
                aria-pressed={jour === String(j)}
                onClick={() => { setJour(String(j)); setErreur(null) }}
                className={puce(jour === String(j))}
                style={PRESSION}
              >
                {j === 1 ? '1er' : j}
              </button>
            ))}
          </div>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={28}
            value={jour}
            onChange={e => { setJour(e.target.value); setErreur(null) }}
            aria-label={t('Jour du mois')}
            className={`${CHAMP} mt-2.5`}
          />
          <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            {t('Au-delà du 28, le frais sauterait les mois de février : choisissez un jour plus tôt.')}
          </p>
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
        </Bloc>
      </form>
    </Feuille>
  )
}
