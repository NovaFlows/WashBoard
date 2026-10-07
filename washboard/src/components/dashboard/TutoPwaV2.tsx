'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { useEcranTelephone } from '@/hooks/useEcranTelephone'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import {
  ETAPES_TUTO_PWA, abonnerTuto, ecrireTuto, etapeSuivante, etatAuChargement,
  lireEtat, lireTuto, serialiserEtat, terminerTuto,
} from '@/lib/tutoPwa'

// Tuto de la PWA installée, monté par DashboardShell à côté de VisiteGuidee
// (voir lib/tutoPwa.ts pour la logique et le choix des 4 arrêts).
//
// Assombrit tout l'écran et découpe une fenêtre lumineuse autour de l'élément
// montré — jamais un SVG/masque : un rectangle TRANSPARENT posé exactement sur
// la cible, agrandi d'une marge, dont l'énorme ombre portée couvre tout le
// reste de l'écran (box-shadow à écart de 9999px). Plus simple qu'un masque et
// s'adapte sans calcul à n'importe quelle taille d'écran.
//
// Téléphone uniquement (`useEcranTelephone`) : la barre du bas qu'il présente
// n'existe, pour l'instant, que sur cette taille d'écran — la version
// ordinateur de la refonte n'est pas encore construite (voir TODO.md).

type Rect = { top: number; left: number; width: number; height: number }

function mesurer(cible: string | undefined): Rect | null {
  if (!cible) return null
  const element = document.querySelector(`[data-tuto-pwa-cible="${cible}"]`)
  if (!element) return null
  const r = element.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

const MARGE_DECOUPE = 8

export default function TutoPwaV2({ aFaire }: { aFaire?: boolean }) {
  const isPwa = usePwaStandalone()
  const estTelephone = useEcranTelephone()
  const etat = lireEtat(useSyncExternalStore(abonnerTuto, lireTuto, () => null))

  useEffect(() => {
    const stocke = lireEtat(lireTuto())
    const suivant = etatAuChargement(stocke, aFaire)
    if (serialiserEtat(suivant) !== serialiserEtat(stocke)) ecrireTuto(suivant)
  }, [aFaire])

  const etape = etat.statut === 'en_cours' ? etat.etape : null
  const cible = etape === null ? undefined : ETAPES_TUTO_PWA[etape].cible

  // Mesurée après peinture (pas pendant) : la cible est déjà montée par
  // DashboardShell au même rendu, jamais besoin d'attendre son arrivée comme
  // la visite guidée (qui, elle, navigue vers des pages encore vides).
  const [decoupe, setDecoupe] = useState<Rect | null>(null)
  useEffect(() => {
    if (!cible) { setDecoupe(null); return }
    const recalculer = () => setDecoupe(mesurer(cible))
    recalculer()
    window.addEventListener('resize', recalculer)
    window.addEventListener('orientationchange', recalculer)
    return () => {
      window.removeEventListener('resize', recalculer)
      window.removeEventListener('orientationchange', recalculer)
    }
  }, [cible])

  if (!isPwa || !estTelephone || etape === null) return null

  const suivante = etapeSuivante(etape)

  function avancer() {
    if (suivante === null) { terminerTuto(); return }
    ecrireTuto({ statut: 'en_cours', etape: suivante })
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Découverte de l'application">
      {decoupe ? (
        <div
          aria-hidden
          className="absolute rounded-2xl transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: decoupe.top - MARGE_DECOUPE,
            left: decoupe.left - MARGE_DECOUPE,
            width: decoupe.width + MARGE_DECOUPE * 2,
            height: decoupe.height + MARGE_DECOUPE * 2,
            boxShadow: '0 0 0 9999px rgba(10,10,12,.78)',
          }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: 'rgba(10,10,12,.78)' }} />
      )}

      <div
        className={`absolute left-3 right-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] shadow-[0_12px_32px_rgba(0,0,0,.35)] p-4`}
        style={{ bottom: 'calc(14px + 66px + 10px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}>
            Étape {etape + 1}/{ETAPES_TUTO_PWA.length}
          </p>
          <button
            type="button"
            onClick={terminerTuto}
            className={`-my-2 -mr-2 px-2 py-2 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
          >
            Passer
          </button>
        </div>
        <div className="mt-2 h-1 rounded-full overflow-hidden bg-[color:var(--v2-filet)]" aria-hidden>
          <div
            className="h-full rounded-full bg-[color:var(--v2-color-accent)] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${((etape + 1) / ETAPES_TUTO_PWA.length) * 100}%` }}
          />
        </div>
        <p aria-live="polite" className={`mt-3 text-[15px] leading-snug ${corps}`}>
          {ETAPES_TUTO_PWA[etape].texte}
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={avancer}
            className={`h-10 px-5 rounded-[var(--v2-radius-bouton)] text-[15px] ${corpsFort} text-white bg-[color:var(--v2-color-accent)]`}
          >
            {suivante === null ? 'Terminé' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  )
}
