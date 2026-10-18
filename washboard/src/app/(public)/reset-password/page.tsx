'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Spinner } from '@/components/ui/Spinner'
import {
  BarreActions, BoutonPrincipal, BOUTON_PRINCIPAL, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, SAISIE, TitreEntree,
} from '@/components/entree/Entree'

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [ready, setReady]         = useState(false)
  const [done, setDone]           = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Deux formats possibles selon la config Supabase :
  //  - implicit flow : tokens dans le hash (#access_token=...&refresh_token=...)
  //  - PKCE flow      : code dans la query (?code=xxx)
  // On établit explicitement la session pour que updateUser fonctionne.
  useEffect(() => {
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const params = new URLSearchParams(window.location.search)
    const accessToken  = hash.get('access_token')
    const refreshToken = hash.get('refresh_token')
    const code         = params.get('code')

    async function init() {
      // Implicit flow : on pose la session à partir des tokens du hash
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!error) { setReady(true); return }
      }

      // PKCE flow : échange du code contre une session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { setReady(true); return }
      }

      // Session déjà active ?
      const { data } = await supabase.auth.getSession()
      if (data.session) { setReady(true); return }

      setError('Lien invalide ou expiré. Recommencez la procédure.')
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('Le mot de passe doit faire au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError('Erreur lors de la mise à jour. Le lien a peut-être expiré.'); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/login' }}>
      {done ? (
        <div className="flex flex-col gap-3">
          <TitreEntree titre="Mot de passe mis à jour !" sousTitre="Redirection vers la connexion..." />
        </div>
      ) : !ready ? (
        error ? (
          <div className="flex flex-col gap-5">
            <TitreEntree titre="Nouveau mot de passe" />
            <Erreur texte={error} />
            <BarreActions>
              <Link href="/forgot-password" className={`${BOUTON_PRINCIPAL} flex items-center justify-center`}>Renvoyer un lien</Link>
            </BarreActions>
          </div>
        ) : (
          <div className="flex flex-col gap-5" role="status">
            <TitreEntree titre="Nouveau mot de passe" />
            <p className="flex items-center gap-2 text-sm text-[color:var(--v2-color-gris)]"><Spinner className="h-5 w-5" />Vérification du lien...</p>
          </div>
        )
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <TitreEntree titre="Nouveau mot de passe" sousTitre="Choisissez un nouveau mot de passe" />

          <GroupeChamps>
            <Champ id="nouveau" label="Nouveau mot de passe">
              <PasswordInput
                id="nouveau"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="6 caractères minimum"
                autoComplete="new-password"
                className={SAISIE}
              />
            </Champ>
            <Champ id="confirmation" label="Confirmer le mot de passe">
              <PasswordInput
                id="confirmation"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                className={SAISIE}
              />
            </Champ>
          </GroupeChamps>

          {error && <Erreur texte={error} />}

          <BarreActions>
            <BoutonPrincipal type="submit" chargement={loading} libelleChargement="Mise à jour...">Mettre à jour le mot de passe</BoutonPrincipal>
          </BarreActions>
        </form>
      )}
    </CadreEntree>
  )
}
