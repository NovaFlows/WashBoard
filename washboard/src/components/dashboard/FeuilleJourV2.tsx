'use client'

import type { Availability } from '@/types'
import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { TEXTE_ROUGE } from '@/components/dashboard/PrestationsUiV2'
import { NOMS_JOURS, libellePlage, plagesDuJour } from '@/lib/horaires'

// Les plages d'un jour, en feuille du bas — ouverte par un tap sur la ligne du
// jour dans HorairesV2. Retirer une plage demande une confirmation (feuille
// séparée, gérée par HorairesV2) ; il n'y a pas de modification en place : la
// route n'a pas de PATCH, comme sur le site (supprimer puis recréer).

type Props = {
  jour: number
  plages: Availability[]
  onAjouter: () => void
  onRetirer: (plage: Availability) => void
  onClose: () => void
}

export default function FeuilleJourV2({ jour, plages, onAjouter, onRetirer, onClose }: Props) {
  const nomJour = NOMS_JOURS[jour]
  const duJour = plagesDuJour(plages, jour)

  return (
    <Feuille titre={nomJour} onClose={onClose}>
      {duJour.length === 0 ? (
        <p className={`text-[15px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Fermé : aucun créneau réservable le {nomJour.toLowerCase()}.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--v2-filet)]">
          {duJour.map(p => (
            <li key={p.id} className="flex min-h-[52px] items-center gap-3">
              <span className={`min-w-0 flex-1 text-[17px] ${corpsFort} tabular-nums`}>{libellePlage(p)}</span>
              <button
                type="button"
                onClick={() => onRetirer(p)}
                aria-label={`Retirer la plage ${libellePlage(p)} du ${nomJour.toLowerCase()}`}
                className={`-mr-2 flex h-11 shrink-0 items-center px-2 text-[15px] ${corpsFort}`}
                style={{ color: TEXTE_ROUGE }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onAjouter}
        className={`${BOUTON} mt-4 w-full border border-[color:var(--v2-color-encre)] text-[color:var(--v2-color-encre)]`}
        style={PRESSION}
      >
        + Ajouter une plage le {nomJour.toLowerCase()}
      </button>
    </Feuille>
  )
}
