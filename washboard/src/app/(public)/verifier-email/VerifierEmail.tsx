'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { oublierVisite } from '@/lib/visiteGuidee'
import {
  BOUTON_SECONDAIRE, BarreActions, BoutonPrincipal, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, LIEN_DISCRET, SAISIE, TitreEntree,
} from '@/components/entree/Entree'

type Message = { type: 'ok' | 'erreur'; texte: string } | null

// Le code arrive par SMS depuis le 2026-10-21 (`lib/codeSms`), plus par email : 6 chiffres.
const LONGUEUR_CODE = 6

async function appeler(url: string, corps: Record<string, string>): Promise<{ ok: boolean; erreur: string | null }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    if (res.ok) return { ok: true, erreur: null }
    const json = await res.json().catch(() => null)
    return { ok: false, erreur: json?.error ?? 'Une erreur est survenue. Réessaie dans un instant.' }
  } catch {
    return { ok: false, erreur: 'Connexion impossible. Vérifie ta connexion internet et réessaie.' }
  }
}

// « Un SMS vient de partir, attends X s » n'est pas une erreur : l'inscrit
// n'a rien fait de mal, il a juste redemandé un peu tôt. Un message rouge lui
// ferait croire à un problème de sa part — traitement neutre à la place.
function estPatience(texte: string) {
  return texte.startsWith('Un SMS vient de partir')
}

function Alerte({ message }: { message: NonNullable<Message> }) {
  if (message.type === 'erreur' && !estPatience(message.texte)) return <Erreur texte={message.texte} />
  const ok = message.type === 'ok'
  return (
    <p role="status" className={`flex items-start gap-2 text-sm ${ok ? 'text-[color:var(--v2-color-vert)]' : 'text-[color:var(--v2-color-gris)]'}`}>
      <span aria-hidden className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
      {message.texte}
    </p>
  )
}

/** Le code en cases : un seul vrai champ (collage, remplissage automatique du code reçu
 *  par SMS/email sur iPhone) posé en transparent sur les cases dessinées. */
function CasesCode({ code, onChange, desactive, valide }: { code: string; onChange: (v: string) => void; desactive: boolean; valide: boolean }) {
  const [focus, setFocus] = useState(false)
  return (
    <div className="relative">
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" aria-hidden>
        {Array.from({ length: LONGUEUR_CODE }, (_, i) => {
          const actif = focus && (i === code.length || (i === LONGUEUR_CODE - 1 && code.length === LONGUEUR_CODE))
          return (
            <span
              key={i}
              style={valide ? { animationDelay: `${i * 45}ms` } : undefined}
              className={`flex h-14 items-center justify-center rounded-[var(--v2-radius-bouton)] border bg-[color:var(--v2-color-surface)] text-[24px] font-[650] tabular-nums [font-stretch:112%] ${actif ? 'border-[color:var(--v2-color-encre)]' : 'border-[color:var(--v2-filet-fort)]'} ${valide ? 'wb-entree-case-ok' : ''}`}
            >
              {code[i] ?? ''}
            </span>
          )
        })}
      </div>
      <input
        id="code-confirmation"
        aria-label="Code reçu par SMS"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={LONGUEUR_CODE}
        value={code}
        onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, LONGUEUR_CODE))}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        required
        disabled={desactive}
        autoFocus
        className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent !shadow-none !outline-none !ring-0 [font-size:16px]"
      />
    </div>
  )
}

