'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { Availability, Unavailability } from '@/types'
import { useHorairesV2 } from '@/hooks/useHorairesV2'
import { useConges } from '@/hooks/useConges'
import { BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe, Chevron, Ligne } from '@/components/dashboard/ParametresFormV2'
import FeuillePlageV2 from '@/components/dashboard/FeuillePlageV2'
import FeuilleJourV2 from '@/components/dashboard/FeuilleJourV2'
import HorairesEtatVideV2, { type ModeleHoraires } from '@/components/dashboard/HorairesEtatVideV2'
import { CongesAVenir, FeuilleAjoutConge, FeuilleSuppressionConge } from '@/components/dashboard/CongesV2'
import { ConfirmationSuppression, Constat, nom } from '@/components/dashboard/PrestationsUiV2'
import { toDateStr } from '@/lib/dateUtils'
import {
  FERME, JOURS_AFFICHES, NOMS_JOURS, congesAVenir, libelleJour, libellePlage, phraseEchecAjout, resumeHoraires,
} from '@/lib/horaires'

// « Horaires » — refonte 2026, destination NEUVE de « Plus » (la maquette n'a
// aucun écran pour gérer les horaires ; Alexandre, 2026-09-24 : « avec le même
// design que les autres pages et les mêmes fonctionnalités qu'avant la
// refonte »). Réservé à la PWA installée (voir Horaires.tsx, le garde-fou : le
// site est renvoyé vers `/dashboard/admin#disponibilites`, l'écran v1
// `DisponibilitesManager`, inchangé).
//
// Ce que l'écran configure, c'est ce que le client final voit à l'étape « Choisissez
// un créneau » de la page de réservation (`StepSlot`) : le chemin qui rapporte
// l'argent. Aucune plage = aucun jour réservable. La logique vient de
// `lib/horaires.ts` (testée), les appels de `lib/horairesApi.ts`, l'état de
// `useHorairesV2` (plages) et `useConges` (congés, le même hook que l'agenda et le
// site) — cet écran et ses feuilles ne contiennent que de la présentation.
//
// Une seule carte, sept lignes lundi → dimanche (en base dimanche = 0). Toute la
// ligne ouvre la feuille du jour ; « Fermé » en gris pour un jour sans plage
// (jamais « Indisponible » : ce mot désigne les congés). Volontairement absent :
// tout avertissement « cette durée ne tient dans aucune plage » — il ne vit que
// dans l'écran Prestations (Alexandre, commit 853d440).

type FeuilleOuverte =
  | { quoi: 'jour'; jour: number }
  | { quoi: 'ajout'; jours: number[] }
  | null

type Props = {
  availabilities: Availability[]
  unavailabilities: Unavailability[]
  teamSize: number
  /** La lecture des horaires ou des congés a échoué : on n'affiche PAS un écran
   *  vide (le laveur le prendrait pour son état réel et referait sa semaine, ou
   *  croirait ses congés levés). */
  lectureIncomplete: boolean
}

