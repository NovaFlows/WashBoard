'use client'

import { useRef, useState } from 'react'
import {
  Feuille, BOUTON, CHAMP, PRESSION, corps, corpsFort,
} from '@/components/dashboard/FeuilleV2'
import {
  apercuRelance, lienAvisValide, texteSmsAvis, libelleCanal,
  DELAI_AVIS_MAX_HEURES, DELAI_RELANCE_MAX_JOURS, RELANCE_MESSAGE_MAX,
  type Canal, type RdvMessage, type ReglagesMessages,
} from '@/lib/messagesAutomatiques'
import { RAPPEL_HEURES_DEFAUT, RAPPEL_HEURES_MAX, RAPPEL_NB_MAX } from '@/lib/rappelsRdv'
import { useT } from '@/components/i18n/I18nProvider'

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

export function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
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

/** Rangée de puces + « Autre ». Partagée avec les feuilles Zone et Créneaux
 *  intelligents de « Prestations et prix » (rayon, proximité, remise) : mêmes
 *  valeurs proposées d'un tap, même repli sur un champ libre. */
export function Puces({
  valeurs, libelle, valeur, autre, onChoisir, nom,
}: {
  valeurs: readonly number[]
  libelle: (v: number) => string
  valeur: number | 'autre'
  autre?: boolean
  onChoisir: (v: number | 'autre') => void
  nom: string
}) {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={nom}>
      {valeurs.map(v => (
        <button key={v} type="button" aria-pressed={valeur === v} onClick={() => onChoisir(v)} className={chip(valeur === v)} style={PRESSION}>
          {libelle(v)}
        </button>
      ))}
      {autre && (
        <button type="button" aria-pressed={valeur === 'autre'} onClick={() => onChoisir('autre')} className={chip(valeur === 'autre')} style={PRESSION}>
          {t('Autre')}
        </button>
      )}
    </div>
  )
}

function ChoixCanal({
  canal, onChange, smsAutorise, cible,
}: { canal: Canal; onChange: (c: Canal) => void; smsAutorise: boolean; cible: string }) {
  const t = useT()
  return (
    <>
      <div className="flex gap-2.5" role="group" aria-label={t('Canal d’envoi')}>
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
              {t(libelleCanal(c))}{bloque && <span className="ml-1.5 text-[12px]">{t('Pro')}</span>}
            </button>
          )
        })}
      </div>
      <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
        {t('Ce choix vaut aussi pour {cible}. WhatsApp n’est pas encore proposé.', { cible })}
      </p>
    </>
  )
}

export function Erreur({ texte }: { texte: string | null }) {
  if (!texte) return null
  return (
    <p role="alert" className={`mb-3 text-[13px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{texte}</p>
  )
}

export function Pied({
  enCours, libelle, onClose, formulaire,
}: { enCours: boolean; libelle: string; onClose: () => void; formulaire: string }) {
  const t = useT()
  return (
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={onClose}
        className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-gris)]`}
        style={PRESSION}
      >
        {t('Annuler')}
      </button>
      <button
        type="submit"
        form={formulaire}
        disabled={enCours}
        className={`${BOUTON} flex-[1.4] text-white`}
        style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
      >
        {enCours ? t('Enregistrement…') : libelle}
      </button>
    </div>
  )
}

// ── Demande d'avis Google ──────────────────────────────────────────────────

const PRESETS_AVIS = [0, 1, 3, 24] as const

