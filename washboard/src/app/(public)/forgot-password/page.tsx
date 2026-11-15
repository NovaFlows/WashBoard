'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useT } from '@/components/i18n/I18nProvider'
import {
  BarreActions, BoutonPrincipal, BOUTON_PRINCIPAL, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, LIEN_DISCRET, SAISIE, TitreEntree,
} from '@/components/entree/Entree'

export default function ForgotPasswordPage() {
  const t = useT()
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
    if (!res.ok) { setError(json.error ?? t('Une erreur est survenue.')); return }
    setSent(true)
  }

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/login' }}>
      {sent ? (
        <div className="flex flex-col gap-5">
          <TitreEntree titre={t('Email envoyé')} sousTitre={t('Lien envoyé à {email}', { email })} />
          <p className="flex items-start gap-2 text-sm">
            <span aria-hidden className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-[color:var(--v2-color-vert)]" />
            <span>
              {t('Clique sur le lien dans l’email pour créer un nouveau mot de passe.')}
              <span className="mt-1 block text-xs text-[color:var(--v2-color-gris)]">{t('Pense à vérifier tes spams.')}</span>
            </span>
          </p>
          <BarreActions>
            <Link href="/login" className={`${BOUTON_PRINCIPAL} flex items-center justify-center`}>{t('Retour à la connexion')}</Link>
          </BarreActions>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
          <TitreEntree titre={t('Mot de passe oublié')} sousTitre={t('Saisis ton email pour recevoir un lien de réinitialisation')} />

          <GroupeChamps>
            <Champ id="email" label={t('Email')}>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder={t('toi@exemple.fr')}
                autoComplete="email"
                className={SAISIE}
              />
            </Champ>
          </GroupeChamps>

          {error && <Erreur texte={error} />}

          <BarreActions>
            <BoutonPrincipal type="submit" disabled={!email.trim()} chargement={loading} libelleChargement="Envoi…">{t('Envoyer le lien')}</BoutonPrincipal>
            <Link href="/login" className={`${LIEN_DISCRET} flex items-center justify-center`}>
              {t('Tu te souviens ?')}{t(' ')}<b className="font-semibold text-[color:var(--v2-color-encre)]">{t('Se connecter')}</b>
            </Link>
          </BarreActions>
        </form>
      )}
    </CadreEntree>
  )
}
