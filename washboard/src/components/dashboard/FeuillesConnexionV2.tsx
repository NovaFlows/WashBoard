'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Feuille, CHAMP, corps } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'
import { Bloc, Pied } from '@/components/dashboard/ReglageAutomatismeV2'
import { MOT_DE_PASSE_MIN, validerEmail, validerMotDePasse } from '@/lib/profil'

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
      fermerSurFond={false}
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
      fermerSurFond={false}
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
