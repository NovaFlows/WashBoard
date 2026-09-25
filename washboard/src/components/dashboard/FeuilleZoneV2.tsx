'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { ZoneConfig } from '@/types'
import { Feuille, CHAMP, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Bloc, Erreur, Pied, Puces } from '@/components/dashboard/ReglageAutomatismeV2'
import { Constat, Interrupteur, Repliable } from '@/components/dashboard/PrestationsUiV2'
import AdresseV2 from '@/components/dashboard/AdresseV2'
import { DEPARTMENTS } from '@/lib/france-departments'
import {
  chercherDepartements, formulaireDepuisZone, nomDepartement, phraseRayon, routePlusLongue, validerZone,
  RAYONS_PRESETS, RAYON_MAX, RAYON_MIN, type ChampZone, type FormulaireZone, type ModeZone,
} from '@/lib/zoneForm'

// « Où vous intervenez » — feuille du bas de l'écran « Prestations et prix »
// (refonte 2026, PWA installée seulement). Reprend les deux réglages de la carte
// `#zone` de l'ancien onglet Identité (`admin/IdentiteForm.tsx`, inchangé) :
// mêmes modes, même champ `zone_config`, même route.
//
// Toute la règle est dans `lib/zoneForm.ts` (testée). Ici, la présentation :
// des mots de laveur plutôt que « vol d'oiseau » et « distance routière », des
// puces de rayon plutôt qu'un curseur (impossible à viser les mains mouillées),
// et une liste de départements qui ne s'ouvre pas sur ses 101 lignes.

const MODES: { id: ModeZone; label: string; aide: string }[] = [
  { id: 'crow', label: 'En ligne droite', aide: 'Un cercle autour de chez vous' },
  { id: 'road', label: 'Selon les routes', aide: 'Les kilomètres réellement roulés' },
  { id: 'departments', label: 'Par départements', aide: 'Vous choisissez les numéros' },
]

/** Combien de pastilles avant le « +N ». */
const PASTILLES_VISIBLES = 6

type Props = {
  zone: ZoneConfig
  /** `washers.base_address` — proposée d'un tap, jamais fusionnée avec
   *  `zone_config.center_address` : ce sont deux adresses distinctes. */
  adresseDeBase: string | null
  /** `null` si enregistré (la feuille se ferme), sinon la phrase d'échec. */
  onEnregistrer: (config: ZoneConfig) => Promise<string | null>
  onClose: () => void
}

