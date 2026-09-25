'use client'

import { useState } from 'react'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { normaliserSlug } from '@/lib/lienReservation'

// Changer son lien de réservation — feuille du bas de « Mes liens » (PWA). Même
// réglage que l'ancien écran (`ParametresFormV1`), mêmes règles, même route : voir
// `lib/lienReservation.ts`.
//
// Ce lien est déjà en circulation (bio Instagram, cartes de visite, QR codes
// imprimés) et rien ne redirige l'ancien vers le nouveau : le changer est une rupture,
// pas un réglage de plus. Le champ ne l'enregistre donc jamais d'un coup : un premier
// « Continuer » mène à une confirmation qui dit ce que ça implique (voir l'écran).

type Props = {
  /** Lien enregistré (la partie après `/book/`). */
  slug: string
  /** Préfixe affiché avant le champ, ex. « washboard.fr/book/ ». */
  prefixe: string
  /** Le lien à enregistrer est valide et différent de l'actuel : l'écran demande confirmation. */
  onContinuer: (nouveau: string) => void
  onClose: () => void
}

export default function FeuilleLienV2({ slug, prefixe, onContinuer, onClose }: Props) {
  const [saisie, setSaisie] = useState(slug)
  const [erreur, setErreur] = useState<string | null>(null)

  function valider(e: React.FormEvent) {
    e.preventDefault()
    const r = normaliserSlug(saisie)
    if (!r.ok) { setErreur(r.message); return }
    if (r.valeur === slug) { onClose(); return }
    onContinuer(r.valeur)
  }

  return (
    <Feuille
      titre="Changer mon lien"
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={false} libelle="Continuer" onClose={onClose} formulaire="lien-reservation" />}
    >
      <form id="lien-reservation" onSubmit={valider} noValidate>
        <Bloc titre="Fin de votre lien">
          <div className="flex items-center gap-1.5">
            <span className={`shrink-0 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{prefixe}</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={saisie}
              onChange={e => { setSaisie(e.target.value); setErreur(null) }}
              aria-label="Fin de votre lien de réservation"
              aria-invalid={!!erreur}
              aria-describedby="lien-reservation-aide"
              className={CHAMP}
            />
          </div>
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <p id="lien-reservation-aide" className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Lettres minuscules, chiffres et tirets, de 3 à 40 caractères.
          </p>
        </Bloc>
      </form>
    </Feuille>
  )
}
