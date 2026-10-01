'use client'

import { useRef, useState } from 'react'
import { corps, corpsFort, titre, PRESSION } from '@/components/dashboard/FeuilleV2'
import { Constat, nom } from '@/components/dashboard/PrestationsUiV2'
import { resumeHoraires } from '@/lib/horaires'

// « Quand travaillez-vous ? » — état vide de « Horaires » (aucune plage : aucun
// créneau réservable sur la page de réservation).
//
// AJOUT HORS « MÊMES FONCTIONNALITÉS QU'AVANT LA REFONTE » : idée proposée par
// les agents `ideas` et `designer` (deux semaines types en un tap au lieu de
// choisir jour par jour). Isolée dans ce fichier pour pouvoir être retirée sans
// toucher au reste : il suffit de supprimer ce fichier, l'import et le bloc
// « État vide » de `HorairesV2.tsx` (la fonction `creerDepuisModele` avec lui) ;
// l'écran retombe alors sur la carte des sept jours « Fermé », et la phrase
// d'alerte « Aucun créneau n'est réservable » — qui, elle, reste dans
// HorairesV2 — s'affiche au-dessus.
//
// Un tap crée PLUSIEURS plages (un POST par jour, non atomique) : le bouton se
// bloque dès le premier tap (verrou en plus de l'état — un second tap peut
// arriver avant le nouveau rendu — et `unSeulALaFois` dans `useHorairesV2`
// protège en dernier ressort). Les libellés sont calculés à partir des jours et
// des heures du modèle, pas écrits à la main.

export type ModeleHoraires = { jours: number[]; debut: string; fin: string }

const MODELES: ModeleHoraires[] = [
  { jours: [1, 2, 3, 4, 5], debut: '08:00', fin: '18:00' },
  { jours: [1, 2, 3, 4, 5, 6], debut: '09:00', fin: '18:00' },
]

const libelle = (m: ModeleHoraires) =>
  resumeHoraires(m.jours.map(j => ({ day_of_week: j, start_time: m.debut, end_time: m.fin })))

type Props = {
  /** Crée les plages du modèle. Rend `null` si tout s'est bien passé (ou si le
   *  parent prend le relais, voir HorairesV2), sinon la phrase d'erreur. */
  onModele: (modele: ModeleHoraires) => Promise<string | null>
  /** « Je règle moi-même » : ouvre la feuille d'ajout, sans jour coché. */
  onAutre: () => void
}

export default function HorairesEtatVideV2({ onModele, onAutre }: Props) {
  const [enCours, setEnCours] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const verrou = useRef(false)

  async function choisir(index: number) {
    if (verrou.current) return
    verrou.current = true
    setEnCours(index)
    setErreur(null)
    try {
      const message = await onModele(MODELES[index])
      if (message) setErreur(message)
    } finally {
      verrou.current = false
      setEnCours(null)
    }
  }

  const carte = 'w-full rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 text-left transition-transform active:scale-[.985] disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none'

  return (
    <div className="pt-5">
      <h2 className={`text-[26px] leading-tight ${titre}`}>Quand travaillez-vous ?</h2>
      <p className={`mt-2 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Un tap règle votre semaine. Vous pourrez l’ajuster ensuite.
      </p>

      <div className="mt-6 space-y-3">
        {MODELES.map((m, i) => (
          <button
            key={i}
            type="button"
            disabled={enCours !== null}
            onClick={() => choisir(i)}
            className={`${carte} flex min-h-[80px] flex-col justify-center gap-1 py-4`}
            style={PRESSION}
          >
            <span className={`text-[20px] ${nom}`}>{enCours === i ? 'Création…' : libelle(m)}</span>
            <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{m.jours.length} jours par semaine</span>
          </button>
        ))}
        <button
          type="button"
          disabled={enCours !== null}
          onClick={onAutre}
          className={`${carte} flex min-h-[64px] items-center py-3`}
          style={PRESSION}
        >
          <span className={`text-[16px] ${corpsFort}`}>Je règle moi-même</span>
          <span className={`ml-auto text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>jour par jour</span>
        </button>
      </div>

      {erreur && <div className="mt-4"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
    </div>
  )
}
