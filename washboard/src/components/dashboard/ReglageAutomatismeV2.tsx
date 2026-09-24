'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import {
  Feuille, BOUTON, CHAMP, PRESSION, corps, corpsFort,
} from '@/components/dashboard/FeuilleV2'
import {
  apercuRelance, lienAvisValide, texteSmsAvis, libelleCanal,
  DELAI_AVIS_MAX_HEURES, DELAI_RELANCE_MAX_JOURS, RELANCE_MESSAGE_MAX,
  type Canal, type RdvMessage, type ReglagesMessages,
} from '@/lib/messagesAutomatiques'

// Réglage d'un automatisme, en feuille du bas — planche `project/Automatisme.dc.html`
// de la maquette (refonte 2026), réservée à la PWA installée (ouverte par
// MessagesAutomatiquesV2.tsx uniquement). Deux feuilles : la demande d'avis et
// la relance. Elles écrivent par `PATCH /api/washer`, comme le formulaire v1 —
// mêmes champs, mêmes bornes (le serveur écrête de toute façon) ; aucune règle
// métier n'est dupliquée ici.
//
// ÉCARTS ASSUMÉS PAR RAPPORT À LA PLANCHE (chacun tient à ce que le code sait) :
//  · pas de « WhatsApp » : ni le cron ni la route ne connaissent ce canal ;
//  · un seul canal pour les DEUX messages : la relance réutilise `review_channel`
//    (voir refonte.md, « à corriger »). Les deux feuilles le disent, pour que
//    changer le canal de l'une ne surprenne pas sur l'autre ;
//  · seule la variable `{{nom}}` existe (prénom) : la planche montre `{{prénom}}`,
//    `{{lien}}`, `{{prestation}}`, `{{véhicule}}`, que le cron ne remplace pas ;
//  · le message d'avis est CODÉ EN DUR dans le cron : montré, pas modifiable.

type Enregistrer = (champs: Partial<ReglagesMessages>) => Promise<string | null>

const chip = (actif: boolean) =>
  `shrink-0 h-11 px-4 rounded-[var(--v2-radius-pilule)] text-[13.5px] ${corpsFort} border transition-colors motion-reduce:transition-none ${
    actif
      ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border-[color:var(--v2-color-encre)]'
      : 'bg-transparent text-[color:var(--v2-color-gris)] border-[color:var(--v2-filet-fort)]'
  }`

function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="flex items-baseline justify-between pb-2">
        <h3 className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{titre}</h3>
        {aide && <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{aide}</span>}
      </div>
      {children}
    </section>
  )
}

function Puces({
  valeurs, libelle, valeur, autre, onChoisir, nom,
}: {
  valeurs: readonly number[]
  libelle: (v: number) => string
  valeur: number | 'autre'
  autre?: boolean
  onChoisir: (v: number | 'autre') => void
  nom: string
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={nom}>
      {valeurs.map(v => (
        <button key={v} type="button" aria-pressed={valeur === v} onClick={() => onChoisir(v)} className={chip(valeur === v)} style={PRESSION}>
          {libelle(v)}
        </button>
      ))}
      {autre && (
        <button type="button" aria-pressed={valeur === 'autre'} onClick={() => onChoisir('autre')} className={chip(valeur === 'autre')} style={PRESSION}>
          Autre
        </button>
      )}
    </div>
  )
}