export default function VerifierEmail({ email, finTelephone, lienInvalide }: {
  email: string | null
  /** Les deux derniers chiffres du numéro, posés par /signup ; absents depuis /login. */
  finTelephone: string | null
  lienInvalide: boolean
}) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [verification, setVerification] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState<Message>(null)
  const [confirmerRecommencer, setConfirmerRecommencer] = useState(false)
  const [suppression, setSuppression] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const etat = email ? 'attente' : 'sans-inscription'

  async function verifier(valeur: string) {
    if (!email || valeur.length !== LONGUEUR_CODE) return
    setVerification(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/confirm-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: valeur }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.destination) {
        oublierVisite()
        router.push(json.destination)
        router.refresh()
        return
      }
      setMessage({ type: 'erreur', texte: json?.error ?? 'Une erreur est survenue. Réessaie dans un instant.' })
    } catch {
      setMessage({ type: 'erreur', texte: 'Connexion impossible. Vérifie ta connexion internet et réessaie.' })
    }
    setVerification(false)
  }

  // Le dernier chiffre tapé (ou un code collé en entier) lance la vérification : plus besoin
  // d'aller chercher le bouton.
  function saisir(valeur: string) {
    setCode(valeur)
    if (valeur.length === LONGUEUR_CODE && !verification) void verifier(valeur)
  }

  async function renvoyer() {
    if (!email) return
    setEnvoi(true)
    setMessage(null)
    setCode('')
    const { ok, erreur } = await appeler('/api/auth/resend-confirmation', { email })
    setMessage(ok
      ? { type: 'ok', texte: 'Code renvoyé par SMS. Il peut mettre une minute à arriver.' }
      : { type: 'erreur', texte: erreur! })
    setEnvoi(false)
  }

  async function recommencer(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !motDePasse) return
    setSuppression(true)
    setMessage(null)
    const { ok, erreur } = await appeler('/api/auth/restart-signup', { email, password: motDePasse })
    if (ok) { router.push('/signup'); return }
    setMessage({ type: 'erreur', texte: erreur! })
    setSuppression(false)
  }

  const avertissementLien = lienInvalide && (
    <Erreur texte={etat === 'attente'
      ? 'Ce lien de confirmation n’est plus valable : il a déjà servi ou il a expiré. Demande-en un nouveau ci-dessous.'
      : 'Ce lien de confirmation n’est plus valable : il a déjà servi ou il a expiré. Si ton email est déjà confirmé, connecte-toi.'}
    />
  )

  if (etat === 'sans-inscription') {
    return (
      <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/login' }}>
        <div className="flex flex-col gap-5">
          <TitreEntree titre="Confirme ton inscription" />
          {avertissementLien}
          <p className="text-sm text-[color:var(--v2-color-gris)]">
            Aucune inscription en attente à afficher. Connecte-toi avec ton email et ton mot de passe :
            si ton inscription reste à confirmer, tu reviendras sur cette page.
          </p>
          <BarreActions>
            <Link
              href="/login"
              className="wb-entree-bouton flex min-h-[50px] w-full items-center justify-center rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-color-accent)] text-base font-semibold text-[color:var(--v2-color-sur-accent)]"
            >
              Se connecter
            </Link>
            <Link href="/signup" className={`${LIEN_DISCRET} flex items-center justify-center`}>
              Pas encore de compte ?&nbsp;<b className="font-semibold text-[color:var(--v2-color-encre)]">S’inscrire</b>
            </Link>
          </BarreActions>
        </div>
      </CadreEntree>
    )
  }

  const occupe = envoi || verification || suppression

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/signup' }}>
      <div className="flex flex-col gap-5">
        <TitreEntree
          titre="Confirme ton numéro"
          sousTitre={<>On vient d’envoyer un code à {LONGUEUR_CODE} chiffres par SMS {finTelephone
            ? <>au numéro finissant par <strong className="font-semibold text-[color:var(--v2-color-encre)]">{finTelephone}</strong></>
            : 'au numéro donné à l’inscription'}.</>}
        />
        {avertissementLien}

        <form onSubmit={e => { e.preventDefault(); void verifier(code) }} noValidate className="flex flex-col gap-3">
          <CasesCode code={code} onChange={saisir} desactive={verification} valide={verification} />
          <p className="text-[13px] text-[color:var(--v2-color-gris)]">
            Rien reçu au bout d’une minute ?{' '}
            <button type="button" onClick={renvoyer} disabled={occupe} className="underline underline-offset-2 disabled:opacity-40">
              {envoi ? 'envoi…' : 'Renvoie le code'}
            </button>.
          </p>
          {message && <Alerte message={message} />}

          {!confirmerRecommencer ? (
            <BarreActions>
              <BoutonPrincipal type="submit" disabled={code.length !== LONGUEUR_CODE} chargement={verification} libelleChargement="Vérification…">
                Valider
              </BoutonPrincipal>
              {/* Volontairement discret : cette action supprime le compte en attente. */}
              <button
                type="button"
                onClick={() => { setConfirmerRecommencer(true); setMessage(null) }}
                disabled={occupe}
                className={LIEN_DISCRET}
              >
                Mauvais numéro ? Recommencer l’inscription
              </button>
            </BarreActions>
          ) : null}
        </form>

        {confirmerRecommencer && (
          <form onSubmit={recommencer} noValidate className="flex flex-col gap-3">
            <p className="text-sm text-[color:var(--v2-color-gris)]">
              Ton inscription en attente sera supprimée, et tu pourras t’inscrire à nouveau avec le bon numéro.
            </p>
            <GroupeChamps>
              <Champ id="mot-de-passe-recommencer" label="Confirme ton mot de passe pour supprimer ce compte">
                <input
                  id="mot-de-passe-recommencer"
                  type="password"
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={suppression}
                  className={SAISIE}
                />
              </Champ>
            </GroupeChamps>
            <BarreActions>
              <button
                type="submit"
                disabled={suppression || !motDePasse}
                className="wb-entree-bouton min-h-[50px] w-full rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-color-rouge)] text-base font-semibold text-white disabled:opacity-35"
              >
                {suppression ? 'Suppression…' : 'Supprimer et recommencer'}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmerRecommencer(false); setMotDePasse('') }}
                disabled={suppression}
                className={BOUTON_SECONDAIRE}
              >
                Annuler
              </button>
            </BarreActions>
          </form>
        )}
      </div>
    </CadreEntree>
  )
}
