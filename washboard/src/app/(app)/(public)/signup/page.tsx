'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { normaliserMobile, PAYS_TELEPHONE, telephoneDuPays, type PaysTelephone } from '@/lib/phone'
import SelecteurPays from '@/components/entree/SelecteurPays'
import { paysOuverts } from '@/lib/paysInscription'
import Link from 'next/link'
import { useT } from '@/components/i18n/I18nProvider'
import {
  BarreActions, BoutonPrincipal, CadreEntree, Champ, Erreur, GaucheAccueil, GroupeChamps, Guide, LIEN_DISCRET, SAISIE, TitreEntree,
} from '@/components/entree/Entree'
import { trans } from '@/lib/i18n/trans'
import { JOURS_BONUS_FILLEUL, normaliserCode } from '@/lib/parrainage'
import { JOURS_ESSAI } from '@/lib/plan'

type VerifCode = { etat: 'vide' | 'verif' | 'indispo' | 'faux' } | { etat: 'ok'; parrain: string }

export default function SignupPage() {
  const t = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  // Le pays du téléphone (2026-11-14) : il lève l'ambiguïté d'un 079… suisse / 07… français, et fixe,
  // une fois le numéro confirmé par SMS, le format de l'identifiant d'entreprise du profil.
  const [pays, setPays] = useState<PaysTelephone>('FR')
  // Seuls les pays ouverts à l'inscription (lib/paysInscription : France, Belgique et Suisse, plus le
  // Luxembourg et le Québec quand ils sont allumés) sont proposés.
  const ouverts = paysOuverts()
  const proposes = PAYS_TELEPHONE.filter(p => ouverts.includes(p.code))
  const choixPays = proposes.find(p => p.code === pays) ?? proposes[0]
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [cgvAcceptees, setCgvAcceptees] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [codeParrain, setCodeParrain] = useState('')
  const [verif, setVerif] = useState<VerifCode>({ etat: 'vide' })
  const derniereVerif = useRef(0)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function verifierCode(brut: string) {
    const n = ++derniereVerif.current
    if (!brut.trim()) { setVerif({ etat: 'vide' }); return }
    const code = normaliserCode(brut)
    if (!code) { setVerif({ etat: 'faux' }); return }
    setVerif({ etat: 'verif' })
    try {
      const res = await fetch(`/api/parrainage/verifier?code=${encodeURIComponent(code)}`)
      const json = await res.json().catch(() => null)
      if (n !== derniereVerif.current) return
      if (!res.ok || !json) setVerif({ etat: 'indispo' })
      else setVerif(json.valide ? { etat: 'ok', parrain: json.parrain } : { etat: 'faux' })
    } catch {
      if (n === derniereVerif.current) setVerif({ etat: 'indispo' })
    }
  }

  function saisirCode(valeur: string) {
    setCodeParrain(valeur)
    if (minuteur.current) clearTimeout(minuteur.current)
    if (!valeur.trim()) { derniereVerif.current++; setVerif({ etat: 'vide' }); return }
    setVerif({ etat: 'verif' })
    if (normaliserCode(valeur)) minuteur.current = setTimeout(() => verifierCode(valeur), 400)
  }

  // Lien du parrain : /signup?parrain=CODE remplit le champ.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('parrain')
    if (code) { setCodeParrain(code); verifierCode(code) }
    return () => { if (minuteur.current) clearTimeout(minuteur.current) }
  }, [])

  const joursEssai = verif.etat === 'ok' ? JOURS_ESSAI + JOURS_BONUS_FILLEUL : JOURS_ESSAI
  const router = useRouter()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) { setError(t('Le nom de ton entreprise est requis')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Adresse email invalide'); return }
    // Le numéro est lu sous le pays choisi dans la liste, puis envoyé sous sa forme canonique.
    const telephone = telephoneDuPays(phone, pays)
    if (!telephone) { setError(t('Numéro de téléphone invalide pour {libelle} (ex. {exemple})', { libelle: choixPays.libelle, exemple: choixPays.exemple })); return }
    // Le code de confirmation arrive par SMS (2026-10-21) : un mobile, forcément.
    if (!normaliserMobile(telephone)) { setError(t('Il faut un numéro de mobile (ex. {exemple}) : le code de confirmation arrive par SMS.', { exemple: choixPays.exemple })); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 6) { setError(t('Le mot de passe doit contenir au moins 6 caractères')); return }
    if (codeParrain.trim() && verif.etat === 'faux') { setError(t('Ce code n’existe pas. Corrige-le ou laisse le champ vide.')); return }
    if (!cgvAcceptees) { setError(t('Merci d’accepter les CGV pour continuer')); return }
    setLoading(true)
    // Sans ce try, un serveur injoignable faisait rejeter le fetch en silence :
    // le bouton restait sur « Création du compte… » pour toujours.
    let res: Response
    try {
      res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone: telephone, cgv_acceptees: cgvAcceptees, code_parrain: codeParrain.trim() }),
      })
    } catch {
      setError(t('Connexion impossible. Vérifie ta connexion internet et réessaie.'))
      setLoading(false)
      return
    }
    if (!res.ok) {
      // Une erreur renvoyée par l'hébergeur plutôt que par la route n'est pas
      // du JSON : ne pas laisser `res.json()` lever à son tour.
      const json = await res.json().catch(() => null)
      setError(json?.error ?? t('Une erreur est survenue. Réessaie dans un instant.'))
      setLoading(false)
      return
    }
    // Pas de connexion ici : Supabase la refuse tant que l'inscription n'est pas
    // confirmée. Les deux derniers chiffres du numéro, pour que l'écran du code dise où
    // le SMS est parti.
    const fin = telephone.slice(-2)
    router.push(`/verifier-email?email=${encodeURIComponent(email.trim())}&tel=${fin}`)
  }

  return (
    <CadreEntree gauche={<GaucheAccueil />} retour={{ href: '/' }}>
      <form onSubmit={handleSignup} noValidate className="flex flex-col gap-5">
        <div>
          <Guide gens={['ryan']} texte={t('Bienvenue ! On s’occupe de l’organisation, toi des voitures.')} />
          <TitreEntree titre={t('Crée ton espace laveur')} sousTitre={t('14 jours gratuits, sans carte bancaire.')} />
        </div>

        <GroupeChamps>
          <Champ id="name" label={t('Nom de ton entreprise')}>
            <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={t('CleanCar')} autoComplete="organization" className={SAISIE} />
          </Champ>
          <Champ id="email" label={t('Email')}>
            <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder={t('toi@exemple.fr')} autoComplete="email" className={SAISIE} />
          </Champ>
          <Champ id="phone" label={t('Téléphone')} aide={<>{trans(t, 'Un code de confirmation t’arrive par SMS.{e0}Il sert aussi à te joindre en cas de souci.', { e0: <br /> })}</>}>
            <div className="flex items-center gap-2">
              <SelecteurPays valeur={pays} onChange={setPays} pays={proposes} />
              <input id="phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder={choixPays.exemple} autoComplete="tel-national" className={SAISIE} />
            </div>
          </Champ>
          <Champ id="password" label={t('Mot de passe')}>
            <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder={t('6 caractères minimum')} autoComplete="new-password" className={SAISIE} />
          </Champ>
          <Champ id="confirm" label={t('Confirmer le mot de passe')}>
            <PasswordInput id="confirm" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••" autoComplete="new-password" className={SAISIE} />
          </Champ>
          <Champ id="code-parrain" label={t('Code parrain (facultatif)')} aide={<AideCode verif={verif} />}>
            <input
              id="code-parrain"
              type="text"
              value={codeParrain}
              onChange={e => saisirCode(e.target.value)}
              onBlur={() => { if (minuteur.current) clearTimeout(minuteur.current); if (verif.etat !== 'ok') verifierCode(codeParrain) }}
              placeholder={t('Ex. NOM-AB12')}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={20}
              aria-invalid={verif.etat === 'faux'}
              className={`${SAISIE} uppercase`}
            />
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
            {t('J’ai lu et j’accepte les')}{' '}
            <Link href="/cgv" target="_blank" className="font-semibold text-[color:var(--v2-color-encre)] underline underline-offset-2">
              {t('conditions générales de vente')}
            </Link>
          </span>
        </label>

        {error && <Erreur texte={error} />}

        <BarreActions>
          <BoutonPrincipal type="submit" chargement={loading} libelleChargement={t('Création du compte…')}>{t('Lancer mes {n} jours gratuits', { n: joursEssai })}</BoutonPrincipal>
          <Link href="/login" className={`${LIEN_DISCRET} flex items-center justify-center`}>
            {t('Déjà un compte ?')}{t(' ')}<b className="font-semibold text-[color:var(--v2-color-encre)]">{t('Se connecter')}</b>
          </Link>
        </BarreActions>
      </form>
    </CadreEntree>
  )
}

function AideCode({ verif }: { verif: VerifCode }) {
  const t = useT()
  if (verif.etat === 'ok') {
    return <span role="status" className="font-semibold text-[color:var(--v2-color-vert)]">{t('Code de {parrain} : 2 semaines offertes, 28 jours d’essai', { parrain: verif.parrain })}</span>
  }
  if (verif.etat === 'faux') {
    return <span role="alert" className="font-semibold text-[color:var(--v2-color-rouge)]">{t('Ce code n’existe pas. Corrige-le ou laisse le champ vide.')}</span>
  }
  if (verif.etat === 'indispo') {
    return <span role="status">{t('Vérification impossible pour le moment : le code sera vérifié à l’inscription.')}</span>
  }
  return <span>{t('Ton parrain verra le nom de ton entreprise et l’avancement de ton inscription.')}</span>
}
