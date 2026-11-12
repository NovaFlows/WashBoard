'use client'

import { useState } from 'react'
import { Feuille, BOUTON, CHAMP, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import AdresseV2 from '@/components/dashboard/AdresseV2'
import { CHOIX_LIEUX, MAX_CENTRES, ReglagesCentreAutoSchema, centresDeReglages, normaliserReglages, type LieuxProposes, type ReglagesCentreAuto } from '@/lib/centreAuto'

// « Centre auto » de « Mon profil » : le laveur qui a un local choisit ce que sa page de
// réservation propose (à domicile, en centre auto, ou les deux). Enregistré par
// PUT /api/washer/centre-auto.

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
  // Un ou plusieurs locaux ; `cle` ne sert qu'à garder les champs en place quand on en retire un.
  const [centres, setCentres] = useState<{ cle: number; id?: string; nom: string; adresse: string }[]>(() => {
    const liste = reglages ? centresDeReglages(reglages) : []
    return (liste.length > 0 ? liste : [{ nom: '', adresse: '' }]).map((c, i) => ({ cle: i, ...c }))
  })
  const [prochaineCle, setProchaineCle] = useState(centres.length)
  const [lieux, setLieux] = useState<LieuxProposes>(reglages?.lieux ?? 'les_deux')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const saisis = centres.map(c => ({ id: c.id, nom: c.nom, adresse: c.adresse }))
    const saisie = ReglagesCentreAutoSchema.safeParse({ actif, adresse: saisis[0]?.adresse ?? '', lieux, centres: saisis })
    if (!saisie.success) { setErreur(saisie.error.issues[0]?.message ?? 'Réglages invalides.'); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer(normaliserReglages(saisie.data))
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
            <Bloc titre={centres.length > 1 ? 'Vos centres' : 'Adresse du centre'}>
              <div className="flex flex-col gap-4">
                {centres.map((c, i) => (
                  <div key={c.cle} className="flex flex-col gap-2">
                    {centres.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className={`text-[13px] ${corpsFort}`}>Centre {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => { setCentres(l => l.filter(x => x.cle !== c.cle)); setErreur(null) }}
                          className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)] underline`}
                        >
                          Retirer
                        </button>
                      </div>
                    )}
                    {centres.length > 1 && (
                      <input
                        type="text"
                        aria-label={`Nom du centre ${i + 1}`}
                        placeholder="Nom (ex. Centre Lyon Nord)"
                        maxLength={80}
                        value={c.nom}
                        onChange={e => { const v = e.target.value; setCentres(l => l.map(x => (x.cle === c.cle ? { ...x, nom: v } : x))); setErreur(null) }}
                        className={CHAMP}
                      />
                    )}
                    <AdresseV2
                      id={i === 0 ? 'centre-auto-adresse' : `centre-auto-adresse-${c.cle}`}
                      valeur={c.adresse}
                      onChange={v => { setCentres(l => l.map(x => (x.cle === c.cle ? { ...x, adresse: v } : x))); setErreur(null) }}
                      placeholder="12 rue de la Paix, 75001 Paris"
                      adresseDeBase={i === 0 ? adresseDeBase : undefined}
                      erreur={null}
                    />
                  </div>
                ))}
              </div>
              <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                {centres.length > 1 ? 'Le client choisit son centre au moment de réserver.' : 'Affichée à vos clients qui choisissent de venir au centre.'}
              </p>
              {centres.length < MAX_CENTRES && (
                <button
                  type="button"
                  onClick={() => { setCentres(l => [...l, { cle: prochaineCle, nom: '', adresse: '' }]); setProchaineCle(k => k + 1); setErreur(null) }}
                  className={`${BOUTON} mt-3 w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
                  style={PRESSION}
                >
                  + Ajouter un autre centre
                </button>
              )}
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
