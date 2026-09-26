'use client'

import { useMemo, useState } from 'react'
import type { Availability } from '@/types'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, puce } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import {
  HEURES_CHOIX, JOURS_AFFICHES, NOMS_COURTS, NOMS_JOURS, analyserAjout, phraseEchecAjout, type ResultatJour,
} from '@/lib/horaires'

// Ajout d'une plage d'ouverture, en feuille du bas — refonte 2026, réservée à la
// PWA installée (ouverte par HorairesV2.tsx uniquement ; le site garde
// `admin/DisponibilitesManager.tsx`, inchangé). Mêmes règles que ce formulaire :
// fin après début, minutes alignées sur 30.
//
// Deux différences d'interface, pas de règle serveur :
//   - les jours sont à choix MULTIPLE : une plage, puis un appel par jour coché
//     (remplir du lundi au vendredi = 6 gestes au lieu d'une vingtaine). Ces appels
//     ne sont pas atomiques : la feuille reste ouverte sur les jours en échec et
//     dit ce qui a été créé — jamais un succès si un seul jour a échoué ;
//   - deux plages qui se recouvrent sont refusées AVANT l'envoi (voir
//     `lib/horaires.ts`) — le site et la route ne l'interdisent pas.
//
// Les heures sont deux listes natives par pas de 30 min, pas un `type="time"` : iOS
// ignore `step` dans sa roue, et le serveur refuse toute minute non alignée.

type Props = {
  /** Jour(s) coché(s) à l'ouverture : celui de la ligne d'où l'on vient, ou aucun. */
  joursInitiaux: number[]
  /** Toutes les plages déjà enregistrées (pour refuser un chevauchement). */
  plages: Availability[]
  /** `null` : un appel était déjà en cours, ce tap est ignoré. */
  onAjouter: (jours: number[], debut: string, fin: string) => Promise<ResultatJour[] | null>
  onClose: () => void
}

export default function FeuillePlageV2({ joursInitiaux, plages, onAjouter, onClose }: Props) {
  const [jours, setJours] = useState(joursInitiaux)
  const [debut, setDebut] = useState('08:00')
  const [fin, setFin] = useState('18:00')
  const [enCours, setEnCours] = useState(false)
  const [echec, setEchec] = useState<string | null>(null)

  const analyse = useMemo(() => analyserAjout(jours, debut, fin, plages), [jours, debut, fin, plages])
  const peutAjouter = analyse.pret && !enCours

  const basculerJour = (j: number) => setJours(js => (js.includes(j) ? js.filter(x => x !== j) : [...js, j]))

  async function ajouter() {
    if (!peutAjouter) return
    setEnCours(true)
    setEchec(null)
    try {
      const resultats = await onAjouter(jours, debut, fin)
      if (resultats === null) return
      const phrase = phraseEchecAjout(resultats)
      if (!phrase) { onClose(); return }
      // Les jours créés sont décochés : retenter ne peut pas les doubler.
      const rates = new Set(resultats.filter(r => !r.ok).map(r => r.jour))
      setJours(js => js.filter(j => rates.has(j)))
      setEchec(phrase)
    } finally {
      setEnCours(false)
    }
  }

  const pied = (
    <div>
      {echec && (
        <div className="mb-3 space-y-1">
          <Constat ton="rouge" role="alert">{echec}</Constat>
          <p className={`pl-[15px] text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Les jours en échec restent cochés : vous pouvez réessayer.
          </p>
        </div>
      )}
      {jours.length === 0 && !enCours && (
        <p className={`mb-3 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>Cochez au moins un jour.</p>
      )}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
          style={PRESSION}
        >
          {echec ? 'Fermer' : 'Annuler'}
        </button>
        <button
          type="button"
          onClick={ajouter}
          disabled={!peutAjouter}
          className={`${BOUTON} flex-[1.4] text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          {enCours ? 'Ajout…' : jours.length > 1 ? `Ajouter (${jours.length} jours)` : 'Ajouter'}
        </button>
      </div>
    </div>
  )

  return (
    <Feuille
      titre="Nouvelle plage"
      sousTitre="Vos clients réservent pendant ces heures."
      onClose={onClose}
      fermerSurFond={false}
      pied={pied}
    >
      <div className="space-y-5 pb-2">
        <div>
          <p className={ETIQUETTE} id="plage-jours">Jours</p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-labelledby="plage-jours">
            {JOURS_AFFICHES.map(j => {
              const actif = jours.includes(j)
              return (
                <button
                  key={j}
                  type="button"
                  aria-pressed={actif}
                  aria-label={NOMS_JOURS[j]}
                  onClick={() => basculerJour(j)}
                  className={`${puce(actif)} !px-0`}
                  style={PRESSION}
                >
                  {NOMS_COURTS[j]}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="plage-debut" className={ETIQUETTE}>Début</label>
              <select id="plage-debut" value={debut} onChange={e => setDebut(e.target.value)} className={`${CHAMP} tabular-nums`}>
                {HEURES_CHOIX.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="plage-fin" className={ETIQUETTE}>Fin</label>
              <select id="plage-fin" value={fin} onChange={e => setFin(e.target.value)} className={`${CHAMP} tabular-nums`}>
                {HEURES_CHOIX.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {analyse.erreurHeures && <Constat ton="rouge" role="alert">{analyse.erreurHeures}</Constat>}
            {analyse.conflits.map(c => <Constat key={c} ton="rouge" role="alert">{c}</Constat>)}
            {analyse.contacts.map(c => <Constat key={c} ton="ambre" role="status">{c}</Constat>)}
          </div>
        </div>
      </div>
    </Feuille>
  )
}
