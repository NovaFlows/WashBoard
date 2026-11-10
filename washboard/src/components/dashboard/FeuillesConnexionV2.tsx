'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { MOT_DE_PASSE_MIN, validerEmail, validerMotDePasse, validerTelephone } from '@/lib/profil'
import { confirmerCodeTelephone, demanderCodeTelephone } from '@/lib/changerTelephoneClient'
import { formatPhone } from '@/lib/phone'

// Feuilles « Adresse e-mail » et « Mot de passe » de « Mon profil » (PWA). Mêmes appels que
// l'ancien écran (`ParametresFormV1`) : Supabase Auth depuis le navigateur.
//
// Les DEUX demandent le mot de passe actuel. Ce n'est pas une formalité : l'adresse e-mail est
// l'identifiant de connexion, et l'accès support (une heure, accordé par le laveur) ne donne
// pas le droit de changer les identifiants de quelqu'un. Sans cette preuve, une session
// ouverte laissée sans surveillance suffirait à verrouiller le propriétaire hors de son compte
// (trou relevé par un audit externe le 2026-09-05, comblé côté site).

/** Vérifie que la personne devant l'écran connaît le mot de passe actuel. */
async function motDePasseValide(email: string, motDePasse: string): Promise<boolean> {
  if (!motDePasse) return false
  const { error } = await createClient().auth.signInWithPassword({ email, password: motDePasse })
  return !error
}

export function FeuilleEmailV2({ email, onClose }: { email: string; onClose: () => void }) {
  const [nouvel, setNouvel] = useState(email)
  const [motDePasse, setMotDePasse] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoye, setEnvoye] = useState(false)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerEmail(nouvel)
    if (refus) { setErreur(refus); return }
    if (nouvel.trim() === email.trim()) { onClose(); return }
    setErreur(null)
    setEnCours(true)
    if (!await motDePasseValide(email, motDePasse)) {
      setEnCours(false)
      setErreur('Mot de passe actuel incorrect.')
      return
    }
    const { error } = await createClient().auth.updateUser({ email: nouvel.trim() })
    setEnCours(false)
    if (error) { setErreur('Changement impossible : ' + error.message); return }
    // La feuille reste ouverte : l'adresse ne change qu'une fois le lien confirmé, et il faut
    // le dire — sinon le laveur croit que c'est fait et ne va pas voir sa boîte mail.
    setEnvoye(true)
  }

  return (
    <Feuille
      titre="Adresse e-mail"
      sousTitre="Votre identifiant de connexion."
      onClose={onClose}
      pied={envoye
        ? undefined
        : <Pied enCours={enCours} libelle="Changer l’adresse" onClose={onClose} formulaire="profil-email" />}
    >
      {envoye ? (
        <div className="pb-1">
          <Constat ton="ambre" role="status">
            Un message vient de partir à {nouvel.trim()}. Votre adresse ne changera qu’une fois le lien
            de confirmation ouvert, depuis cette nouvelle boîte mail.
          </Constat>
        </div>
      ) : (
        <form id="profil-email" onSubmit={soumettre} noValidate>
          <Bloc titre="Nouvelle adresse">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={nouvel}
              onChange={e => { setNouvel(e.target.value); setErreur(null) }}
              aria-label="Nouvelle adresse e-mail"
              className={CHAMP}
            />
          </Bloc>
          <Bloc titre="Votre mot de passe actuel">
            <input
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={e => { setMotDePasse(e.target.value); setErreur(null) }}
              placeholder="Pour confirmer que c’est bien vous"
              aria-label="Mot de passe actuel"
              className={CHAMP}
            />
            {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
            <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Vous recevrez un lien de confirmation à la nouvelle adresse.
            </p>
          </Bloc>
        </form>
      )}
    </Feuille>
  )
}

export function FeuilleMotDePasseV2({ email, onClose }: { email: string; onClose: () => void }) {
  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerMotDePasse(nouveau, confirmation)
    if (refus) { setErreur(refus); return }
    setErreur(null)
    setEnCours(true)
    if (!await motDePasseValide(email, actuel)) {
      setEnCours(false)
      setErreur('Mot de passe actuel incorrect.')
      return
    }
    const { error } = await createClient().auth.updateUser({ password: nouveau })
    setEnCours(false)
    if (error) { setErreur('Changement impossible : ' + error.message); return }
    onClose()
  }

  return (
    <Feuille
      titre="Mot de passe"
      onClose={onClose}
      pied={<Pied enCours={enCours} libelle="Changer le mot de passe" onClose={onClose} formulaire="profil-mdp" />}
    >
      <form id="profil-mdp" onSubmit={soumettre} noValidate>
        <Bloc titre="Mot de passe actuel">
          <input
            type="password"
            autoComplete="current-password"
            value={actuel}
            onChange={e => { setActuel(e.target.value); setErreur(null) }}
            aria-label="Mot de passe actuel"
            className={CHAMP}
          />
        </Bloc>
        <Bloc titre="Nouveau mot de passe">
          <input
            type="password"
            autoComplete="new-password"
            value={nouveau}
            onChange={e => { setNouveau(e.target.value); setErreur(null) }}
            placeholder={`${MOT_DE_PASSE_MIN} caractères minimum`}
            aria-label="Nouveau mot de passe"
            className={CHAMP}
          />
        </Bloc>
        <Bloc titre="Le répéter">
          <input
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={e => { setConfirmation(e.target.value); setErreur(null) }}
            aria-label="Répéter le nouveau mot de passe"
            className={CHAMP}
          />
          {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
        </Bloc>
      </form>
    </Feuille>
  )
}

