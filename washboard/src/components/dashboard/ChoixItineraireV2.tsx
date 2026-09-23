'use client'

import { ChevronRight } from 'lucide-react'
import { Feuille, corpsFort, PRESSION } from '@/components/dashboard/FeuilleV2'
import { applicationsItineraire, detecterPlateforme } from '@/lib/itineraire'

// « Ouvrir l'itinéraire avec… » — feuille du bas de l'accueil v2 (PWA). Demande
// d'Alexandre, 2026-09-24 : Plans, Waze ou Google Maps selon le téléphone, sans
// Plans sur Android (voir `@/lib/itineraire`, qui porte la règle et ses tests).
//
// Montée seulement après le toucher du bouton, donc côté navigateur : lire
// `navigator` directement ici ne crée aucun désaccord d'hydratation.
//
// Chaque application est un simple lien : rien ne se lance sans un toucher de
// plus, et rien n'est mémorisé. Le lien ouvre l'application quand elle est
// installée (Plans, Waze, Google Maps) ; sinon la version web. Non vérifié sur
// un vrai téléphone : le geste d'ouverture d'application depuis une PWA
// installée dépend de l'appareil.
export default function ChoixItineraireV2({ adresse, onClose }: { adresse: string; onClose: () => void }) {
  const plateforme = detecterPlateforme(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
  const applications = applicationsItineraire(adresse, plateforme)

  return (
    <Feuille titre="Ouvrir avec" sousTitre={adresse} onClose={onClose}>
      <ul className="-mt-1 mb-2 divide-y divide-[color:var(--v2-filet)] rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
        {applications.map(app => (
          <li key={app.id}>
            <a
              href={app.lien}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className={`flex min-h-[52px] items-center justify-between gap-3 px-4 text-[16px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-colors active:bg-[color:var(--v2-filet)]`}
              style={PRESSION}
            >
              {app.nom}
              <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </Feuille>
  )
}
