'use client'

import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Availability, Service, ServiceCategory } from '@/types'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { Constat, Repliable, TEXTE_ROUGE } from '@/components/dashboard/PrestationsUiV2'
import { champsManquants, messageManques, DUREE_MAX_MINUTES, ERREUR_DUREE_MAX, ERREUR_SANS_TYPE } from '@/lib/prestation'
import {
  basculerType, categoriesOptionProposees, changerCategorie, changerPrixType, nomDuType, nouvelleOption, phrasesDuree,
  resumeDescription, resumeOptions, resumePrixParType, retirerOrphelins, sansCategorieDe, typesOrphelins,
  type BrouillonOption, type FormulairePrestation,
} from '@/lib/prestationForm'

// Édition d'une prestation, en feuille du bas — refonte 2026, réservée à la PWA
// installée (ouverte par PrestationsV2.tsx uniquement ; le site garde
// `admin/PrestationsManager.tsx`, inchangé). Mêmes champs, mêmes règles que ce
// formulaire (voir `lib/prestationForm.ts` : la liste des règles reprises).
//
// Ce que la feuille NE change PAS : une prestation sans type reste refusée (le
// bouton reste grisé, la route refuse aussi), la durée est plafonnée à 8 h,
// l'avertissement de durée n'est jamais bloquant, la description vide devient
// `null`.
//
// Choix de forme (validés par `designer`) : ce qu'on remplit toujours d'abord
// (nom, prix, durée, types), puis trois sections REPLIÉES avec leur résumé (prix
// par type, options, description) ; suppression en lien texte au bas du corps,
// jamais dans le pied où un doigt mouillé la toucherait à la place d'Enregistrer.

const NOUVELLE = '__nouvelle__'

type Props = {
  /** `null` : création. */
  service: Service | null
  formulaireInitial: FormulairePrestation
  categories: ServiceCategory[]
  /** Toutes les prestations : sert à proposer les catégories d'options déjà employées ailleurs. */
  services: Service[]
  availabilities: Availability[]
  /** Rend `null` si l'enregistrement a réussi (le parent ferme alors la feuille), sinon la phrase d'erreur. */
  onEnregistrer: (form: FormulairePrestation) => Promise<string | null>
  /** Ouvre la confirmation de suppression (absent à la création). */
  onSupprimer?: () => void
  onClose: () => void
}

function Titre({ children }: { children: string }) {
  return <h3 className={`text-[15px] ${corpsFort}`}>{children}</h3>
}

function Champ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={ETIQUETTE}>{label}</label>
      {children}
    </div>
  )
}

