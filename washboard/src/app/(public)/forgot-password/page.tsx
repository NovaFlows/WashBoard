'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarreActions, BoutonPrincipal, BOUTON_PRINCIPAL, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, LIEN_DISCRET, SAISIE, TitreEntree,
} from '@/components/entree/Entree'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Une erreur est survenue.'); return }
    setSent(true)
  }

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/login' }}>
      {sent ? (
        <div className="flex flex-col gap-5">
          <TitreEntree titre="Email envoyé" sousTitre={`Lien envoyé à ${email}`} />
          <p className="flex items-start gap-2 text-sm">
            <span aria-hidden className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-[color:var(--v2-color-vert)]" />
            <span>
              Clique sur le lien dans l&apos;email pour créer un nouveau mot de passe.
              <span className="mt-1 block text-xs text-[color:var(--v2-color-gris)]">Pense à vérifier tes spams.</span>
            </span>
          </p>
          <BarreActions>
            <Link href="/login" className={`${BOUTON_PRINCIPAL} flex items-center justify-center`}>Retour à la connexion</Link>
          </BarreActions>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <TitreEntree titre="Mot de passe oublié" sousTitre="Saisis ton email pour recevoir un lien de réinitialisation" />

          <GroupeChamps>
            <Champ id="email" label="Email">
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="toi@exemple.fr"
                autoComplete="email"
                className={SAISIE}
              />
            </Champ>
          </GroupeChamps>

          {error && <Erreur texte={error} />}

          <BarreActions>
            <BoutonPrincipal type="submit" disabled={!email.trim()} chargement={loading} libelleChargement="Envoi…">Envoyer le lien</BoutonPrincipal>
            <Link href="/login" className={`${LIEN_DISCRET} flex items-center justify-center`}>
              Tu te souviens ?&nbsp;<b className="font-semibold text-[color:var(--v2-color-encre)]">Se connecter</b>
            </Link>
          </BarreActions>
        </form>
      )}
    </CadreEntree>
  )
}
