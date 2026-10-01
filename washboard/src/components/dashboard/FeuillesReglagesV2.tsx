'use client'

import { useState } from 'react'
import { Feuille, BOUTON, CHAMP, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { CarteListe } from '@/components/dashboard/ParametresFormV2'
import { envoyerSmsTest, actionCompte } from '@/lib/profilApi'
import { confirmerEnvoi } from '@/lib/confirmationEnvoi'
import {
  MODES_DEPLACEMENT, ajouterPalier, joursAvantPurge, nettoyerExpediteur, nomConfirme, resumeTelephone,
  type ModeDeplacement, type PalierDeplacement,
} from '@/lib/profil'

// Feuilles du bas des réglages qui n'existaient que sur l'ancien écran « Tous les réglages »
// (`ParametresFormV1`) : frais de déplacement, nom d'expéditeur des SMS (avec SMS test), et la
// pause / suppression du compte. Mêmes champs, mêmes routes, mêmes règles — seule la
// présentation change (Alexandre, 2026-09-30 : « tous les réglages dans la pwa n'ont pas été
// redessinés avec la même DA »).

type Enregistrer<T> = (valeur: T) => Promise<string | null>

const euros = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`

// ── Frais de déplacement ───────────────────────────────────────────────────

export function FeuilleDeplacementV2({
  paliers, mode, onEnregistrer, onClose,
}: {
  paliers: PalierDeplacement[]
  mode: ModeDeplacement
  onEnregistrer: Enregistrer<{ travel_fee_tiers: PalierDeplacement[]; travel_fee_mode: ModeDeplacement }>
  onClose: () => void
}) {
  const [liste, setListe] = useState(paliers)
  const [choix, setChoix] = useState(mode)
  const [minutes, setMinutes] = useState('')
  const [frais, setFrais] = useState('')
  const [erreurPalier, setErreurPalier] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  function ajouter() {
    const r = ajouterPalier(liste, minutes, frais)
    setErreurPalier(r.erreur)
    if (r.erreur) return
    setListe(r.tiers)
    setMinutes('')
    setFrais('')
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    // Un palier tapé mais pas encore ajouté : on le prend, plutôt que de le perdre en silence.
    let final = liste
    if (minutes.trim() || frais.trim()) {
      const r = ajouterPalier(liste, minutes, frais)
      if (r.erreur) { setErreurPalier(r.erreur); return }
      final = r.tiers
      setListe(final)
      setMinutes(''); setFrais('')
    }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer({ travel_fee_tiers: final, travel_fee_mode: choix })
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  const entree = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); ajouter() } }

  return (
    <Feuille
      titre="Frais de déplacement"
      sousTitre="Facturés selon la durée du trajet jusqu’au client."
      verrou={paliers.length === 0 ? 'frais_deplacement' : undefined}
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="reglage-deplacement" />
        </div>
      }
    >
      <form id="reglage-deplacement" onSubmit={soumettre} noValidate>
        <Bloc titre="Paliers">
          {liste.length === 0 ? (
            <p className={`text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Aucun palier : le déplacement est offert. Ajoutez-en un pour le facturer.
            </p>
          ) : (
            <CarteListe>
              <ul className="divide-y divide-[color:var(--v2-filet)]">
                {liste.map(p => (
                  <li key={p.max_minutes} className="flex min-h-[52px] items-center gap-3 pl-4 pr-1">
                    <span className={`min-w-0 flex-1 text-[15px] ${corps}`}>
                      Jusqu’à {p.max_minutes} min <span className="text-[color:var(--v2-color-gris)]">→</span>{' '}
                      <span className={`${corpsFort} tabular-nums`}>{euros(p.fee)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setListe(l => l.filter(x => x.max_minutes !== p.max_minutes))}
                      className={`flex h-11 shrink-0 items-center px-3 text-[13.5px] ${corpsFort}`}
                      style={{ color: 'var(--v2-color-rouge)' }}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            </CarteListe>
          )}
        </Bloc>

        <Bloc titre="Ajouter un palier">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-[12.5px] text-[color:var(--v2-color-gris)]">Trajet jusqu’à (min)</span>
              <input
                type="number" inputMode="numeric" min={1} placeholder="30" value={minutes}
                onChange={e => { setMinutes(e.target.value); setErreurPalier(null) }} onKeyDown={entree}
                className={CHAMP}
              />
            </label>
            <label className="min-w-0 flex-1">
              <span className="mb-1.5 block text-[12.5px] text-[color:var(--v2-color-gris)]">Frais (€)</span>
              <input
                type="number" inputMode="decimal" min={0} step={0.5} placeholder="15" value={frais}
                onChange={e => { setFrais(e.target.value); setErreurPalier(null) }} onKeyDown={entree}
                className={CHAMP}
              />
            </label>
            <button
              type="button" onClick={ajouter}
              className={`${BOUTON} shrink-0 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              Ajouter
            </button>
          </div>
          {erreurPalier && <div className="mt-2"><Constat ton="rouge" role="alert">{erreurPalier}</Constat></div>}
        </Bloc>

        {liste.length > 0 && (
          <Bloc titre="Trajet calculé depuis">
            <div className="flex flex-col gap-2" role="group" aria-label="Point de départ du trajet">
              {MODES_DEPLACEMENT.map(m => {
                const actif = choix === m.valeur
                return (
                  <button
                    key={m.valeur} type="button" aria-pressed={actif} onClick={() => setChoix(m.valeur)}
                    className="flex items-start gap-3 rounded-[var(--v2-radius-surface)] border px-4 py-3 text-left transition-colors motion-reduce:transition-none"
                    style={{
                      borderColor: actif ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)',
                      background: actif ? 'color-mix(in srgb, var(--v2-color-accent) 8%, transparent)' : 'transparent',
                      ...PRESSION,
                    }}
                  >
                    <span
                      aria-hidden
                      className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2"
                      style={{ borderColor: actif ? 'var(--v2-color-accent)' : 'var(--v2-filet-fort)' }}
                    >
                      {actif && <span className="h-2 w-2 rounded-full" style={{ background: 'var(--v2-color-accent)' }} />}
                    </span>
                    <span className="min-w-0">
                      <span className={`block text-[15px] ${corpsFort}`}>{m.libelle}</span>
                      <span className={`mt-0.5 block text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{m.detail}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Bloc>
        )}
      </form>
    </Feuille>
  )
}

