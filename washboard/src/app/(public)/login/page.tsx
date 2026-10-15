'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { etatOnboarding } from '@/lib/onboarding'
import { oublierVisite } from '@/lib/visiteGuidee'
import { PasswordInput } from '@/components/ui/PasswordInput'
import Link from 'next/link'
import {
  BarreActions, BoutonPrincipal, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, LIEN_DISCRET, SAISIE, TitreEntree,
} from '@/components/entree/Entree'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    if (!password) { setError('Mot de passe requis'); return }
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Supabase ne répond `email_not_confirmed` qu'une fois le mot de passe
      // validé : pas besoin de le revérifier avant d'afficher /verifier-email.
      if (error.code === 'email_not_confirmed') {
        router.push(`/verifier-email?email=${encodeURIComponent(email.trim())}`)
        return
      }
      setError('Email ou mot de passe incorrect'); setLoading(false); return
    }
    const { destination } = await etatOnboarding(supabase, data.user.id)
    oublierVisite()
    router.push(destination)
    router.refresh()
  }

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/' }}>
      <form onSubmit={handleLogin} noValidate className="flex flex-col gap-5">
        <TitreEntree titre="Content de te revoir" sousTitre="Connecte-toi pour retrouver ta journée." />

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
          <Champ id="password" label="Mot de passe">
            <PasswordInput
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              className={SAISIE}
            />
          </Champ>
        </GroupeChamps>

        <Link href="/forgot-password" className={`${LIEN_DISCRET} self-start`}>Mot de passe oublié ?</Link>

        {error && <Erreur texte={error} />}

        <BarreActions>
          <BoutonPrincipal type="submit" chargement={loading} libelleChargement="Connexion…">Se connecter</BoutonPrincipal>
          <Link href="/signup" className={`${LIEN_DISCRET} flex items-center justify-center`}>
            Pas encore de compte ?&nbsp;<b className="font-semibold text-[color:var(--v2-color-encre)]">1 mois d’essai gratuit</b>
          </Link>
        </BarreActions>
      </form>
    </CadreEntree>
  )
}