/** « Téléphone » de « Ma connexion » (2026-11-10) : changer de numéro comme on change d'adresse
 *  e-mail. Deux temps dans la même feuille : le nouveau numéro et le mot de passe, puis le code
 *  reçu par SMS sur ce numéro. Le numéro d'un compte est vérifié par SMS à l'inscription : un
 *  nouveau numéro doit l'être aussi, et le mot de passe est demandé pour la même raison que pour
 *  l'adresse e-mail. `onChange` reçoit le numéro enregistré. */
export function FeuilleTelephoneV2({ telephone, onChange, onClose }: { telephone: string | null; onChange: (telephone: string) => void; onClose: () => void }) {
  const [nouveau, setNouveau] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [code, setCode] = useState('')
  /** Le numéro, masqué, où le code vient de partir ; `null` tant qu'on est au premier temps. */
  const [envoyeA, setEnvoyeA] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function demander(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    const refus = validerTelephone(nouveau) ?? (nouveau.trim() ? null : 'Indiquez votre nouveau numéro.')
    if (refus) { setErreur(refus); return }
    if (!motDePasse) { setErreur('Indiquez votre mot de passe actuel.'); return }
    setErreur(null)
    setEnCours(true)
    const r = await demanderCodeTelephone(nouveau.trim(), motDePasse)
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    setMotDePasse('')
    setEnvoyeA(r.telephone)
  }

  async function valider(e: React.FormEvent) {
    e.preventDefault()
    if (enCours) return
    if (!/^\d{6}$/.test(code.trim())) { setErreur('Le code a 6 chiffres.'); return }
    setErreur(null)
    setEnCours(true)
    const r = await confirmerCodeTelephone(code.trim())
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    onChange(r.telephone)
    onClose()
  }

  return (
    <Feuille
      titre="Téléphone"
      sousTitre={telephone ? `Actuellement ${formatPhone(telephone)}.` : 'Le numéro de votre compte.'}
      onClose={onClose}
      pied={envoyeA
        ? <Pied enCours={enCours} libelle="Valider le code" onClose={onClose} formulaire="profil-tel-code" />
        : <Pied enCours={enCours} libelle="Recevoir le code" onClose={onClose} formulaire="profil-tel" />}
    >
      {envoyeA ? (
        <form id="profil-tel-code" onSubmit={valider} noValidate>
          <Bloc titre="Code reçu par SMS">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErreur(null) }}
              placeholder="6 chiffres"
              aria-label="Code reçu par SMS"
              autoFocus
              className={CHAMP}
            />
            {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
            <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Un code vient de partir au {envoyeA}. Il est valable 10 minutes. Votre numéro ne change qu’une fois le code validé.
            </p>
            <button
              type="button"
              onClick={() => { setEnvoyeA(null); setCode(''); setErreur(null) }}
              className={`mt-3 text-[13.5px] underline underline-offset-2 ${corps} text-[color:var(--v2-color-gris)]`}
            >
              Changer de numéro ou renvoyer le code
            </button>
          </Bloc>
        </form>
      ) : (
        <form id="profil-tel" onSubmit={demander} noValidate>
          <Bloc titre="Nouveau numéro">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={nouveau}
              onChange={e => { setNouveau(e.target.value); setErreur(null) }}
              placeholder="06 00 00 00 00"
              aria-label="Nouveau numéro de téléphone"
              className={CHAMP}
            />
            <p className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Un mobile (06 ou 07) : un code de confirmation y sera envoyé par SMS.
            </p>
          </Bloc>
          <Bloc titre="Votre mot de passe actuel">
            <input
              type="password"
              autoComplete="current-password"
              value={motDePasse}
              onChange={e => { setMotDePasse(e.target.value); setErreur(null) }}
              placeholder="Pour confirmer que c’est bien vous"
              aria-label="Mot de passe actuel"
              className={CHAMP}
            />
            {erreur && <div className="mt-2"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          </Bloc>
        </form>
      )}
    </Feuille>
  )
}