function LigneRadio({
  actif, label, aide, onClick,
}: { actif: boolean; label: string; aide: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={actif}
      onClick={onClick}
      className="flex min-h-12 w-full items-center gap-3 py-2.5 text-left"
    >
      <span
        aria-hidden
        className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: actif ? 'var(--v2-color-encre)' : 'var(--v2-filet-fort)' }}
      >
        {actif && <span className="h-[10px] w-[10px] rounded-full" style={{ background: 'var(--v2-color-encre)' }} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[15px] ${corpsFort}`}>{label}</span>
        <span className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{aide}</span>
      </span>
    </button>
  )
}

function Departements({
  choisis, onBasculer, erreur,
}: { choisis: string[]; onBasculer: (code: string) => void; erreur: string | null }) {
  const [recherche, setRecherche] = useState('')
  const [toutesPastilles, setToutesPastilles] = useState(false)
  const [listeOuverte, setListeOuverte] = useState(false)

  const resultats = useMemo(() => chercherDepartements(recherche), [recherche])
  const cherche = recherche.trim().length > 0
  const visibles = toutesPastilles ? choisis : choisis.slice(0, PASTILLES_VISIBLES)
  const reste = choisis.length - visibles.length

  const liste = (
    <ul className="divide-y divide-[color:var(--v2-filet)]">
      {resultats.map(d => {
        const actif = choisis.includes(d.code)
        return (
          <li key={d.code}>
            <button
              type="button"
              role="checkbox"
              aria-checked={actif}
              onClick={() => onBasculer(d.code)}
              className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
            >
              <span className={`w-9 shrink-0 text-[13px] tabular-nums ${corps} text-[color:var(--v2-color-gris)]`}>{d.code}</span>
              <span className={`min-w-0 flex-1 truncate text-[15px] ${actif ? corpsFort : corps}`}>{d.name}</span>
              <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                {actif && <Check size={17} strokeWidth={2.4} style={{ color: 'var(--v2-color-accent)' }} />}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div>
      {choisis.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {visibles.map(code => (
            <button
              key={code}
              type="button"
              onClick={() => onBasculer(code)}
              aria-label={`Retirer ${nomDepartement(code)}`}
              className={`inline-flex h-11 max-w-full items-center gap-2 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] pl-4 pr-3 text-[13.5px] ${corpsFort} transition-transform active:scale-[.97] motion-reduce:transition-none`}
              style={PRESSION}
            >
              <span className="truncate">{nomDepartement(code)}</span>
              <X size={15} strokeWidth={2.2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
            </button>
          ))}
          {reste > 0 && (
            <button
              type="button"
              onClick={() => setToutesPastilles(true)}
              className={`inline-flex h-11 items-center rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] px-4 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
              style={PRESSION}
            >
              +{reste}
            </button>
          )}
        </div>
      )}

      <input
        type="search"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder="Chercher un département"
        aria-label="Chercher un département"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className={CHAMP}
      />

      {cherche ? (
        <div className="mt-2">
          {resultats.length === 0 ? (
            <p className={`py-3 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Aucun département ne correspond à « {recherche.trim()} ».
            </p>
          ) : liste}
        </div>
      ) : (
        <div className="mt-3">
          <Repliable
            id="zone-tous-departements"
            titre={`Voir les ${DEPARTMENTS.length}`}
            resume=""
            ouvert={listeOuverte}
            onBascule={() => setListeOuverte(v => !v)}
          >
            {liste}
          </Repliable>
        </div>
      )}

      {erreur && (
        <p role="alert" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>
      )}
    </div>
  )
}

export default function FeuilleZoneV2({ zone, adresseDeBase, onEnregistrer, onClose }: Props) {
  const [f, setF] = useState<FormulaireZone>(() => formulaireDepuisZone(zone))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [champFautif, setChampFautif] = useState<{ champ: ChampZone; message: string } | null>(null)

  const modifier = (p: Partial<FormulaireZone>) => setF(v => ({ ...v, ...p }))
  const erreurDe = (champ: ChampZone) => (champFautif?.champ === champ ? champFautif.message : null)

  const parRayon = f.mode === 'crow' || f.mode === 'road'
  const rayonEnPuce = (RAYONS_PRESETS as readonly number[]).includes(Number(f.rayon))
  const [rayonLibre, setRayonLibre] = useState(() => !rayonEnPuce)
  const choixRayon: number | 'autre' = rayonLibre || !rayonEnPuce ? 'autre' : Number(f.rayon)

  const basculerDepartement = (code: string) =>
    setF(v => ({
      ...v,
      departements: v.departements.includes(code)
        ? v.departements.filter(c => c !== code)
        : [...v.departements, code],
    }))

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setChampFautif(null)
    const r = validerZone(f)
    if (!r.ok) { setChampFautif({ champ: r.champ, message: r.message }); return }
    setEnCours(true)
    const message = await onEnregistrer(r.config)
    setEnCours(false)
    if (message) setErreur(message)
  }

  const phrase = phraseRayon(f.mode, f.rayon, f.adresse)

  return (
    <Feuille
      titre="Où vous intervenez"
      sousTitre="Un client hors zone ne peut pas réserver."
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="feuille-zone" />}
    >
      <form id="feuille-zone" onSubmit={valider} noValidate>
        <div className="mb-5 flex items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`text-[15.5px] ${corpsFort}`}>Limiter à une zone</span>
            {!f.limiter && (
              <span className={`text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                Vos clients peuvent réserver de partout
              </span>
            )}
          </span>
          <Interrupteur
            actif={f.limiter}
            enCours={false}
            libelle="Limiter à une zone"
            onClick={() => modifier({ limiter: !f.limiter })}
          />
        </div>

        {!f.limiter ? (
          zone?.enabled && (
            <div className="mb-2">
              <Constat ton="ambre" role="status">
                En enregistrant, votre zone actuelle est effacée : l’adresse, le rayon et les départements devront être
                ressaisis pour la remettre.
              </Constat>
            </div>
          )
        ) : (
          <>
            <Bloc titre="Comment mesurer">
              <div
                role="radiogroup"
                aria-label="Comment mesurer"
                className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 divide-y divide-[color:var(--v2-filet)]"
              >
                {MODES.map(m => (
                  <LigneRadio
                    key={m.id}
                    actif={f.mode === m.id}
                    label={m.label}
                    aide={m.aide}
                    onClick={() => { setChampFautif(null); modifier({ mode: m.id }) }}
                  />
                ))}
              </div>
            </Bloc>

            {parRayon ? (
              <>
                <Bloc titre="Point de départ">
                  <AdresseV2
                    id="zone-adresse"
                    valeur={f.adresse}
                    onChange={adresse => modifier({ adresse })}
                    placeholder="12 rue de la Paix, 75002 Paris"
                    adresseDeBase={adresseDeBase}
                    erreur={erreurDe('adresse')}
                  />
                </Bloc>

                <Bloc titre="Rayon">
                  <Puces
                    nom="Rayon en kilomètres"
                    valeurs={RAYONS_PRESETS}
                    libelle={v => `${v} km`}
                    valeur={choixRayon}
                    autre
                    onChoisir={v => {
                      setChampFautif(null)
                      if (v === 'autre') { setRayonLibre(true); return }
                      setRayonLibre(false)
                      modifier({ rayon: String(v) })
                    }}
                  />
                  {choixRayon === 'autre' && (
                    <div className="mt-3 flex items-center gap-2.5">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={RAYON_MIN}
                        max={RAYON_MAX}
                        value={f.rayon}
                        onChange={e => modifier({ rayon: e.target.value })}
                        aria-label="Rayon en kilomètres"
                        aria-invalid={!!erreurDe('rayon')}
                        className={`${CHAMP} !w-24`}
                      />
                      <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>km</span>
                    </div>
                  )}
                  {erreurDe('rayon') && (
                    <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>
                      {erreurDe('rayon')}
                    </p>
                  )}
                  {phrase && (
                    <p className={`mt-2 text-[12.5px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`}>
                      {phrase}
                      {routePlusLongue(f.mode) && ' Sur la route, c’est souvent plus long.'}
                    </p>
                  )}
                </Bloc>
              </>
            ) : (
              <Bloc titre="Départements couverts" aide={f.departements.length > 0 ? String(f.departements.length) : undefined}>
                <Departements
                  choisis={f.departements}
                  onBasculer={code => { setChampFautif(null); basculerDepartement(code) }}
                  erreur={erreurDe('departements')}
                />
              </Bloc>
            )}
          </>
        )}

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}
