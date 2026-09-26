'use client'

import { useState } from 'react'
import { Feuille, BOUTON, CHAMP, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Bloc, Erreur, Pied, Puces } from '@/components/dashboard/ReglageAutomatismeV2'
import { Interrupteur } from '@/components/dashboard/PrestationsUiV2'
import {
  exempleRemise, formulaireDepuisReglages, lireProximite, phraseProche, validerCreneaux,
  PROXIMITES, PROXIMITE_MAX, PROXIMITE_MIN, REMISES_EUROS, REMISES_POURCENT,
  type ChampCreneaux, type ChampsCreneaux, type FormulaireCreneaux, type PrestationExemple,
  type ReglagesCreneaux, type TypeRemise,
} from '@/lib/creneauxForm'

// « Créneaux intelligents » — feuille du bas de l'écran « Prestations et prix »
// (refonte 2026, PWA installée seulement). Reprend la carte `#creneaux` de
// l'ancien onglet Identité (`admin/IdentiteForm.tsx`, inchangé) : mêmes quatre
// colonnes, même route, un seul `PATCH /api/washer`.
//
// La définition exacte de « proche » et les garde-fous de valeur sont dans
// `lib/creneauxForm.ts` (testée) — relus dans `api/slots/smart/route.ts`, pas
// devinés. L'exemple chiffré passe par `smartPrice` (`lib/pricing.ts`), la même
// fonction que la page de réservation : aucune nouvelle route, aucun calcul dupliqué.

type Props = {
  reglages: ReglagesCreneaux
  /** Prestations du laveur, pour l'exemple chiffré et le plafond de la remise en
   *  euros. Déjà lues par la page : rien n'est demandé au serveur ici. */
  prestation: PrestationExemple | null
  prixLePlusBas: number | null
  /** `null` si enregistré (la feuille se ferme), sinon la phrase d'échec. */
  onEnregistrer: (champs: ChampsCreneaux) => Promise<string | null>
  onClose: () => void
}