export function ReglageAvisV2({
  reglages, canal: canalInitial, smsAutorise, activer, nomLaveur, champExpediteur, onClose, enregistrer,
}: {
  reglages: ReglagesMessages
  canal: Canal
  smsAutorise: boolean
  /** Ouverte par l'interrupteur : « Enregistrer » allume aussi la demande. */
  activer: boolean
  nomLaveur: string
  /** Nom d'expéditeur SMS et SMS de test, affichés directement dans la fiche. */
  champExpediteur: React.ReactNode
  onClose: () => void
  enregistrer: Enregistrer
}) {
  const t = useT()
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
      setErreurDelai(t('Indiquez un nombre d’heures entre 0 et {max}.', { max: DELAI_AVIS_MAX_HEURES }))
      return
    }
    const lien = url.trim()
    if (veutActiver && !lien) { setErreurUrl(t('Collez votre lien d’avis Google : sans lui, aucune demande ne peut partir.')); return }
    if (lien && !lienAvisValide(lien)) { setErreurUrl(t('Ce lien doit commencer par https://')); return }

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
      titre={t('Demande d’avis Google')}
      sousTitre={t('Un message après chaque prestation terminée')}
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle={activer ? t('Enregistrer et activer') : t('Enregistrer')} onClose={onClose} formulaire="reglage-avis" />}
    >
      <form id="reglage-avis" onSubmit={valider} noValidate>
        <Bloc titre={t('Lien d’avis Google')}>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://g.page/r/…"
            aria-label={t('Lien d’avis Google')}
            aria-invalid={!!erreurUrl}
            className={CHAMP}
          />
          {erreurUrl && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurUrl}</p>}
          <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            {t('Depuis votre fiche Google Business : « Demander des avis », puis copiez le lien à partager.')}
          </p>
        </Bloc>

        <Bloc titre={t('Quand')}>
          <Puces
            nom={t('Délai avant l’envoi')}
            valeurs={PRESETS_AVIS}
            libelle={h => (h === 0 ? t('Tout de suite') : h === 24 ? t('1 jour') : `${h} h`)}
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
                aria-label={t('Nombre d’heures')}
                className={`${CHAMP} !w-24`}
              />
              <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('heures')}</span>
            </div>
          )}
          {erreurDelai && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurDelai}</p>}
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>{t('{v0}{v1}Le client doit avoir une adresse email enregistrée.', { v0: Number.isFinite(heuresEcrites) && heuresEcrites > 0
              ? t('Compté à partir du moment où vous touchez « Terminé » sur le rendez-vous — une seule demande par rendez-vous, {h} h plus tard.', { h: heuresEcrites })
              : t('Compté à partir du moment où vous touchez « Terminé » sur le rendez-vous — une seule demande par rendez-vous, tout de suite.'), v1: ' ' })}</p>
        </Bloc>

        <Bloc titre={t('Canal')}>
          <ChoixCanal canal={canal} onChange={setCanal} smsAutorise={smsAutorise} cible={t('la relance')} />
        </Bloc>

        <Bloc titre={t('Message')} aide={t('Non modifiable')}>
          <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
            <p className={`text-[14px] ${corps} leading-[1.6]`}>
              {canal === 'sms'
                ? texteSmsAvis()
                : t('Email « Votre avis compte pour {nom} », avec un bouton « Laisser un avis Google » qui ouvre votre lien.', { nom: nomLaveur })}
            </p>
          </div>
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            {t('Ce texte est le même pour tous les laveurs pour l’instant : il ne se personnalise pas encore.')}
          </p>
        </Bloc>

        {smsAutorise && champExpediteur}

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}

// ── Relance ────────────────────────────────────────────────────────────────

const PRESETS_RELANCE = [30, 60, 90, 180] as const

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
  const t = useT()
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
  const apercu = !lectureIncomplete && delaiValide ? apercuRelance(rdvs, jours, maintenant, canal) : null

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
      setErreurDelai(t('Indiquez un nombre de jours entre 1 et {max}.', { max: DELAI_RELANCE_MAX_JOURS }))
      return
    }
    const texte = message.trim()
    if (veutActiver && !texte) { setErreurMessage(t('Écrivez le message à envoyer : sans lui, aucune relance ne peut partir.')); return }

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
      titre={t('Relance')}
      sousTitre={t('Faire revenir un client qui ne revient plus')}
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle={activer ? t('Enregistrer et activer') : t('Enregistrer')} onClose={onClose} formulaire="reglage-relance" />}
    >
      <form id="reglage-relance" onSubmit={valider} noValidate>
        <Bloc titre={t('Quand')}>
          <Puces
            nom={t('Délai avant la relance')}
            valeurs={PRESETS_RELANCE}
            libelle={j => t('{n} mois', { n: j / 30 })}
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
                aria-label={t('Nombre de jours')}
                className={`${CHAMP} !w-24`}
              />
              <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('jours')}</span>
            </div>
          )}
          {erreurDelai && <p role="alert" className={`mt-1.5 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreurDelai}</p>}
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            {t('Après la dernière prestation, si le client n’a pas repris rendez-vous entre-temps.')}
          </p>
        </Bloc>

        {apercu && (
          <div className="mb-5 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
            <p className={`text-[14px] ${corpsFort}`}>{t('Ce que ça donne aujourd’hui')}</p>
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`} aria-live="polite">
              {apercu.concernes > 0 ? (
                <>
                  <strong className="font-semibold text-[color:var(--v2-color-encre)]">
                    {t(apercu.concernes > 1 ? '{n} clients sont concernés : ils recevraient ce message au prochain envoi.' : '{n} client est concerné : il recevrait ce message au prochain envoi.', { n: apercu.concernes })}
                  </strong>
                </>
              ) : (
                <>{t('Personne n’est concerné aujourd’hui.')}</>
              )}
              {apercu.suivant && (
                <>
                  {' '}{t('Le suivant partirait {moment}, pour {nom}.', { moment: apercu.suivant.moment, nom: apercu.suivant.nom })}
                </>
              )}
            </p>
          </div>
        )}

        <Bloc titre={t('Message')} aide={`${message.length}/${RELANCE_MESSAGE_MAX}`}>
          <textarea
            ref={zone}
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, RELANCE_MESSAGE_MAX))}
            rows={4}
            aria-label={t('Message de relance')}
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
              {t('devient le prénom du client')}
            </span>
          </div>
          {canal === 'sms' && message.length > 160 && (
            <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {t('Au-delà de 160 caractères, un SMS part en plusieurs morceaux.')}
            </p>
          )}
        </Bloc>

        <Bloc titre={t('Canal')}>
          <ChoixCanal canal={canal} onChange={setCanal} smsAutorise={smsAutorise} cible={t('la demande d’avis')} />
        </Bloc>

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}

