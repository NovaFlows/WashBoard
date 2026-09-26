'use client'

import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { CategoryType, Service, ServiceCategory } from '@/types'
import { PRESETS } from '@/components/dashboard/admin/CategoriesManager'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { Constat, TEXTE_ROUGE } from '@/components/dashboard/PrestationsUiV2'
import { prestationsUtilisantTypes, typesDepuisModele, type ModeleCategorie } from '@/lib/prestationForm'

// Création / modification d'une catégorie (Voiture, Canapé…) et de ses types,
// en feuille du bas — refonte 2026, réservée à la PWA installée (ouverte par
// PrestationsV2.tsx uniquement ; le site garde `admin/CategoriesManager.tsx`,
// inchangé). Mêmes fonctions que ce composant : nom, types en liste renommable,
// ajout et retrait d'un type, modèles « Voiture » et « Canapé » (les MÊMES
// `PRESETS`, importés — leurs identifiants fixes ne se redéfinissent pas ici).
//
// Retirer un type que des prestations proposent encore le laisse dans ces
// prestations, sous son identifiant brut côté client (le tunnel ne retrouve plus
// son nom) : la feuille le dit avant d'enregistrer, sans l'interdire.

type Props = {
  /** `null` : création. */
  categorie: ServiceCategory | null
  services: Service[]
  /** Rend `null` si l'enregistrement a réussi (le parent ferme alors la feuille), sinon la phrase d'erreur. */
  onEnregistrer: (nom: string, types: CategoryType[]) => Promise<string | null>
  /** Ouvre la confirmation de suppression (absent à la création). */
  onSupprimer?: () => void
  onClose: () => void
}

export default function FeuilleCategorieV2({ categorie, services, onEnregistrer, onSupprimer, onClose }: Props) {
  const [nomCategorie, setNomCategorie] = useState(categorie?.name ?? '')
  const [types, setTypes] = useState<CategoryType[]>(() => (categorie?.types ?? []).map(t => ({ ...t })))
  const [nouveauType, setNouveauType] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const verrou = useRef(false)

  function ajouterType() {
    const nomType = nouveauType.trim()
    if (!nomType) return
    setTypes(t => [...t, { id: crypto.randomUUID(), name: nomType }])
    setNouveauType('')
  }

  function appliquerModele(modele: ModeleCategorie) {
    setTypes(typesDepuisModele(modele))
    setNomCategorie(n => n.trim() || modele.name)
  }

  // Types que l'enregistrement retirerait (retirés à la main, ou vidés de leur
  // nom : la route écarte les types sans nom) et qui sont encore proposés.
  const gardes = new Set(types.filter(t => t.name.trim()).map(t => t.id))
  const retires = categorie ? categorie.types.filter(t => !gardes.has(t.id)) : []
  const concernees = categorie ? prestationsUtilisantTypes(services, categorie.id, retires.map(t => t.id)) : []
  const utilises = retires.filter(t => concernees.some(s => s.vehicle_types.includes(t.id)))

  const peutEnregistrer = !!nomCategorie.trim() && !enCours

  async function enregistrer() {
    if (!peutEnregistrer || verrou.current) return
    verrou.current = true
    setEnCours(true)
    setErreur(null)
    try {
      const message = await onEnregistrer(nomCategorie, types)
      if (message) setErreur(message)
    } finally {
      verrou.current = false
      setEnCours(false)
    }
  }

  const pied = (
    <div>
      {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
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
      titre={categorie ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
      onClose={onClose}
      fermerSurFond={false}
      pied={pied}
    >
      <div>
        <div className="pb-5">
          <label htmlFor="cat-nom" className={ETIQUETTE}>Nom de la catégorie</label>
          <input
            id="cat-nom"
            type="text"
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Voiture, Canapé, Maison…"
            value={nomCategorie}
            onChange={e => setNomCategorie(e.target.value)}
            className={CHAMP}
          />
        </div>

        {types.length === 0 && (
          <section className="border-t border-[color:var(--v2-filet)] py-5">
            <p className={ETIQUETTE}>Partir d’un modèle (facultatif)</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Modèles de catégorie">
              {PRESETS.map(p => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => appliquerModele(p)}
                  className={puce(false)}
                  style={PRESSION}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="border-t border-[color:var(--v2-filet)] py-5">
          <h3 className={`text-[15px] ${corpsFort}`}>Types</h3>
          <p className={`mt-1 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Ce que vos clients choisissent : Citadine, SUV… ou 2 places, angle…
          </p>

          {types.length > 0 && (
            <ul className="mt-3 space-y-2">
              {types.map(t => (
                <li key={t.id} className="flex items-center gap-1">
                  <input
                    type="text"
                    autoComplete="off"
                    aria-label={`Nom du type ${t.name}`}
                    value={t.name}
                    onChange={e => setTypes(ts => ts.map(x => (x.id === t.id ? { ...x, name: e.target.value } : x)))}
                    className={CHAMP}
                  />
                  <button
                    type="button"
                    onClick={() => setTypes(ts => ts.filter(x => x.id !== t.id))}
                    aria-label={`Retirer le type ${t.name}`}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-gris)]"
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex items-center gap-2.5">
            <input
              type="text"
              autoComplete="off"
              enterKeyHint="done"
              aria-label="Nouveau type"
              placeholder="Ajouter un type…"
              value={nouveauType}
              onChange={e => setNouveauType(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); ajouterType() } }}
              className={CHAMP}
            />
            <button
              type="button"
              onClick={ajouterType}
              disabled={!nouveauType.trim()}
              className={`${BOUTON} shrink-0 border border-[color:var(--v2-color-encre)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              Ajouter
            </button>
          </div>

          {concernees.length > 0 && (
            <div className="mt-4">
              <Constat ton="ambre" role="status">
                Vous retirez {utilises.length > 1 ? 'des types encore proposés' : 'un type encore proposé'}
                {' '}dans {concernees.length} prestation{concernees.length > 1 ? 's' : ''}
                {' '}({concernees.slice(0, 2).map(s => s.name).join(', ')}{concernees.length > 2 ? '…' : ''}).
                Ouvrez-{concernees.length > 1 ? 'les' : 'la'} ensuite pour {utilises.length > 1 ? 'les' : 'le'} retirer,
                sinon vos clients {utilises.length > 1 ? 'les verront' : 'le verront'} sous un nom brut.
              </Constat>
            </div>
          )}
        </section>

        {categorie && onSupprimer && (
          <div className="border-t border-[color:var(--v2-filet)] pt-2">
            <button
              type="button"
              onClick={onSupprimer}
              className={`flex min-h-11 items-center text-[15px] ${corpsFort}`}
              style={{ color: TEXTE_ROUGE }}
            >
              Supprimer cette catégorie
            </button>
          </div>
        )}
      </div>
    </Feuille>
  )
}
