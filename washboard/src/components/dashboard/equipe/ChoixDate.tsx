'use client'

import { CHAMP, puce } from '@/components/dashboard/FeuilleV2'
import { aujourdhuiParis } from '@/lib/suiviAppels'

// Date de relance / de rappel : raccourcis + calendrier. Partagé par la fiche laveur
// et la zone Prospects de l'espace équipe.

export function dansJours(n: number, now: Date): string {
  return aujourdhuiParis(new Date(now.getTime() + n * 864e5))
}

/** « ven. 6 nov. » à partir d'une date AAAA-MM-JJ. */
export function dateJour(aaaammjj: string): string {
  return new Date(`${aaaammjj}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
}

export default function ChoixDate({ valeur, onChange, now, avecAujourdhui = false, effacable = false, libelleEffacer = 'Pas de relance' }: {
  valeur: string
  onChange: (v: string) => void
  now: Date
  avecAujourdhui?: boolean
  effacable?: boolean
  libelleEffacer?: string
}) {
  const raccourcis = [
    ...(avecAujourdhui ? [{ l: 'Aujourd’hui', j: 0 }] : []),
    { l: 'Demain', j: 1 }, { l: 'Dans 3 jours', j: 3 }, { l: 'Dans 1 semaine', j: 7 },
  ]
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-2">
        {effacable && <button type="button" aria-pressed={valeur === ''} onClick={() => onChange('')} className={puce(valeur === '')}>{libelleEffacer}</button>}
        {raccourcis.map(r => {
          const date = dansJours(r.j, now)
          // Mise « À rappeler » : une date est obligatoire, une puce ne se décoche pas.
          return <button key={r.l} type="button" aria-pressed={valeur === date} onClick={() => onChange(valeur === date && !avecAujourdhui ? '' : date)} className={puce(valeur === date)}>{r.l}</button>
        })}
      </div>
      <input type="date" aria-label="Date de relance" value={valeur} min={aujourdhuiParis(now)} onChange={e => onChange(e.target.value)} className={CHAMP} />
    </>
  )
}
