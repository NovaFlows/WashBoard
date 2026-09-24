'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Availability, Service, ServiceCategory } from '@/types'
import { usePrestationsV2 } from '@/hooks/usePrestationsV2'
import { BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe, Chevron, Ligne } from '@/components/dashboard/ParametresFormV2'
import FeuillePrestationV2 from '@/components/dashboard/FeuillePrestationV2'
import FeuilleCategorieV2 from '@/components/dashboard/FeuilleCategorieV2'
import PrestationsEtatVideV2 from '@/components/dashboard/PrestationsEtatVideV2'
import { ConfirmationSuppression, Constat, nom } from '@/components/dashboard/PrestationsUiV2'
import { estReservable } from '@/lib/prestation'
import {
  detailPrestation, formulaireDepuisService, formulaireNeuf, prixListe, sousTitrePrestations, typesDepuisModele,
  type FormulairePrestation, type ModeleCategorie,
} from '@/lib/prestationForm'
import { formatDureeFr } from '@/lib/pricing'

// « Prestations et prix » — refonte 2026, destination NEUVE de « Plus » (la
// maquette n'a aucun écran pour gérer les prestations ; Alexandre, 2026-09-24 :
// « avec le même design que les autres pages et les mêmes fonctionnalités
// qu'avant la refonte »). Réservé à la PWA installée (voir Prestations.tsx, le
// garde-fou : le site est renvoyé vers `/dashboard/admin#prestations`, l'écran
// v1 `PrestationsManager`, inchangé).
//
// Ce que l'écran configure, c'est ce que le client final voit sur la page de
// réservation (`StepService`, `StepOptions`) : le chemin qui rapporte l'argent.
// Toute la logique de saisie vient de `lib/prestationForm.ts` (testée), les
// appels de `lib/prestationsApi.ts`, l'état de `usePrestationsV2` — cet écran et
// ses feuilles ne contiennent que de la présentation et du câblage.
//
// Toute la ligne d'une prestation ouvre son édition : pas de boutons Modifier /
// Supprimer en série. La suppression se fait depuis la feuille d'édition, avec
// une confirmation (plus de `confirm()` natif).

type FeuilleOuverte =
  | { quoi: 'prestation'; service: Service | null; formulaire: FormulairePrestation }
  | { quoi: 'categorie'; categorie: ServiceCategory | null }
  | null

type Suppression =
  | { quoi: 'prestation'; service: Service }
  | { quoi: 'categorie'; categorie: ServiceCategory; nbPrestations: number }
  | null

type Props = {
  services: Service[]
  categories: ServiceCategory[]
  availabilities: Availability[]
  /** La lecture des prestations ou des catégories a échoué : on n'affiche PAS un
   *  écran vide (le laveur le prendrait pour son état réel et referait sa
   *  configuration, doublons à la clé). */
  lectureIncomplete: boolean
}