// ── Expéditeur des SMS ─────────────────────────────────────────────────────

export function FeuilleExpediteurSmsV2({
  expediteur, nomEntreprise, telephone, onEnregistrer, onClose,
}: {
  expediteur: string
  nomEntreprise: string
  telephone: string
  onEnregistrer: Enregistrer<string>
  onClose: () => void
}) {
  const [saisie, setSaisie] = useState(expediteur)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [test, setTest] = useState<{ enCours: boolean; erreur: string | null }>({ enCours: false, erreur: null })

  const suggestion = nettoyerExpediteur(nomEntreprise) || 'MonEntreprise'

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    if (saisie === expediteur) { onClose(); return }
    setErreur(null)
    setEnCours(true)
    const message = await onEnregistrer(saisie)
    setEnCours(false)
    if (message) setErreur(message)
    else onClose()
  }

  async function tester() {
    if (test.enCours) return
    setTest({ enCours: true, erreur: null })
    const r = await envoyerSmsTest()
    if (!r.ok) { setTest({ enCours: false, erreur: r.message }); return }
    setTest({ enCours: false, erreur: null })
    confirmerEnvoi({
      titre: 'SMS envoyé',
      detail: telephone ? `Regardez sur votre téléphone (${resumeTelephone(telephone).texte}).` : 'Regardez sur votre téléphone.',
    })
  }

  return (
    <Feuille
      titre="Expéditeur des SMS"
      sousTitre="Le nom qui s’affiche sur le téléphone de vos clients."
      verrou="avis_sms"
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle="Enregistrer" onClose={onClose} formulaire="reglage-expediteur" />}
    >
      <form id="reglage-expediteur" onSubmit={soumettre} noValidate>
        <Bloc titre="Nom d’expéditeur">
          <input
            type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"
            maxLength={11} value={saisie} placeholder={suggestion}
            onChange={e => { setSaisie(nettoyerExpediteur(e.target.value)); setErreur(null) }}
            aria-label="Nom d’expéditeur" aria-invalid={!!erreur}
            className={CHAMP}
          />
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <p className={`mt-2 text-[12.5px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`}>
            11 caractères au maximum, lettres et chiffres uniquement : c’est la règle des opérateurs. Laissez vide pour
            utiliser le nom commun « WashBoard ».
          </p>
        </Bloc>

        <Bloc titre="Vérifier">
          <button
            type="button" onClick={tester} disabled={test.enCours}
            className={`${BOUTON} w-full border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
            style={PRESSION}
          >
            {test.enCours ? 'Envoi…' : 'M’envoyer un SMS test'}
          </button>
          {test.erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{test.erreur}</Constat></div>}
          <p className={`mt-2 text-[12.5px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`}>
            Enregistrez d’abord le nom, puis envoyez-vous un exemple sur le numéro de votre profil.
          </p>
        </Bloc>
      </form>
    </Feuille>
  )
}

// ── Compte : pause et suppression ──────────────────────────────────────────

/** Suspendre le compte : réversible, la page de réservation est masquée. */
export function FeuillePauseV2({ onFait, onClose }: { onFait: () => void; onClose: () => void }) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function confirmer() {
    if (enCours) return
    setEnCours(true); setErreur(null)
    const r = await actionCompte('deactivate')
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    onFait()
    onClose()
  }

  return (
    <ConfirmationSuppression
      titre="Mettre mon compte en pause ?"
      texte="Votre page de réservation est masquée : plus aucun nouveau rendez-vous n’arrive."
      remarque="Vos données sont conservées, et vous réactivez le compte quand vous voulez."
      enCours={enCours}
      erreur={erreur}
      libelleAction="Mettre en pause"
      libelleEnCours="Pause…"
      onConfirmer={confirmer}
      onClose={onClose}
    />
  )
}

/** Programmer la suppression : 30 jours pour changer d'avis, le nom exact est exigé. */
export function FeuilleSuppressionV2({
  nom, onFait, onClose,
}: { nom: string; onFait: () => void; onClose: () => void }) {
  const [saisie, setSaisie] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const pret = nomConfirme(saisie, nom)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours || !pret) return
    setEnCours(true); setErreur(null)
    const r = await actionCompte('delete', saisie)
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    onFait()
    onClose()
  }

  return (
    <Feuille
      titre="Supprimer mon compte"
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <div className="flex gap-2.5">
            <button
              type="button" onClick={onClose}
              className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              Annuler
            </button>
            <button
              type="submit" form="reglage-suppression" disabled={enCours || !pret}
              className={`${BOUTON} flex-[1.4] text-white`}
              style={{ background: 'var(--v2-color-rouge)', ...PRESSION }}
            >
              {enCours ? 'Suppression…' : 'Supprimer mon compte'}
            </button>
          </div>
        </div>
      }
    >
      <form id="reglage-suppression" onSubmit={soumettre} noValidate>
        <p className={`text-[14.5px] leading-[1.55] ${corps}`}>
          Cela programme l’effacement de votre compte et de <strong className={corpsFort}>toutes vos données</strong> :
          clients, rendez-vous, comptabilité, prestations. Vous avez <strong className={corpsFort}>30 jours</strong> pour
          annuler avant l’effacement définitif.
        </p>
        <div className="mt-4">
          <Constat ton="ambre">
            Un abonnement en cours ne s’arrête pas tout seul : résiliez-le avant la prochaine échéance pour ne pas être prélevé.
          </Constat>
        </div>
        <div className="mt-5">
          <Bloc titre={`Pour confirmer, tapez : ${nom}`}>
            <input
              type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"
              value={saisie} placeholder={nom} onChange={e => { setSaisie(e.target.value); setErreur(null) }}
              aria-label="Nom de votre entreprise" className={CHAMP}
            />
          </Bloc>
        </div>
      </form>
    </Feuille>
  )
}

/** Carte affichée en tête de l'écran quand le compte est en pause ou en cours de suppression. */
export function CarteEtatCompte({
  etat, programmeeLe, maintenant, onReactiver,
}: {
  etat: 'deactivated' | 'pending_deletion'
  programmeeLe: string | null
  maintenant: number
  onReactiver: () => Promise<string | null>
}) {
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const supprime = etat === 'pending_deletion'
  const jours = joursAvantPurge(programmeeLe, maintenant)

  async function reactiver() {
    if (enCours) return
    setEnCours(true); setErreur(null)
    const message = await onReactiver()
    setEnCours(false)
    if (message) setErreur(message)
  }

  return (
    <section
      aria-label={supprime ? 'Suppression programmée' : 'Compte en pause'}
      className="mt-3 rounded-[var(--v2-radius-surface)] border bg-[color:var(--v2-color-surface)] p-4"
      style={{ borderColor: supprime ? 'var(--v2-color-rouge)' : 'var(--v2-color-ambre)' }}
    >
      <h2 className={`text-[16px] ${corpsFort}`}>{supprime ? 'Suppression programmée' : 'Compte en pause'}</h2>
      <p className={`mt-1.5 text-[14px] leading-[1.55] ${corps}`}>
        {supprime
          ? <>Votre compte sera <strong className={corpsFort}>définitivement supprimé dans {jours} jour{jours > 1 ? 's' : ''}</strong>, avec toutes vos données. Votre page de réservation est déjà masquée.</>
          : 'Votre page de réservation est masquée et vous ne recevez plus de nouveaux rendez-vous. Vos données sont conservées.'}
      </p>
      {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
      <button
        type="button" onClick={reactiver} disabled={enCours}
        className={`${BOUTON} mt-3 w-full text-white`}
        style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
      >
        {enCours ? '…' : supprime ? 'Annuler la suppression' : 'Réactiver mon compte'}
      </button>
    </section>
  )
}
