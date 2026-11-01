'use client'

import { useState } from 'react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import AdresseV2 from '@/components/dashboard/AdresseV2'
import { ReglagesCentreAutoSchema, type LieuxProposes, type ReglagesCentreAuto } from '@/lib/centreAuto'

// « Centre auto » de « Mon profil » : le laveur qui a un local choisit ce que sa page de
// réservation propose (à domicile, en centre auto, ou les deux). Enregistré par
// PUT /api/washer/centre-auto.

const CHOIX_LIEUX: { valeur: LieuxProposes; libelle: string; detail: string }[] = [
  { valeur: 'les_deux', libelle: 'Les deux', detail: 'Le client choisit. « À domicile » est coché par défaut.' },
  { valeur: 'domicile', libelle: 'À domicile seulement', detail: 'Votre page reste comme aujourd’hui.' },
  { valeur: 'centre', libelle: 'En centre auto seulement', detail: 'Le client vient à votre centre. Pas de frais de déplacement.' },
]

export default function FeuilleCentreAutoV2({
  reglages, adresseDeBase, onEnregistrer, onClose,
}: {
  reglages: ReglagesCentreAuto | null
  /** Adresse de départ, proposée d'un tap : souvent la même que celle du centre. */
  adresseDeBase?: string | null
  onEnregistrer: (r: ReglagesCentreAuto) => Promise<string | null>
  onClose: () => void
}) {
  const [actif, setActif] = useState(reglages?.actif ?? false)
  const [adresse, setAdresse] = useState(reglages?.adresse ?? '')
  const [lieux, setLieux] = useState<LieuxProposes>(reglages?.lieux ?? 'les_deux')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const saisie = ReglagesCentreAutoSchema.safeParse({ actif, adresse, lieux })
    if (!saisie.success) { setErreur(saisie.error.issues[0]?.message ?? 'Réglages invalides.'); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer(saisie.data)
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  return (
    <Feuille
      titre="Centre auto"
      sousTitre="Recevoir vos clients dans votre local."
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="reglage-centre-auto" />
        </div>
      }
    >
      <form id="reglage-centre-auto" onSubmit={soumettre} noValidate>
        <Bloc titre="Avez-vous un centre auto ?">
          <div className="flex gap-2.5" role="group" aria-label="Avez-vous un centre auto ?">
            {([true, false] as const).map(v => {
              const choisi = actif === v
              return (
                <button
                  key={String(v)}
                  type="button"
                  aria-pressed={choisi}
                  onClick={() => { setActif(v); setErreur(null) }}
                  className={`${BOUTON} flex-1 border ${
                    choisi
                      ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border-[color:var(--v2-color-encre)]'
                      : 'bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-gris)] border-[color:var(--v2-filet-fort)]'
                  }`}
                  style={PRESSION}
                >
                  {v ? 'Oui' : 'Non'}
                </button>
              )
            })}
          </div>
          {!actif && (
            <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Vous vous déplacez chez vos clients, votre page reste comme aujourd’hui.
            </p>
          )}
        </Bloc>

        {actif && (
          <>
            <Bloc titre="Adresse du centre">
              <AdresseV2
                id="centre-auto-adresse"
                valeur={adresse}
                onChange={v => { setAdresse(v); setErreur(null) }}
                placeholder="12 rue de la Paix, 75001 Paris"
                adresseDeBase={adresseDeBase}
                erreur={null}
              />
              <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                Affichée à vos clients qui choisissent de venir au centre.
              </p>
            </Bloc>

            <Bloc titre="Sur votre page de réservation">
              <div className="flex flex-col gap-2" role="group" aria-label="Lieux proposés">
                {CHOIX_LIEUX.map(c => {
                  const choisi = lieux === c.valeur
                  return (
                    <button
                      key={c.valeur} type="button" aria-pressed={choisi} onClick={() => setLieux(c.valeur)}
                      className="flex items-start gap-3 rounded-[var(--v2-radius-surface)] border px-4 py-3 text-left transition-colors motion-reduce:transition-none"
                      style={{
                        borderColor: choisi ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)',
                        background: choisi ? 'color-mix(in srgb, var(--v2-color-accent) 8%, transparent)' : 'transparent',
                        ...PRESSION,
                      }}
                    >
                      <span
                        aria-hidden
                        className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2"
                        style={{ borderColor: choisi ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)' }}
                      >
                        {choisi && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--v2-color-accent)' }} />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[15px] ${corpsFort}`}>{c.libelle}</span>
                        <span className={`mt-0.5 block text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{c.detail}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </Bloc>
          </>
        )}
      </form>
    </Feuille>
  )
}
