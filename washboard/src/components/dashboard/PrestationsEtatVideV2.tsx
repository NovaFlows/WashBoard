'use client'

import { useRef, useState } from 'react'
import { PRESETS } from '@/components/dashboard/admin/CategoriesManager'
import { corps, corpsFort, titre, PRESSION } from '@/components/dashboard/FeuilleV2'
import { Constat, nom } from '@/components/dashboard/PrestationsUiV2'
import type { ModeleCategorie } from '@/lib/prestationForm'

// « Vous vendez quoi ? » — état vide de « Prestations et prix » (aucune
// catégorie, aucune prestation).
//
// AJOUT HORS « MÊMES FONCTIONNALITÉS QU'AVANT LA REFONTE » : idée proposée par
// l'agent `ideas` (raccourci de 3-4 écrans à un seul tap : choisir un modèle crée
// la catégorie et ses types, puis enchaîne sur la première prestation). Isolée
// dans ce fichier pour pouvoir être retirée sans toucher au reste : il suffit de
// supprimer ce fichier et le bloc « État vide » de `PrestationsV2.tsx` (le
// composant `PrestationsV2` retombe alors sur la liste vide et son bouton
// « Ajouter une catégorie », qui ouvre la feuille de catégorie).
//
// Les deux choix sont les `PRESETS` de `CategoriesManager` — mêmes types, mêmes
// identifiants fixes (`SUV`, `citadine`… pour « Voiture »), pas de copie.
//
// Un seul tap doit créer UNE catégorie : le bouton se bloque dès le premier tap
// (verrou en plus de l'état, un second tap peut arriver avant le nouveau rendu).

type Props = {
  /** Crée la catégorie du modèle puis ouvre la feuille de la première prestation.
   *  Rend `null` si tout s'est bien passé, sinon la phrase d'erreur. */
  onModele: (modele: ModeleCategorie) => Promise<string | null>
  /** « Autre » : ouvre la feuille de catégorie, vide. */
  onAutre: () => void
}

export default function PrestationsEtatVideV2({ onModele, onAutre }: Props) {
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const verrou = useRef(false)

  async function choisir(modele: ModeleCategorie) {
    if (verrou.current) return
    verrou.current = true
    setEnCours(modele.name)
    setErreur(null)
    try {
      const message = await onModele(modele)
      if (message) setErreur(message)
    } finally {
      verrou.current = false
      setEnCours(null)
    }
  }

  const carte = 'w-full rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 text-left transition-transform active:scale-[.985] disabled:opacity-50 disabled:active:scale-100 motion-reduce:transition-none'

  return (
    <div className="pt-6">
      <h2 className={`text-[26px] leading-tight ${titre}`}>Vous vendez quoi ?</h2>
      <p className={`mt-2 text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Un tap crée vos types, puis vous ajoutez votre première prestation.
      </p>

      <div className="mt-6 space-y-3">
        {PRESETS.map(p => (
          <button
            key={p.name}
            type="button"
            disabled={enCours !== null}
            onClick={() => choisir(p)}
            className={`${carte} flex min-h-[88px] flex-col justify-center gap-1 py-4`}
            style={PRESSION}
          >
            <span className={`text-[20px] ${nom}`}>{enCours === p.name ? 'Création…' : p.name}</span>
            <span className={`truncate text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {p.types.slice(0, 4).map(t => t.name).join(', ')}…
            </span>
          </button>
        ))}
        <button
          type="button"
          disabled={enCours !== null}
          onClick={onAutre}
          className={`${carte} flex min-h-[64px] items-center py-3`}
          style={PRESSION}
        >
          <span className={`text-[16px] ${corpsFort}`}>Autre chose</span>
          <span className={`ml-auto text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>je crée mes types</span>
        </button>
      </div>

      {erreur && <div className="mt-4"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
    </div>
  )
}