function Section({
  titre: intitule, nombre, action, children,
}: { titre: string; nombre: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-[22px]">
      <div className="flex items-center justify-between gap-3 pb-1">
        <h2 className={`flex min-w-0 items-baseline gap-2 px-0.5 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
          <span className="truncate">{intitule}</span>
          <span className={`${corps} tabular-nums`}>{nombre}</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function LignePrestation({ service, categorie, onOuvrir }: { service: Service; categorie: ServiceCategory | undefined; onOuvrir: () => void }) {
  const prix = prixListe(service)
  const reservable = estReservable(service)
  return (
    <li>
      <button type="button" onClick={onOuvrir} className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate text-[15.5px] ${nom}`}>{service.name}</span>
          <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {reservable ? detailPrestation(service, categorie) : formatDureeFr(service.duration_minutes)}
          </span>
          {!reservable && (
            <span className="flex items-start gap-2">
              <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-rouge)' }} aria-hidden />
              <span className={`text-[12.5px] leading-snug ${corpsFort} text-[color:var(--v2-color-encre)]`}>
                Invisible pour vos clients : aucun type
              </span>
            </span>
          )}
        </span>
        <span className={`shrink-0 text-right text-[15.5px] ${corpsFort} tabular-nums`}>
          {prix.des && <span className={`mr-1 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>dès</span>}
          {prix.montant}
        </span>
        <Chevron />
      </button>
    </li>
  )
}

export default function PrestationsV2({ services: servicesServeur, categories: categoriesServeur, availabilities, lectureIncomplete }: Props) {
  const p = usePrestationsV2(servicesServeur, categoriesServeur)
  const { services, categories } = p
  const [feuille, setFeuille] = useState<FeuilleOuverte>(null)
  const [suppression, setSuppression] = useState<Suppression>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)
  const [suppressionErreur, setSuppressionErreur] = useState<string | null>(null)

  const categorieDe = (id: string | null) => categories.find(c => c.id === id)
  const sansCategorie = services.filter(s => !categories.some(c => c.id === s.category_id))
  const vide = categories.length === 0 && services.length === 0

  const ouvrirNouvellePrestation = () => setFeuille({ quoi: 'prestation', service: null, formulaire: formulaireNeuf(categories) })
  const ouvrirPrestation = (s: Service) => setFeuille({ quoi: 'prestation', service: s, formulaire: formulaireDepuisService(s) })
  const fermerFeuille = () => setFeuille(null)

  async function enregistrerPrestation(form: FormulairePrestation): Promise<string | null> {
    if (feuille?.quoi !== 'prestation') return null
    const message = feuille.service
      ? await p.modifierPrestation(feuille.service.id, form)
      : await p.creerPrestation(form)
    if (!message) setFeuille(null)
    return message
  }

  async function enregistrerCategorie(nomCategorie: string, types: ServiceCategory['types']): Promise<string | null> {
    if (feuille?.quoi !== 'categorie') return null
    if (feuille.categorie) {
      const message = await p.modifierCategorie(feuille.categorie.id, nomCategorie, types)
      if (!message) setFeuille(null)
      return message
    }
    const r = await p.creerCategorie(nomCategorie, types)
    if (!r.ok) return r.message
    setFeuille(null)
    return null
  }

  // État vide, un tap (voir PrestationsEtatVideV2 — retirable). Catégorie créée
  // avec les types du modèle, puis directement la feuille de la première
  // prestation. Si la création échoue, rien n'est créé : l'erreur est dite sur
  // place. Si c'est ENSUITE l'enregistrement de la prestation qui échoue (ou
  // qu'on annule), la catégorie existe déjà : elle est visible dans la liste,
  // avec « Ajouter une prestation » — pas d'objet orphelin invisible.
  async function creerDepuisModele(modele: ModeleCategorie): Promise<string | null> {
    const r = await p.creerCategorie(modele.name, typesDepuisModele(modele))
    if (!r.ok) return r.message
    setFeuille({ quoi: 'prestation', service: null, formulaire: formulaireNeuf([r.data]) })
    return null
  }

  function demanderSuppression(s: Suppression) {
    setSuppressionErreur(null)
    setSuppression(s)
  }

  async function confirmerSuppression() {
    if (!suppression || suppressionEnCours) return
    setSuppressionEnCours(true)
    setSuppressionErreur(null)
    const message = suppression.quoi === 'prestation'
      ? await p.supprimerPrestation(suppression.service.id)
      : await p.supprimerCategorie(suppression.categorie.id)
    setSuppressionEnCours(false)
    if (message) { setSuppressionErreur(message); return }
    setSuppression(null)
    setFeuille(null)
  }

  const peutAjouterPrestation = categories.length > 0

  return (
    <div
      className={`max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]`}
    >
      <div className="flex items-center gap-1 pb-3">
        <Link
          href="/dashboard/parametres"
          aria-label="Retour à Plus"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[21px] leading-none ${titre}`}>Prestations et prix</h1>
          {!lectureIncomplete && (
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {sousTitrePrestations(services.length, categories.length)}
            </p>
          )}
        </div>
        {!lectureIncomplete && peutAjouterPrestation && (
          <button
            type="button"
            onClick={ouvrirNouvellePrestation}
            className={`inline-flex h-11 shrink-0 items-center rounded-[var(--v2-radius-bouton)] px-4 text-[14.5px] ${corpsFort} text-white transition-transform active:scale-[.97] motion-reduce:transition-none`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            + Prestation
          </button>
        )}
      </div>

      {lectureIncomplete ? (
        <div className="mt-4 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-4">
          <Constat ton="ambre" role="status">
            Vos prestations n’ont pas pu être lues. Rien n’a été modifié. Rechargez la page avant d’y toucher : un écran vide
            ici ne veut pas dire que vous n’avez rien configuré.
          </Constat>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${BOUTON} mt-4 w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
            style={PRESSION}
          >
            Recharger la page
          </button>
        </div>
      ) : vide ? (
        <PrestationsEtatVideV2
          onModele={creerDepuisModele}
          onAutre={() => setFeuille({ quoi: 'categorie', categorie: null })}
        />
      ) : (
        <>
          {!peutAjouterPrestation && (
            <p className={`mt-1 px-0.5 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Créez d’abord une catégorie : elle liste ce que vos clients peuvent choisir (Voiture avec Citadine, Berline, SUV…).
            </p>
          )}

          {categories.map(cat => {
            const deLaCategorie = services.filter(s => s.category_id === cat.id)
            return (
              <Section
                key={cat.id}
                titre={cat.name}
                nombre={deLaCategorie.length}
                action={
                  <button
                    type="button"
                    onClick={() => setFeuille({ quoi: 'categorie', categorie: cat })}
                    aria-label={`Modifier la catégorie ${cat.name}`}
                    className={`-mr-2 flex min-h-11 shrink-0 items-center px-2 text-[13px] ${corpsFort} underline decoration-[color:var(--v2-filet-fort)] underline-offset-4`}
                  >
                    Modifier
                  </button>
                }
              >
                <CarteListe>
                  {deLaCategorie.length === 0 ? (
                    <p className={`py-3.5 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>
                      Aucune prestation dans cette catégorie.
                    </p>
                  ) : (
                    <ul className="divide-y divide-[color:var(--v2-filet)]">
                      {deLaCategorie.map(s => (
                        <LignePrestation key={s.id} service={s} categorie={cat} onOuvrir={() => ouvrirPrestation(s)} />
                      ))}
                    </ul>
                  )}
                </CarteListe>
              </Section>
            )
          })}

          {sansCategorie.length > 0 && (
            <Section titre="Sans catégorie" nombre={sansCategorie.length}>
              <CarteListe>
                <ul className="divide-y divide-[color:var(--v2-filet)]">
                  {sansCategorie.map(s => (
                    <LignePrestation key={s.id} service={s} categorie={categorieDe(s.category_id)} onOuvrir={() => ouvrirPrestation(s)} />
                  ))}
                </ul>
              </CarteListe>
            </Section>
          )}

          <div className="mt-[22px]">
            <CarteListe>
              <Ligne label="+ Ajouter une catégorie" onClick={() => setFeuille({ quoi: 'categorie', categorie: null })} chevron={false} />
            </CarteListe>
          </div>
        </>
      )}

      {feuille?.quoi === 'prestation' && (
        <FeuillePrestationV2
          service={feuille.service}
          formulaireInitial={feuille.formulaire}
          categories={categories}
          services={services}
          availabilities={availabilities}
          onEnregistrer={enregistrerPrestation}
          onSupprimer={feuille.service ? () => demanderSuppression({ quoi: 'prestation', service: feuille.service! }) : undefined}
          // Sous une confirmation, Échap et la poignée ne ferment que la confirmation.
          onClose={suppression ? () => {} : fermerFeuille}
        />
      )}
      {feuille?.quoi === 'categorie' && (
        <FeuilleCategorieV2
          categorie={feuille.categorie}
          services={services}
          onEnregistrer={enregistrerCategorie}
          onSupprimer={feuille.categorie
            ? () => demanderSuppression({
                quoi: 'categorie',
                categorie: feuille.categorie!,
                nbPrestations: services.filter(s => s.category_id === feuille.categorie!.id).length,
              })
            : undefined}
          onClose={suppression ? () => {} : fermerFeuille}
        />
      )}

      {suppression?.quoi === 'prestation' && (
        <ConfirmationSuppression
          titre={`Supprimer “${suppression.service.name}” ?`}
          texte="Elle disparaît de votre page de réservation."
          enCours={suppressionEnCours}
          erreur={suppressionErreur}
          onConfirmer={confirmerSuppression}
          onClose={() => setSuppression(null)}
        />
      )}
      {suppression?.quoi === 'categorie' && (
        <ConfirmationSuppression
          titre={`Supprimer “${suppression.categorie.name}” ?`}
          texte={
            suppression.nbPrestations === 0
              ? 'Aucune prestation n’y est rattachée.'
              : `Ses ${suppression.nbPrestations} prestation${suppression.nbPrestations > 1 ? 's' : ''} resteront, sans catégorie.`
          }
          remarque={
            suppression.nbPrestations === 0
              ? undefined
              : 'Leurs types resteront cochés, mais vos clients ne verront plus leurs noms : rattachez-les d’abord à une autre catégorie si vous voulez les garder lisibles.'
          }
          enCours={suppressionEnCours}
          erreur={suppressionErreur}
          onConfirmer={confirmerSuppression}
          onClose={() => setSuppression(null)}
        />
      )}
    </div>
  )
}