export default function HorairesV2({ availabilities, unavailabilities, teamSize, lectureIncomplete }: Props) {
  const h = useHorairesV2(availabilities)
  const { plages } = h
  const {
    unavails, addModal, setAddModal, delModal, setDelModal, uSaving,
    openAddModal, isFullyUnavailable, saveUnavail, deleteUnavail,
  } = useConges({ initialUnavailabilities: unavailabilities, teamSize })

  const [feuille, setFeuille] = useState<FeuilleOuverte>(null)
  const [retrait, setRetrait] = useState<Availability | null>(null)
  const [retraitEnCours, setRetraitEnCours] = useState(false)
  const [retraitErreur, setRetraitErreur] = useState<string | null>(null)
  // Échec partiel d'un raccourci de l'état vide : la liste n'est plus vide (des
  // jours ont été créés), le message ne peut donc plus vivre dans l'état vide.
  const [banniere, setBanniere] = useState<string | null>(null)

  const vide = plages.length === 0
  const [aujourdhui] = useState(() => toDateStr(new Date()))
  const conges = useMemo(() => congesAVenir(unavails, aujourdhui), [unavails, aujourdhui])

  const ouvrirAjout = (jours: number[]) => setFeuille({ quoi: 'ajout', jours })
  const fermerFeuille = () => setFeuille(null)

  async function ajouterDepuisFeuille(jours: number[], debut: string, fin: string) {
    const resultats = await h.ajouter(jours, debut, fin)
    if (resultats && !phraseEchecAjout(resultats)) setBanniere(null)
    return resultats
  }

  // Raccourci de l'état vide, un tap (voir HorairesEtatVideV2 — retirable). Si
  // rien n'a été créé, l'erreur est dite sur place ; si des jours l'ont été, la
  // liste apparaît et la bannière dit ce qui manque.
  async function creerDepuisModele(modele: ModeleHoraires): Promise<string | null> {
    const resultats = await h.ajouter(modele.jours, modele.debut, modele.fin)
    if (resultats === null) return null
    const phrase = phraseEchecAjout(resultats)
    if (!phrase) { setBanniere(null); return null }
    if (resultats.some(r => r.ok)) {
      setBanniere(`${phrase} Complétez avec « + Plage ».`)
      return null
    }
    return phrase
  }

  function demanderRetrait(plage: Availability) {
    setRetraitErreur(null)
    setRetrait(plage)
  }

  async function confirmerRetrait() {
    if (!retrait || retraitEnCours) return
    setRetraitEnCours(true)
    setRetraitErreur(null)
    const message = await h.retirer(retrait.id)
    setRetraitEnCours(false)
    if (message) { setRetraitErreur(message); return }
    setRetrait(null)
  }

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
          <h1 className={`text-[21px] leading-none ${titre}`}>Horaires</h1>
          {!lectureIncomplete && !vide && (
            // Chaque groupe (« Lun–Ven 8h–18h ») reste d'un bloc : la phrase passe à la
            // ligne entre deux groupes, jamais au milieu d'une plage.
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {resumeHoraires(plages).split(' · ').map((groupe, i) => (
                <span key={groupe}>{i > 0 && ' · '}<span className="whitespace-nowrap">{groupe}</span></span>
              ))}
            </p>
          )}
        </div>
        {!lectureIncomplete && !vide && (
          <button
            type="button"
            onClick={() => ouvrirAjout([])}
            className={`inline-flex h-11 shrink-0 items-center rounded-[var(--v2-radius-bouton)] px-4 text-[14.5px] ${corpsFort} text-white transition-transform active:scale-[.97] motion-reduce:transition-none`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            + Plage
          </button>
        )}
      </div>

      {lectureIncomplete ? (
        <div className="mt-4 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-4">
          <Constat ton="ambre" role="status">
            Vos horaires ou vos congés n’ont pas pu être lus. Rien n’a été modifié. Rechargez la page avant d’y toucher : un
            écran vide ici ne veut pas dire que vous n’avez rien réglé.
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
      ) : (
        <>
          {banniere && <div className="mb-3 mt-1"><Constat ton="rouge" role="alert">{banniere}</Constat></div>}

          {vide ? (
            <>
              <div className="mt-1"><Constat ton="ambre" role="status">Aucun créneau n’est réservable pour l’instant.</Constat></div>
              <HorairesEtatVideV2 onModele={creerDepuisModele} onAutre={() => ouvrirAjout([])} />
            </>
          ) : (
            <CarteListe>
              <ul className="divide-y divide-[color:var(--v2-filet)]">
                {JOURS_AFFICHES.map(jour => {
                  const texte = libelleJour(plages, jour)
                  return (
                    <li key={jour}>
                      <button
                        type="button"
                        onClick={() => setFeuille({ quoi: 'jour', jour })}
                        className="flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left"
                      >
                        <span className={`w-[92px] shrink-0 text-[15.5px] ${nom}`}>{NOMS_JOURS[jour]}</span>
                        <span
                          className={`min-w-0 flex-1 text-[14.5px] tabular-nums ${texte === FERME ? `${corps} text-[color:var(--v2-color-gris)]` : corpsFort}`}
                        >
                          {texte}
                        </span>
                        <Chevron />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </CarteListe>
          )}

          {/* Les congés restent gérables même sans aucune plage : un laveur qui
              n'a pas encore réglé sa semaine peut déjà bloquer une période. */}
          <section aria-label="Congés" className="mt-[26px]">
            <CarteListe>
              <div className="py-3.5">
                {conges.length > 0 ? (
                  <CongesAVenir conges={conges} teamSize={teamSize} estComplet={isFullyUnavailable} onOuvrir={setDelModal} />
                ) : (
                  <>
                    <h2 className={`text-[15px] ${corpsFort}`}>Congés à venir</h2>
                    <p className={`mt-1 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucun pour l’instant.</p>
                  </>
                )}
              </div>
              <Ligne label="+ Bloquer une période" onClick={() => openAddModal(new Date())} chevron={false} />
            </CarteListe>
          </section>
        </>
      )}

      {feuille?.quoi === 'jour' && (
        <FeuilleJourV2
          jour={feuille.jour}
          plages={plages}
          onAjouter={() => ouvrirAjout([feuille.jour])}
          onRetirer={demanderRetrait}
          // Sous une confirmation, Échap et la poignée ne ferment que la confirmation.
          onClose={retrait ? () => {} : fermerFeuille}
        />
      )}
      {feuille?.quoi === 'ajout' && (
        <FeuillePlageV2
          joursInitiaux={feuille.jours}
          plages={plages}
          onAjouter={ajouterDepuisFeuille}
          onClose={fermerFeuille}
        />
      )}

      {retrait && (
        <ConfirmationSuppression
          titre={`Retirer ${libellePlage(retrait)} le ${NOMS_JOURS[retrait.day_of_week].toLowerCase()} ?`}
          texte="Ce jour-là, plus de créneaux sur cette plage."
          remarque="Les rendez-vous déjà pris ne sont pas touchés."
          enCours={retraitEnCours}
          erreur={retraitErreur}
          libelleAction="Retirer"
          libelleEnCours="Retrait…"
          onConfirmer={confirmerRetrait}
          onClose={() => setRetrait(null)}
        />
      )}

      {addModal && (
        <FeuilleAjoutConge
          form={addModal}
          setForm={setAddModal}
          teamSize={teamSize}
          saving={uSaving}
          onSave={saveUnavail}
          onClose={() => setAddModal(null)}
        />
      )}

      {delModal && (
        <FeuilleSuppressionConge
          conge={delModal}
          teamSize={teamSize}
          complet={isFullyUnavailable(delModal)}
          saving={uSaving}
          onDelete={deleteUnavail}
          onClose={() => setDelModal(null)}
        />
      )}
    </div>
  )
}