function ChoixCanal({
  canal, onChange, smsAutorise, cible,
}: { canal: Canal; onChange: (c: Canal) => void; smsAutorise: boolean; cible: string }) {
  return (
    <>
      <div className="flex gap-2.5" role="group" aria-label="Canal d’envoi">
        {(['email', 'sms'] as const).map(c => {
          const bloque = c === 'sms' && !smsAutorise && canal !== 'sms'
          const actif = canal === c
          return (
            <button
              key={c}
              type="button"
              aria-pressed={actif}
              disabled={bloque}
              onClick={() => onChange(c)}
              className={`${BOUTON} flex-1 border ${
                actif
                  ? 'bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] border-[color:var(--v2-color-encre)]'
                  : 'bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-gris)] border-[color:var(--v2-filet-fort)]'
              }`}
              style={PRESSION}
            >
              {libelleCanal(c)}{bloque && <span className="ml-1.5 text-[12px]">Pro</span>}
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
        Ce choix vaut aussi pour {cible}. WhatsApp n’est pas encore proposé.
      </p>
    </>
  )
}

function Erreur({ texte }: { texte: string | null }) {
  if (!texte) return null
  return (
    <p role="alert" className={`mb-3 text-[13px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{texte}</p>
  )
}

function Pied({
  enCours, libelle, onClose, formulaire,
}: { enCours: boolean; libelle: string; onClose: () => void; formulaire: string }) {
  return (
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={onClose}
        className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]`}
        style={PRESSION}
      >
        Annuler
      </button>
      <button
        type="submit"
        form={formulaire}
        disabled={enCours}
        className={`${BOUTON} flex-[1.4] text-white`}
        style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
      >
        {enCours ? 'Enregistrement…' : libelle}
      </button>
    </div>
  )
}

// ── Demande d'avis Google ──────────────────────────────────────────────────

const PRESETS_AVIS = [0, 1, 3, 24] as const
const libellePresetAvis = (h: number) => (h === 0 ? 'Tout de suite' : h === 24 ? '1 jour' : `${h} h`)

export function ReglageAvisV2({
  reglages, canal: canalInitial, smsAutorise, activer, nomLaveur, onClose, enregistrer,
}: {
  reglages: ReglagesMessages
  canal: Canal
  smsAutorise: boolean
  /** Ouverte par l'interrupteur : « Enregistrer » allume aussi la demande. */
  activer: boolean
  nomLaveur: string
  onClose: () => void
  enregistrer: Enregistrer
}) {
  const [url, setUrl] = useState(reglages.google_review_url ?? '')
  const preset = (PRESETS_AVIS as readonly number[]).includes(reglages.review_delay_hours) ? reglages.review_delay_hours : 'autre'
  const [choix, setChoix] = useState<number | 'autre'>(preset)
  const [autre, setAutre] = useState(String(reglages.review_delay_hours))
  const [canal, setCanal] = useState<Canal>(canalInitial)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreurUrl, setErreurUrl] = useState<string | null>(null)
  const [erreurDelai, setErreurDelai] = useState<string | null>(null)

  const veutActiver = activer || reglages.review_enabled

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null); setErreurUrl(null); setErreurDelai(null)

    const heures = choix === 'autre' ? Number(autre.trim()) : choix
    if (!Number.isInteger(heures) || heures < 0 || heures > DELAI_AVIS_MAX_HEURES) {
      setErreurDelai(`Indiquez un nombre d’heures entre 0 et ${DELAI_AVIS_MAX_HEURES}.`)
      return
    }
    const lien = url.trim()
    if (veutActiver && !lien) { setErreurUrl('Collez votre lien d’avis Google : sans lui, aucune demande ne peut partir.'); return }
    if (lien && !lienAvisValide(lien)) { setErreurUrl('Ce lien doit commencer par https://'); return }

    const champs: Partial<ReglagesMessages> = { google_review_url: lien || null, review_delay_hours: heures }
    // Le canal n'est envoyé que s'il change : renvoyer « sms » à un compte
    // repassé en Essentiel serait refusé par le serveur (plan Pro).
    if (canal !== canalInitial) champs.review_channel = canal
    if (activer) champs.review_enabled = true

    setEnCours(true)
    const message = await enregistrer(champs)
    setEnCours(false)
    if (message) setErreur(message)
  }

  const heuresEcrites = choix === 'autre' ? Number(autre) : choix

  return (
    <Feuille
      titre="Demande d’avis Google"
      sousTitre="Un message après chaque prestation terminée"
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle={activer ? 'Enregistrer et activer' : 'Enregistrer'} onClose={onClose} formulaire="reglage-avis" />}
    >
      <form id="reglage-avis" onSubmit={valider} noValidate>
        <Bloc titre="Lien d’avis Google">
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://g.page/r/…"
            aria-label="Lien d’avis Google"
            aria-invalid={!!erreurUrl}
            className={CHAMP}
          />
          {erreurUrl && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurUrl}</p>}
          <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            Depuis votre fiche Google Business : « Demander des avis », puis copiez le lien à partager.
          </p>
        </Bloc>

        <Bloc titre="Quand">
          <Puces
            nom="Délai avant l’envoi"
            valeurs={PRESETS_AVIS}
            libelle={libellePresetAvis}
            valeur={choix}
            autre
            onChoisir={setChoix}
          />
          {choix === 'autre' && (
            <div className="mt-3 flex items-center gap-2.5">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={DELAI_AVIS_MAX_HEURES}
                value={autre}
                onChange={e => setAutre(e.target.value)}
                aria-label="Nombre d’heures"
                className={`${CHAMP} !w-24`}
              />
              <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>heures</span>
            </div>
          )}
          {erreurDelai && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurDelai}</p>}
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            Compté à partir du moment où vous touchez « Terminé » sur le rendez-vous — une seule demande par rendez-vous
            {Number.isFinite(heuresEcrites) && heuresEcrites > 0 ? `, ${heuresEcrites} h plus tard.` : ', tout de suite.'}
            {' '}Le client doit avoir une adresse email enregistrée.
          </p>
        </Bloc>

        <Bloc titre="Canal">
          <ChoixCanal canal={canal} onChange={setCanal} smsAutorise={smsAutorise} cible="la relance" />
        </Bloc>

        <Bloc titre="Message" aide="Non modifiable">
          <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
            <p className={`text-[14px] ${corps} leading-[1.6]`}>
              {canal === 'sms'
                ? texteSmsAvis()
                : `Email « Votre avis compte pour ${nomLaveur} », avec un bouton « Laisser un avis Google » qui ouvre votre lien.`}
            </p>
          </div>
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            Ce texte est le même pour tous les laveurs pour l’instant : il ne se personnalise pas encore.
          </p>
        </Bloc>

        {smsAutorise && (
          <Link
            href="/dashboard/parametres/tout#avis"
            className={`flex min-h-11 items-center text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
          >
            Nom d’expéditeur SMS et SMS de test
          </Link>
        )}

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}

// ── Relance ────────────────────────────────────────────────────────────────

const PRESETS_RELANCE = [30, 60, 90, 180] as const
const libellePresetRelance = (j: number) => `${j / 30} mois`

export function ReglageRelanceV2({
  reglages, canal: canalInitial, smsAutorise, activer, messageSuggere, rdvs, maintenant, lectureIncomplete, onClose, enregistrer,
}: {
  reglages: ReglagesMessages
  canal: Canal
  smsAutorise: boolean
  activer: boolean
  /** Proposé quand le laveur n'a encore rien écrit ; jamais enregistré sans son « Enregistrer ». */
  messageSuggere: string
  rdvs: RdvMessage[]
  maintenant: number
  lectureIncomplete: boolean
  onClose: () => void
  enregistrer: Enregistrer
}) {
  const preset = (PRESETS_RELANCE as readonly number[]).includes(reglages.followup_delay_days) ? reglages.followup_delay_days : 'autre'
  const [choix, setChoix] = useState<number | 'autre'>(preset)
  const [autre, setAutre] = useState(String(reglages.followup_delay_days))
  const [message, setMessage] = useState(reglages.followup_message?.trim() ? reglages.followup_message : messageSuggere)
  const [canal, setCanal] = useState<Canal>(canalInitial)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [erreurDelai, setErreurDelai] = useState<string | null>(null)
  const [erreurMessage, setErreurMessage] = useState<string | null>(null)
  const zone = useRef<HTMLTextAreaElement>(null)

  const veutActiver = activer || reglages.followup_enabled
  const jours = choix === 'autre' ? Number(autre.trim()) : choix
  const delaiValide = Number.isInteger(jours) && jours >= 1 && jours <= DELAI_RELANCE_MAX_JOURS
  const apercu = !lectureIncomplete && delaiValide ? apercuRelance(rdvs, jours, maintenant) : null

  function insererNom() {
    const el = zone.current
    const jeton = '{{nom}}'
    const debut = el?.selectionStart ?? message.length
    const fin = el?.selectionEnd ?? message.length
    const suite = message.slice(0, debut) + jeton + message.slice(fin)
    if (suite.length > RELANCE_MESSAGE_MAX) return
    setMessage(suite)
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(debut + jeton.length, debut + jeton.length) })
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null); setErreurDelai(null); setErreurMessage(null)

    if (!delaiValide) {
      setErreurDelai(`Indiquez un nombre de jours entre 1 et ${DELAI_RELANCE_MAX_JOURS}.`)
      return
    }
    const texte = message.trim()
    if (veutActiver && !texte) { setErreurMessage('Écrivez le message à envoyer : sans lui, aucune relance ne peut partir.'); return }

    const champs: Partial<ReglagesMessages> = { followup_delay_days: jours, followup_message: texte || null }
    if (canal !== canalInitial) champs.review_channel = canal
    if (activer) champs.followup_enabled = true

    setEnCours(true)
    const retour = await enregistrer(champs)
    setEnCours(false)
    if (retour) setErreur(retour)
  }

  return (
    <Feuille
      titre="Relance"
      sousTitre="Faire revenir un client qui ne revient plus"
      onClose={onClose}
      fermerSurFond={false}
      pied={<Pied enCours={enCours} libelle={activer ? 'Enregistrer et activer' : 'Enregistrer'} onClose={onClose} formulaire="reglage-relance" />}
    >
      <form id="reglage-relance" onSubmit={valider} noValidate>
        <Bloc titre="Quand">
          <Puces
            nom="Délai avant la relance"
            valeurs={PRESETS_RELANCE}
            libelle={libellePresetRelance}
            valeur={choix}
            autre
            onChoisir={setChoix}
          />
          {choix === 'autre' && (
            <div className="mt-3 flex items-center gap-2.5">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={DELAI_RELANCE_MAX_JOURS}
                value={autre}
                onChange={e => setAutre(e.target.value)}
                aria-label="Nombre de jours"
                className={`${CHAMP} !w-24`}
              />
              <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>jours</span>
            </div>
          )}
          {erreurDelai && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurDelai}</p>}
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            Après la dernière prestation, si le client n’a pas repris rendez-vous entre-temps.
          </p>
        </Bloc>

        {apercu && (
          <div className="mb-5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
            <p className={`text-[14px] ${corpsFort}`}>Ce que ça donne aujourd’hui</p>
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`} aria-live="polite">
              {apercu.concernes > 0 ? (
                <>
                  <strong className="font-semibold text-[color:var(--v2-color-encre)]">
                    {apercu.concernes} client{apercu.concernes > 1 ? 's' : ''}
                  </strong>{' '}
                  {apercu.concernes > 1 ? 'sont concernés' : 'est concerné'} : {apercu.concernes > 1 ? 'ils recevraient' : 'il recevrait'} ce message au prochain envoi.
                </>
              ) : (
                <>Personne n’est concerné aujourd’hui.</>
              )}
              {apercu.suivant && (
                <>
                  {' '}Le suivant partirait <strong className="font-semibold text-[color:var(--v2-color-encre)]">{apercu.suivant.moment}</strong>, pour {apercu.suivant.nom}.
                </>
              )}
            </p>
          </div>
        )}

        <Bloc titre="Message" aide={`${message.length}/${RELANCE_MESSAGE_MAX}`}>
          <textarea
            ref={zone}
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, RELANCE_MESSAGE_MAX))}
            rows={4}
            aria-label="Message de relance"
            aria-invalid={!!erreurMessage}
            className={`${CHAMP} !h-auto py-2.5 leading-[1.5] resize-none`}
          />
          {erreurMessage && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurMessage}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3">
            <button
              type="button"
              onClick={insererNom}
              className={`inline-flex h-11 items-center rounded-[var(--v2-radius-bouton)] px-3 text-[12.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
              style={{ background: 'color-mix(in srgb, var(--v2-color-accent) 10%, transparent)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {'{{nom}}'}
            </button>
            <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              devient le prénom du client
            </span>
          </div>
          {canal === 'sms' && message.length > 160 && (
            <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Au-delà de 160 caractères, un SMS part en plusieurs morceaux.
            </p>
          )}
        </Bloc>

        <Bloc titre="Canal">
          <ChoixCanal canal={canal} onChange={setCanal} smsAutorise={smsAutorise} cible="la demande d’avis" />
        </Bloc>

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}