export default function FeuilleCreneauxV2({ reglages, prestation, prixLePlusBas, onEnregistrer, onClose }: Props) {
  const [f, setF] = useState<FormulaireCreneaux>(() => formulaireDepuisReglages(reglages))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [champFautif, setChampFautif] = useState<{ champ: ChampCreneaux; message: string } | null>(null)

  const modifier = (p: Partial<FormulaireCreneaux>) => { setChampFautif(null); setF(v => ({ ...v, ...p })) }
  const erreurDe = (champ: ChampCreneaux) => (champFautif?.champ === champ ? champFautif.message : null)

  const proximiteEnPuce = (PROXIMITES as readonly number[]).includes(Number(f.proximite))
  const [proximiteLibre, setProximiteLibre] = useState(() => !proximiteEnPuce)
  const choixProximite: number | 'autre' = proximiteLibre || !proximiteEnPuce ? 'autre' : Number(f.proximite)

  const presetsRemise = f.type === 'percent' ? REMISES_POURCENT : REMISES_EUROS
  const remiseEnPuce = (presetsRemise as readonly number[]).includes(Number(f.valeur.replace(',', '.')))
  const [remiseLibre, setRemiseLibre] = useState(() => !remiseEnPuce)
  const choixRemise: number | 'autre' = remiseLibre || !remiseEnPuce ? 'autre' : Number(f.valeur)

  const exemple = exempleRemise(prestation, f.type, f.valeur)
  // Une saisie hors bornes ne doit pas produire une phrase qui décrit un réglage
  // que le serveur n'accepterait pas (« à moins de 90 min »).
  const minutes = lireProximite(f.proximite)

  function changerType(type: TypeRemise) {
    // La valeur ne se convertit pas : 5 € ne veut pas dire 5 %. On repart sur la
    // première puce du nouveau mode, sans rien enregistrer.
    const defaut = type === 'percent' ? REMISES_POURCENT[0] : REMISES_EUROS[0]
    setRemiseLibre(false)
    modifier({ type, valeur: String(defaut) })
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setChampFautif(null)
    const r = validerCreneaux(f, prixLePlusBas)
    if (!r.ok) { setChampFautif({ champ: r.champ, message: r.message }); return }
    setEnCours(true)
    const message = await onEnregistrer(r.champs)
    setEnCours(false)
    if (message) setErreur(message)
  }

  return (
    <Feuille
      titre="Créneaux intelligents"
      sousTitre="Une remise sur les créneaux proches d’un rendez-vous déjà pris, pour regrouper vos trajets."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="feuille-creneaux" />}
    >
      <form id="feuille-creneaux" onSubmit={valider} noValidate>
        <div className="mb-5 flex items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`text-[15.5px] ${corpsFort}`}>Proposer une remise</span>
            {!f.actif && (
              <span className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                Vos créneaux sont tous au même prix
              </span>
            )}
          </span>
          <Interrupteur
            actif={f.actif}
            enCours={false}
            libelle="Proposer une remise"
            onClick={() => modifier({ actif: !f.actif })}
          />
        </div>

        {f.actif && (
          <>
            <Bloc titre="Un client proche, c’est à combien de temps ?">
              <Puces
                nom="Temps de voiture"
                valeurs={PROXIMITES}
                libelle={v => `${v} min`}
                valeur={choixProximite}
                autre
                onChoisir={v => {
                  if (v === 'autre') { setProximiteLibre(true); setChampFautif(null); return }
                  setProximiteLibre(false)
                  modifier({ proximite: String(v) })
                }}
              />
              {choixProximite === 'autre' && (
                <div className="mt-3 flex items-center gap-2.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={PROXIMITE_MIN}
                    max={PROXIMITE_MAX}
                    value={f.proximite}
                    onChange={e => modifier({ proximite: e.target.value })}
                    aria-label="Temps de voiture en minutes"
                    aria-invalid={!!erreurDe('proximite')}
                    className={`${CHAMP} !w-24`}
                  />
                  <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>min</span>
                </div>
              )}
              {erreurDe('proximite') && (
                <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>
                  {erreurDe('proximite')}
                </p>
              )}
              {minutes !== null && (
                <p className={`mt-2 text-[12.5px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`}>
                  {phraseProche(minutes)}
                </p>
              )}
            </Bloc>

            <Bloc titre="Remise">
              <div className="flex gap-2.5" role="group" aria-label="Forme de la remise">
                {([['fixed', 'En euros'], ['percent', 'En pourcentage']] as const).map(([id, label]) => {
                  const actif = f.type === id
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => changerType(id)}
                      className={`${BOUTON} flex-1 border ${
                        actif
                          ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border-[color:var(--v2-color-encre)]'
                          : 'bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-gris)] border-[color:var(--v2-filet-fort)]'
                      }`}
                      style={PRESSION}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3">
                <Puces
                  nom="Montant de la remise"
                  valeurs={presetsRemise}
                  libelle={v => (f.type === 'percent' ? `${v} %` : `${v} €`)}
                  valeur={choixRemise}
                  autre
                  onChoisir={v => {
                    if (v === 'autre') { setRemiseLibre(true); setChampFautif(null); return }
                    setRemiseLibre(false)
                    modifier({ valeur: String(v) })
                  }}
                />
              </div>
              {choixRemise === 'autre' && (
                <div className="mt-3 flex items-center gap-2.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={f.valeur}
                    onChange={e => modifier({ valeur: e.target.value })}
                    aria-label={f.type === 'percent' ? 'Remise en pourcentage' : 'Remise en euros'}
                    aria-invalid={!!erreurDe('valeur')}
                    className={`${CHAMP} !w-24`}
                  />
                  <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>
                    {f.type === 'percent' ? '%' : '€'}
                  </span>
                </div>
              )}
              {erreurDe('valeur') && (
                <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>
                  {erreurDe('valeur')}
                </p>
              )}
              {exemple && (
                <p className={`mt-2 text-[12.5px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`} aria-live="polite">
                  {exemple}
                </p>
              )}
            </Bloc>
          </>
        )}

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}
