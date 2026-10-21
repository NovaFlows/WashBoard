'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { isValidPhone, normalizePhone } from '@/lib/phone'
import Link from 'next/link'
import {
  BarreActions, BoutonPrincipal, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, Guide, LIEN_DISCRET, SAISIE, TitreEntree,
} from '@/components/entree/Entree'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [cgvAcceptees, setCgvAcceptees] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError('Le nom de ton entreprise est requis'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    if (!isValidPhone(phone)) { setError('Numéro de téléphone invalide (ex. 06 12 34 56 78)'); return }
    // Le code de confirmation arrive par SMS (2026-10-21) : un mobile, forcément.
    if (!/^0[67]/.test(normalizePhone(phone) ?? '')) { setError('Il faut un numéro de mobile (06 ou 07) : le code de confirmation arrive par SMS.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères'); return }
    if (!cgvAcceptees) { setError('Merci d’accepter les CGV pour continuer'); return }
    setLoading(true)
    // Sans ce try, un serveur injoignable faisait rejeter le fetch en silence :
    // le bouton restait sur « Création du compte… » pour toujours.
    let res: Response
    try {
      res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone, cgv_acceptees: cgvAcceptees }),
      })
    } catch {
      setError('Connexion impossible. Vérifie ta connexion internet et réessaie.')
      setLoading(false)
      return
    }
    if (!res.ok) {
      // Une erreur renvoyée par l'hébergeur plutôt que par la route n'est pas
      // du JSON : ne pas laisser `res.json()` lever à son tour.
      const json = await res.json().catch(() => null)
      setError(json?.error ?? 'Une erreur est survenue. Réessaie dans un instant.')
      setLoading(false)
      return
    }
    // Pas de connexion ici : Supabase la refuse tant que l'inscription n'est pas
    // confirmée. Les deux derniers chiffres du numéro, pour que l'écran du code dise où
    // le SMS est parti.
    const fin = (normalizePhone(phone) ?? '').slice(-2)
    router.push(`/verifier-email?email=${encodeURIComponent(email.trim())}&tel=${fin}`)
  }

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/' }}>
      <form onSubmit={handleSignup} noValidate className="flex flex-col gap-5">
        <div>
          <Guide gens={['ryan']} texte="Bienvenue ! On s’occupe de l’organisation, toi des voitures." />
          <TitreEntree titre="Crée ton espace laveur" sousTitre="1 mois gratuit, sans carte bancaire." />
        </div>

        <GroupeChamps>
          <Champ id="name" label="Nom de ton entreprise">
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="CleanCar" autoComplete="organization" className={SAISIE} />
          </Champ>
          <Champ id="email" label="Email">
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="toi@exemple.fr" autoComplete="email" className={SAISIE} />
          </Champ>
          <Champ id="phone" label="Téléphone" aide={<>Un code de confirmation t’arrive par SMS.<br />Il sert aussi à te joindre en cas de souci.</>}>
            <input id="phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="06 12 34 56 78" autoComplete="tel" className={SAISIE} />
          </Champ>
          <Champ id="password" label="Mot de passe">
            <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="6 caractères minimum" autoComplete="new-password" className={SAISIE} />
          </Champ>
          <Champ id="confirm" label="Confirmer le mot de passe">
            <PasswordInput id="confirm" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" autoComplete="new-password" className={SAISIE} />
          </Champ>
        </GroupeChamps>

        <label htmlFor="cgv" className="flex cursor-pointer items-start gap-2.5 text-[13px] text-[color:var(--v2-color-gris)]">
          <input
            id="cgv"
            type="checkbox"
            checked={cgvAcceptees}
            onChange={e => setCgvAcceptees(e.target.checked)}
            required
            className="mt-px h-5 w-5 shrink-0 accent-[color:var(--v2-color-encre)]"
          />
          <span>
            J’ai lu et j’accepte les{' '}
            <Link href="/cgv" target="_blank" className="font-semibold text-[color:var(--v2-color-encre)] underline underline-offset-2">
              conditions générales de vente
            </Link>
          </span>
        </label>

        {error && <Erreur texte={error} />}

        <BarreActions>
          <BoutonPrincipal type="submit" chargement={loading} libelleChargement="Création du compte…">Lancer mon mois gratuit</BoutonPrincipal>
          <Link href="/login" className={`${LIEN_DISCRET} flex items-center justify-center`}>
            Déjà un compte ?&nbsp;<b className="font-semibold text-[color:var(--v2-color-encre)]">Se connecter</b>
          </Link>
        </BarreActions>
      </form>
    </CadreEntree>
  )
}