// ── Rappel de rendez-vous (email) ──────────────────────────────────────────

const PRESETS_RAPPEL = [1, 2, 3, 24, 48] as const

export function ReglageRappelV2({
  reglages, onClose, enregistrer,
}: {
  reglages: ReglagesMessages
  onClose: () => void
  enregistrer: Enregistrer
}) {
  const t = useT()
  // Saisies gardées en texte : un champ vidé pendant la frappe ne doit pas devenir « 0 ».
  const [saisies, setSaisies] = useState<string[]>(() =>
    (reglages.rappel_rdv_heures?.length ? reglages.rappel_rdv_heures : [...RAPPEL_HEURES_DEFAUT]).map(String))
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const changer = (i: number, v: string) => setSaisies(s => s.map((x, j) => (j === i ? v : x)))

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    const heures = saisies.map(s => Number(s.trim()))
    if (heures.some(h => !Number.isInteger(h) || h < 1 || h > RAPPEL_HEURES_MAX)) {
      setErreur(t('Chaque délai doit être un nombre entier d’heures entre 1 et {max}.', { max: RAPPEL_HEURES_MAX }))
      return
    }
    if (new Set(heures).size !== heures.length) {
      setErreur(t('Deux rappels ont le même délai : le client recevrait le même message deux fois.'))
      return
    }
    setEnCours(true)
    const message = await enregistrer({ rappel_rdv_heures: heures })
    setEnCours(false)
    if (message) setErreur(message)
  }

  return (
    <Feuille
      titre={t('Rappel de rendez-vous')}
      sousTitre={t('Un email au client, avant son rendez-vous')}
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle={t('Enregistrer')} onClose={onClose} formulaire="reglage-rappel" />}
    >
      <form id="reglage-rappel" onSubmit={valider} noValidate>
        <Bloc titre={t('Quand')} aide={t('{n} sur {max}', { n: saisies.length, max: RAPPEL_NB_MAX })}>
          <ul className="flex flex-col gap-4">
            {saisies.map((valeur, i) => (
              <li key={i} className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
                <div className="flex items-center justify-between pb-2">
                  <span className={`text-[14px] ${corpsFort}`}>{t('Rappel {n}', { n: i + 1 })}</span>
                  {saisies.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSaisies(s => s.filter((_, j) => j !== i))}
                      className={`h-11 px-2 text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}
                    >
                      {t('Retirer')}
                    </button>
                  )}
                </div>
                <Puces
                  nom={t('Délai du rappel {n}', { n: i + 1 })}
                  valeurs={PRESETS_RAPPEL}
                  libelle={h => (h === 24 ? t('1 jour') : h === 48 ? t('2 jours') : `${h} h`)}
                  valeur={(PRESETS_RAPPEL as readonly number[]).includes(Number(valeur)) ? Number(valeur) : 'autre'}
                  onChoisir={v => { if (v !== 'autre') changer(i, String(v)) }}
                />
                <div className="mt-3 flex items-center gap-2.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={RAPPEL_HEURES_MAX}
                    value={valeur}
                    onChange={e => changer(i, e.target.value)}
                    aria-label={t('Nombre d’heures avant le rendez-vous, rappel {n}', { n: i + 1 })}
                    className={`${CHAMP} !w-24`}
                  />
                  <span className={`text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('heures avant le rendez-vous')}</span>
                </div>
              </li>
            ))}
          </ul>
          {saisies.length < RAPPEL_NB_MAX && (
            <button
              type="button"
              onClick={() => setSaisies(s => [...s, '1'])}
              className={`mt-3 inline-flex h-11 items-center rounded-[var(--v2-radius-bouton)] px-3 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-accent)]`}
              style={{ background: 'color-mix(in srgb, var(--v2-color-accent) 10%, transparent)' }}
            >
              {t('Ajouter un rappel')}
            </button>
          )}
          <p className={`mt-3 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] leading-[1.55]`}>
            {t('Seuls les rendez-vous confirmés reçoivent un rappel, et seulement si le client a une adresse email. Un rendez-vous pris trop tard pour un rappel n’en reçoit pas. C’est gratuit et sans limite : c’est un email, pas un SMS.')}
          </p>
        </Bloc>

        <Bloc titre={t('Message')} aide={t('Non modifiable')}>
          <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] px-4 py-3">
            <p className={`text-[14px] ${corps} leading-[1.6]`}>
              {t('Email « Rappel de rendez-vous » : la prestation, le jour, l’heure et l’adresse, avec votre numéro pour vous prévenir en cas d’empêchement.')}
            </p>
          </div>
        </Bloc>

        <Erreur texte={erreur} />
      </form>
    </Feuille>
  )
}