export default function FeuillePrestationV2({
  service, formulaireInitial, categories, services, availabilities, onEnregistrer, onSupprimer, onClose,
}: Props) {
  const [form, setForm] = useState(formulaireInitial)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [ouvert, setOuvert] = useState({ prix: false, options: false, description: false })
  const verrou = useRef(false)

  const sansCategorie = useMemo(() => (service ? sansCategorieDe(service, categories) : null), [service, categories])
  const categorie = categories.find(c => c.id === form.category_id)
  const typesDispos = categorie?.types ?? []
  const orphelins = typesOrphelins(form.vehicle_types, categorie)

  // Options : les catégories proposées sont figées à l'ouverture (elles ne se
  // réordonnent pas à chaque ajout) et s'allongent quand on en crée une.
  const [puces, setPuces] = useState(() =>
    categoriesOptionProposees(formulaireInitial.addons, services.filter(s => s.id !== service?.id)),
  )
  const [choixCategorie, setChoixCategorie] = useState<string>(() => puces[0])
  const [categorieSaisie, setCategorieSaisie] = useState('')
  const [brouillon, setBrouillon] = useState({ label: '', price: '', duration_minutes: '' })

  const manques = champsManquants(form)
  const phrasesManques = [
    manques.includes('duree_max') ? ERREUR_DUREE_MAX : null,
    messageManques(manques),
  ].filter((p): p is string => !!p)
  const avertissementsDuree = phrasesDuree(availabilities, form)
  const peutEnregistrer = manques.length === 0 && !enCours

  const optionPrete = nouvelleOption(
    { ...brouillon, category: choixCategorie === NOUVELLE ? categorieSaisie : choixCategorie },
    puces,
    'apercu',
  )

  function ajouterOption() {
    const opt = nouvelleOption(
      { ...brouillon, category: choixCategorie === NOUVELLE ? categorieSaisie : choixCategorie },
      puces,
      crypto.randomUUID(),
    )
    if (!opt) return
    setForm(f => ({ ...f, addons: [...f.addons, opt] }))
    if (!puces.includes(opt.category)) setPuces(p => [...p, opt.category])
    setChoixCategorie(opt.category)
    setCategorieSaisie('')
    setBrouillon({ label: '', price: '', duration_minutes: '' })
  }

  async function enregistrer() {
    if (!peutEnregistrer || verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    try {
      const message = await onEnregistrer(form)
      if (message) setErreur(message)
    } finally {
      verrou.current = false
      setEnCours(false)
    }
  }

  const basculer = (cle: 'prix' | 'options' | 'description') => setOuvert(o => ({ ...o, [cle]: !o[cle] }))
  const majBrouillon = (champ: keyof BrouillonOption, valeur: string) => setBrouillon(b => ({ ...b, [champ]: valeur }))

  const pied = (
    <div>
      {avertissementsDuree.length > 0 && (
        <div className="mb-3 space-y-1">
          <Constat ton="ambre" role="status">
            Trop long pour certains de vos jours d’ouverture. Vous pouvez enregistrer quand même.
          </Constat>
          {avertissementsDuree.map(p => (
            <p key={p} className={`pl-[15px] text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{p}</p>
          ))}
        </div>
      )}
      {erreur && (
        <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>
      )}
      {!enCours && phrasesManques.length > 0 && (
        <div className="mb-3 space-y-0.5">
          {phrasesManques.map(p => (
            <p key={p} className={`text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{p}</p>
          ))}
        </div>
      )}
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onClose}
          className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
          style={PRESSION}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={!peutEnregistrer}
          className={`${BOUTON} flex-[1.4] text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )

  return (
    <Feuille
      titre={service ? 'Modifier la prestation' : 'Nouvelle prestation'}
      onClose={onClose}
      fermerSurFond={false}
      pied={pied}
    >
      <div>
        <div className="space-y-3 pb-5">
          <Champ id="presta-nom" label="Nom de la prestation">
            <input
              id="presta-nom"
              type="text"
              autoComplete="off"
              enterKeyHint="next"
              placeholder="Lavage intérieur + extérieur"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className={CHAMP}
            />
          </Champ>
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <Champ id="presta-prix" label="Prix (€)">
                <input
                  id="presta-prix"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  placeholder="80"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  className={`${CHAMP} tabular-nums`}
                />
              </Champ>
            </div>
            <div className="min-w-0 flex-1">
              <Champ id="presta-duree" label="Durée (min)">
                <input
                  id="presta-duree"
                  type="number"
                  inputMode="numeric"
                  min="15"
                  max={DUREE_MAX_MINUTES}
                  step="15"
                  placeholder="90"
                  value={form.duration_minutes}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                  className={`${CHAMP} tabular-nums`}
                />
              </Champ>
            </div>
          </div>
          <p className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Durée par tranches de 15 minutes, 8 h au plus.
          </p>
        </div>

        <section className="space-y-3 border-t border-[color:var(--v2-filet)] py-5">
          <Titre>Pour quels types</Titre>
          {categories.length === 0 ? (
            <Constat ton="rouge">Créez d’abord une catégorie (retour à la liste, « Ajouter une catégorie »).</Constat>
          ) : (
            <Champ id="presta-categorie" label="Catégorie">
              <select
                id="presta-categorie"
                value={form.category_id}
                onChange={e => setForm(f => changerCategorie(f, e.target.value, categories, sansCategorie))}
                className={CHAMP}
              >
                {sansCategorie && <option value="">— Sans catégorie —</option>}
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Champ>
          )}

          {!categorie ? (
            form.vehicle_types.length > 0 ? (
              <p className={`text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                Cette prestation garde ses types actuels. Choisissez une catégorie pour les modifier.
              </p>
            ) : categories.length > 0 ? (
              <Constat ton="rouge">Choisissez une catégorie puis cochez au moins un type : sans type, vos clients ne peuvent pas réserver cette prestation.</Constat>
            ) : null
          ) : typesDispos.length === 0 ? (
            <Constat ton="rouge">Cette catégorie n’a aucun type : vos clients n’auraient rien à choisir. Ajoutez-en depuis « Modifier », sur le titre de la catégorie.</Constat>
          ) : (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Types proposés">
                {typesDispos.map(t => {
                  const actif = form.vehicle_types.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      data-testid="type-prestation"
                      aria-pressed={actif}
                      onClick={() => setForm(f => basculerType(f, t.id))}
                      className={puce(actif)}
                      style={PRESSION}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
              {form.vehicle_types.length === 0 && <Constat ton="rouge">{ERREUR_SANS_TYPE}</Constat>}
            </>
          )}

          {orphelins.length > 0 && (
            <div className="space-y-1">
              <Constat ton="ambre">
                {orphelins.length === 1 ? 'Un type coché n’existe plus' : `${orphelins.length} types cochés n’existent plus`} dans « {categorie?.name} » :
                vos clients {orphelins.length === 1 ? 'le' : 'les'} voient sous un nom brut.
              </Constat>
              <button
                type="button"
                onClick={() => setForm(f => retirerOrphelins(f, categorie))}
                className={`flex min-h-11 items-center pl-[15px] text-[13.5px] ${corpsFort} text-[color:var(--v2-color-encre)] underline underline-offset-4`}
              >
                {orphelins.length === 1 ? 'Le retirer' : 'Les retirer'}
              </button>
            </div>
          )}
        </section>

        <Repliable id="presta-prix-type" titre="Prix par type" resume={resumePrixParType(form)} ouvert={ouvert.prix} onBascule={() => basculer('prix')}>
          {form.vehicle_types.length === 0 ? (
            <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Cochez d’abord au moins un type.</p>
          ) : (
            <div className="space-y-2">
              <p className={`text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                Laissez vide pour appliquer le prix de base.
              </p>
              {form.vehicle_types.map(id => (
                <div key={id} className="flex items-center gap-3">
                  <label htmlFor={`prix-${id}`} className={`min-w-0 flex-1 truncate text-[14.5px] ${corps}`}>
                    {nomDuType(id, categorie)}
                  </label>
                  <input
                    id={`prix-${id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={form.vehicle_price_overrides[id] ?? ''}
                    onChange={e => setForm(f => changerPrixType(f, id, e.target.value))}
                    placeholder={form.price || 'Base'}
                    className={`${CHAMP} !w-28 shrink-0 tabular-nums`}
                  />
                  <span className={`w-3 shrink-0 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>€</span>
                </div>
              ))}
            </div>
          )}
        </Repliable>

        <Repliable id="presta-options" titre="Options et suppléments" resume={resumeOptions(form)} ouvert={ouvert.options} onBascule={() => basculer('options')}>
          <p className={`text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Proposées à votre client pendant la réservation, en plus du prix de base.
          </p>

          {form.addons.length > 0 && (
            <ul className="mt-2 divide-y divide-[color:var(--v2-filet)]">
              {form.addons.map(a => (
                <li key={a.id} className="flex items-center gap-2 py-1 pl-0">
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[14.5px] ${corpsFort}`}>{a.label}</span>
                    <span className={`block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{a.category}</span>
                  </span>
                  <span className={`shrink-0 text-right text-[13.5px] ${corps} tabular-nums`}>
                    +{a.price} €{a.duration_minutes ? <span className="text-[color:var(--v2-color-gris)]"> · +{a.duration_minutes} min</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, addons: f.addons.filter(x => x.id !== a.id) }))}
                    aria-label={`Retirer l’option ${a.label}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-gris)]"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <p className={ETIQUETTE}>Rubrique de la nouvelle option</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Rubrique de l’option">
                {puces.map(c => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={choixCategorie === c}
                    onClick={() => setChoixCategorie(c)}
                    className={puce(choixCategorie === c)}
                    style={PRESSION}
                  >
                    {c}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={choixCategorie === NOUVELLE}
                  onClick={() => setChoixCategorie(NOUVELLE)}
                  className={puce(choixCategorie === NOUVELLE)}
                  style={PRESSION}
                >
                  Nouvelle rubrique
                </button>
              </div>
              {choixCategorie === NOUVELLE && (
                <input
                  type="text"
                  autoComplete="off"
                  aria-label="Nom de la nouvelle rubrique"
                  placeholder="Ex : Extras"
                  value={categorieSaisie}
                  onChange={e => setCategorieSaisie(e.target.value)}
                  className={`${CHAMP} mt-2.5`}
                />
              )}
            </div>

            <input
              type="text"
              autoComplete="off"
              enterKeyHint="next"
              aria-label="Libellé de l’option"
              placeholder="Ex : Poils d’animaux"
              value={brouillon.label}
              onChange={e => majBrouillon('label', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterOption() } }}
              className={CHAMP}
            />
            <div className="flex items-center gap-2.5">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                aria-label="Prix de l’option en euros"
                placeholder="Prix €"
                value={brouillon.price}
                onChange={e => majBrouillon('price', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterOption() } }}
                className={`${CHAMP} !w-[5.5rem] shrink-0 tabular-nums`}
              />
              <input
                type="number"
                inputMode="numeric"
                min="5"
                step="5"
                aria-label="Durée supplémentaire de l’option en minutes"
                placeholder="+ min"
                value={brouillon.duration_minutes}
                onChange={e => majBrouillon('duration_minutes', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterOption() } }}
                className={`${CHAMP} !w-[5.5rem] shrink-0 tabular-nums`}
              />
              <button
                type="button"
                onClick={ajouterOption}
                disabled={!optionPrete}
                className={`${BOUTON} min-w-0 flex-1 border border-[color:var(--v2-color-encre)] text-[color:var(--v2-color-encre)]`}
                style={PRESSION}
              >
                Ajouter
              </button>
            </div>
          </div>
        </Repliable>

        <Repliable id="presta-description" titre="Description" resume={resumeDescription(form.description)} ouvert={ouvert.description} onBascule={() => basculer('description')}>
          <label htmlFor="presta-desc" className={ETIQUETTE}>Visible par votre client, 250 caractères au plus.</label>
          <textarea
            id="presta-desc"
            rows={3}
            placeholder="Ex : Lavage complet intérieur et extérieur, aspiration, nettoyage des vitres…"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value.slice(0, 250) }))}
            className={`${CHAMP} h-auto resize-none py-2.5 leading-[1.5]`}
          />
          <p className={`mt-1 text-right text-[12px] ${corps} text-[color:var(--v2-color-gris)] tabular-nums`}>{form.description.length}/250</p>
        </Repliable>

        {service && onSupprimer && (
          <div className="border-t border-[color:var(--v2-filet)] pt-2">
            <button
              type="button"
              onClick={onSupprimer}
              className={`flex min-h-11 items-center text-[15px] ${corpsFort}`}
              style={{ color: TEXTE_ROUGE }}
            >
              Supprimer cette prestation
            </button>
          </div>
        )}
      </div>
    </Feuille>
  )
}
