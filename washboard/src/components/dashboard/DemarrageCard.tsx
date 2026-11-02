'use client'

import Link from 'next/link'
import { etapeDemarrage, type SetupProgress } from '@/lib/setupProgress'

// Carte d'accueil d'un compte qui ne peut pas encore prendre de réservation.
//
// Un nouvel inscrit arrivait sur un tableau de bord vide (« 0 en attente »)
// sans savoir par où commencer : l'avancement n'était visible que dans les
// Paramètres. Un inscrit avait ainsi tout rempli sauf ses prestations, et sa
// page publique ne proposait rien.
//
// Elle ne montre que l'indispensable, avec un seul bouton vers la prochaine
// étape, et disparaît dès que la page peut encaisser un rendez-vous : le
// confort (avis, relances, logo…) reste l'affaire de la barre des Paramètres.

const BOUTON: Record<string, string> = {
  services: 'Configurer mes prestations',
  availabilities: 'Ajouter mes horaires',
  baseAddress: 'Renseigner mon adresse',
}

const POLICE = '[font-family:var(--font-archivo)]'
const CORPS = `${POLICE} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const CORPS_FORT = `${POLICE} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const TITRE = `${POLICE} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`

export function DemarrageCard({ progress }: { progress: SetupProgress }) {
  const etape = etapeDemarrage(progress)
  if (!etape) return null
  const indispensables = progress.items.filter(i => i.blocking)

  const restantes = indispensables.filter(i => !i.done).length
  return (
    <section
      aria-labelledby="demarrage-titre"
      className={`mb-6 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-5 text-[color:var(--v2-color-encre)] ${POLICE}`}
    >
      <h2 id="demarrage-titre" className={`text-[17px] ${TITRE}`}>Configurer mon compte et mes prestations</h2>
      <p className={`mt-1 text-[13.5px] ${CORPS} text-[color:var(--v2-color-gris)]`}>
        Votre page de réservation ne peut pas encore prendre de rendez-vous. Il reste {restantes === 1 ? 'une étape' : `${restantes} étapes`}.
      </p>
      <ol className="mt-4 space-y-2.5">
        {indispensables.map(item => (
          <li key={item.key} className={`flex items-center gap-2.5 text-[14px] ${CORPS}`}>
            {item.done ? (
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--v2-color-vert)' }}>
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
              </span>
            ) : (
              <span
                aria-hidden
                className="h-5 w-5 shrink-0 rounded-full border-2"
                style={{ borderColor: item.key === etape.key ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)' }}
              />
            )}
            <span className={item.done ? 'text-[color:var(--v2-color-gris)] line-through' : ''}>{item.label}</span>
            <span className="sr-only">{item.done ? '(fait)' : '(à faire)'}</span>
          </li>
        ))}
      </ol>
      <Link
        href={etape.hrefV2}
        className={`mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] px-5 text-[15px] ${CORPS_FORT} sm:w-auto`}
        style={{ background: 'var(--v2-color-accent)', color: 'var(--v2-color-sur-accent)' }}
      >
        {BOUTON[etape.key] ?? 'Continuer la configuration'}
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </section>
  )
}
