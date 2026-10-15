'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Spinner } from '@/components/ui/Spinner'
import { SITE_URL_FALLBACK } from '@/lib/plan'
import { PHRASE_SLUG_INVALIDE, generateSlug, slugValide } from '@/lib/slug'
import { enregistrerSlug } from '@/lib/lienReservation'
import { enregistrerProfil } from '@/lib/profilApi'
import { appeler } from '@/lib/prestationsApi'
import { QUESTIONS_FACULTATIVES, QUESTIONS_OBLIGATOIRES, SOURCES_ACQUISITION, questionsObligatoiresRepondues, type ProfilActivite, type QuestionActivite, type SourceAcquisition } from '@/lib/onboarding'
import AddressAutocomplete from '@/components/ui/AddressAutocomplete'
import { estImageAcceptee } from '@/lib/apparence'
import { retirerLeFond } from '@/hooks/retirerLeFond'
import { compressImage, LOGO_OPTIONS } from '@/lib/imageCompression'
import { envoyerImage } from '@/lib/apparenceApi'
import { EtatEnvoi } from '@/components/dashboard/ApparenceUiV2'
import type { EtatImage } from '@/hooks/useApparenceV2'
import {
  BarreActions, BoutonPrincipal, CadreEntree, Champ, Erreur, GroupeChamps, Guide, LIEN_DISCRET, SAISIE,
  TOTAL_ETAPES_ONBOARDING, TitreEntree,
} from '@/components/entree/Entree'
import { CarteZones, Mousse } from '@/components/entree/AnimationsEntree'

// Onboarding : 5 étapes, puis un écran de fin « Ton espace est prêt ».
//
// Ordre choisi le 2026-10-11 (Ryan a demandé l'ajout de l'adresse de départ et du logo,
// « je te laisse le choix de l'ordre ») — lien, adresse, logo, puis l'activité. Adresse et
// logo étaient auparavant des arrêts `interactif` du tuto guidé (visiteGuidee.ts) ; les
// déplacer ici évite de les faire découvrir une seconde fois une fois dans le tableau de
// bord. Le téléphone, lui, n'a jamais eu besoin d'y être : déjà posé à l'inscription.
//
// Prestations et horaires, les deux autres réglages réellement bloquants
// (`computeSetupProgress`, setupProgress.ts), restent volontairement hors de l'onboarding :
// pas un simple champ à remplir, un vrai travail — les imposer avant que le laveur ait vu
// l'application risquerait de le faire fuir. Le tuto gère déjà bien ce cas, décision
// confirmée avec Ryan avant d'implémenter.
//
// Étapes 4 et 5 (2026-10-13) : les questions sur l'activité, obligatoires à l'étape 4,
// facultatives à l'étape 5 avec « Comment as-tu connu WashBoard ? ». Tout part en un seul
// envoi à la fin de l'étape 5.
//
// Habillage v2 et animations (2026-10-15), d'après la maquette validée par Alexandre :
// https://claude.ai/artifact/BPYytpi93EeXs1JtUadKph — l'écran glisse dans le sens où l'on
// avance, la progression se remplit, l'équipe apparaît en stickers avec une bulle, une carte
// des zones accompagne l'adresse, et des bulles de mousse saluent la fin.

const DOMAINE = SITE_URL_FALLBACK.replace(/^https?:\/\/(www\.)?/, '')
type Etape = 1 | 2 | 3 | 4 | 5 | 6
const PRET: Etape = 6

type Verification = { slug: string; etat: 'libre' | 'pris' | 'erreur'; message?: string }
type Disponibilite = 'actuel' | 'invalide' | 'verification' | Verification['etat']

async function verifier(slug: string, signal: AbortSignal): Promise<Verification> {
  try {
    const res = await fetch(`/api/washer/slug?slug=${encodeURIComponent(slug)}`, { signal })
    const json = await res.json().catch(() => null)
    if (res.ok) return { slug, etat: json?.disponible ? 'libre' : 'pris' }
    if (res.status === 401) return { slug, etat: 'erreur', message: 'Ta session a expiré. Reconnecte-toi.' }
    return { slug, etat: 'erreur', message: json?.error ?? 'Vérification impossible. Réessaie dans un instant.' }
  } catch {
    return { slug, etat: 'erreur', message: 'Vérification impossible. Vérifie ta connexion internet.' }
  }
}

const REPOS_LOGO: EtatImage = { phase: 'repos', attenteLongue: false, erreur: null }
const DELAI_ATTENTE_LONGUE_MS = 6000

const ETAPES: Record<Exclude<Etape, 6>, { titre: string; sousTitre: string; parcours: string; facultative?: boolean }> = {
  1: { titre: 'Ton lien de réservation', sousTitre: 'C’est l’adresse que tes clients utiliseront pour réserver.', parcours: 'Ton lien' },
  2: { titre: 'Ton adresse de départ', sousTitre: 'Elle sert à calculer la distance jusqu’à tes clients, et tes frais de déplacement.', parcours: 'Ton adresse' },
  3: { titre: 'Ton logo', sousTitre: 'Il habille ta page de réservation, pour qu’on te reconnaisse du premier coup d’œil.', parcours: 'Ton logo' },
  4: { titre: 'Ton activité', sousTitre: 'Six questions pour mieux t’accompagner. Une touche par réponse.', parcours: 'Ton activité' },
  5: { titre: 'C’est presque fini', sousTitre: 'Plus que quelques petites questions, toutes facultatives. Réponds à ce que tu veux, puis c’est terminé.', parcours: 'Dernières questions', facultative: true },
}

const PASTILLE = 'wb-entree-bouton min-h-10 rounded-full border px-3.5 text-sm font-medium disabled:opacity-40'
const PASTILLE_CHOISIE = 'border-[color:var(--v2-color-encre)] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-fond)]'
const PASTILLE_LIBRE = 'border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)]'

function Question({ q, reponse, onChoisir, disabled, derniere }: {
  q: QuestionActivite
  reponse: string | string[] | undefined
  onChoisir: (valeur: string) => void
  disabled: boolean
  derniere: string | null
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-[15px] font-semibold">
        {q.question}
        {q.multiple && <span className="font-normal text-[color:var(--v2-color-gris)]"> plusieurs choix</span>}
      </legend>
      <div className="flex flex-wrap gap-[7px]">
        {q.choix.map(x => {
          const choisi = Array.isArray(reponse) ? reponse.includes(x.valeur) : reponse === x.valeur
          return (
            <button
              key={x.valeur}
              type="button"
              aria-pressed={choisi}
              onClick={() => onChoisir(x.valeur)}
              disabled={disabled}
              className={`${PASTILLE} ${choisi ? PASTILLE_CHOISIE : PASTILLE_LIBRE} ${choisi && derniere === `${q.cle}:${x.valeur}` ? 'wb-entree-pop' : ''}`}
            >
              {x.libelle}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function Vignette({ logoUrl, nom, grande }: { logoUrl: string | null; nom: string; grande?: boolean }) {
  const taille = grande ? 'h-[88px] w-[88px] rounded-[18px] text-[34px]' : 'h-11 w-11 rounded-[11px] text-[19px]'
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- adresse Supabase, comme Apparence
    return <img src={logoUrl} alt="Ton logo" className={`${taille} shrink-0 border border-[color:var(--v2-filet-fort)] object-cover`} />
  }
  return (
    <div aria-hidden className={`${taille} flex shrink-0 select-none items-center justify-center border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-fond)] font-semibold text-[color:var(--v2-color-gris)]`}>
      {(nom || '?').charAt(0).toUpperCase()}
    </div>
  )
}

/** `etapeInitiale` : uniquement pour le banc d'essai de développement (`/dev/booking-preview?mode=onboarding`) ;
 *  la vraie page part toujours de l'étape 1. */
export default function Onboarding({ slug, nom, etapeInitiale = 1 }: { slug: string; nom: string; etapeInitiale?: Etape }) {
  const router = useRouter()
  const [etape, setEtape] = useState<Etape>(etapeInitiale)
  // Sens du dernier changement d'étape : l'écran glisse dans ce sens. Nul au premier rendu.
  const [sens, setSens] = useState<'av' | 'ar' | null>(null)
  function allerA(suivante: Etape) {
    setSens(suivante > etape ? 'av' : 'ar')
    setEtape(suivante)
    setErreur(null)
    window.scrollTo({ top: 0 })
  }

  // Étape 1 — lien de réservation.
  const [slugEnregistre, setSlugEnregistre] = useState(slug)
  const [saisie, setSaisie] = useState(slug)
  const [verification, setVerification] = useState<Verification | null>(null)

  // Étape 2 — adresse de départ.
  const [adresse, setAdresse] = useState('')

  // Étape 3 — logo. `etatLogo` reprend `EtatImage` (useApparenceV2) pour réutiliser
  // `EtatEnvoi` tel quel ; avance toute seule vers l'étape 4 une fois l'envoi réussi
  // (« Plus tard » fait pareil sans rien envoyer).
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [etatLogo, setEtatLogo] = useState<EtatImage>(REPOS_LOGO)
  const inputLogo = useRef<HTMLInputElement>(null)
  const minuteurLogo = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (minuteurLogo.current) clearTimeout(minuteurLogo.current) }, [])

  // Étapes 4 et 5 — l'activité, puis comment as-tu connu WashBoard.
  const [source, setSource] = useState<SourceAcquisition | null>(null)
  const [profil, setProfil] = useState<ProfilActivite>({})
  const [derniere, setDerniere] = useState<string | null>(null)
  function choisirReponse(q: QuestionActivite, valeur: string) {
    setDerniere(`${q.cle}:${valeur}`)
    const cle = q.cle
    setProfil(p => {
      const actuel = p[cle]
      if (q.multiple) {
        const liste = Array.isArray(actuel) ? actuel : []
        const suivant = liste.includes(valeur) ? liste.filter(v => v !== valeur) : [...liste, valeur]
        return { ...p, [cle]: suivant }
      }
      // Retoucher la réponse déjà choisie la retire : une question facultative doit pouvoir
      // redevenir sans réponse. Pas une obligatoire : rien à y gagner, sauf bloquer le bouton.
      if (actuel === valeur && q.facultative) { const reste = { ...p }; delete reste[cle]; return reste }
      return { ...p, [cle]: valeur }
    })
  }
  const obligatoiresOk = questionsObligatoiresRepondues(profil)
  const nbRepondues = QUESTIONS_OBLIGATOIRES.filter(q => {
    const v = profil[q.cle]
    return Array.isArray(v) ? v.length > 0 : !!v
  }).length
  // Un reflet traverse le bouton au moment où la dernière réponse obligatoire est donnée
  // (état ajusté pendant le rendu, motif recommandé par React plutôt qu'un effet).
  const [obligatoiresOkAvant, setObligatoiresOkAvant] = useState(obligatoiresOk)
  const [brille, setBrille] = useState(false)
  if (obligatoiresOkAvant !== obligatoiresOk) {
    setObligatoiresOkAvant(obligatoiresOk)
    setBrille(obligatoiresOk)
  }

  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [copie, setCopie] = useState(false)

  // Le lien actuel est repris tel quel : un lien généré à l'inscription peut
  // dépasser 40 caractères (nom tronqué à 40 + suffixe), et le repasser dans
  // `generateSlug` le raccourcirait — le laveur ne pourrait plus le garder.
  const candidat = saisie.trim() === slugEnregistre ? slugEnregistre : generateSlug(saisie)

  let disponibilite: Disponibilite
  if (candidat === slugEnregistre) disponibilite = 'actuel'
  else if (!slugValide(candidat)) disponibilite = 'invalide'
  else if (verification?.slug === candidat) disponibilite = verification.etat
  else disponibilite = 'verification'

  useEffect(() => {
    if (disponibilite !== 'verification') return
    const controleur = new AbortController()
    const minuteur = setTimeout(async () => {
      const resultat = await verifier(candidat, controleur.signal)
      if (!controleur.signal.aborted) setVerification(resultat)
    }, 400)
    return () => { clearTimeout(minuteur); controleur.abort() }
  }, [candidat, disponibilite])

  async function validerLien(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    if (disponibilite === 'actuel') { allerA(2); return }
    if (disponibilite !== 'libre') return
    setEnvoi(true)
    const r = await enregistrerSlug(candidat)
    setEnvoi(false)
    if (!r.ok) { setErreur(r.message); return }
    setSlugEnregistre(candidat)
    setSaisie(candidat)
    allerA(2)
  }

  async function validerAdresse(e: React.FormEvent) {
    e.preventDefault()
    const valeur = adresse.trim()
    if (!valeur) return
    setErreur(null)
    setEnvoi(true)
    const r = await enregistrerProfil({ base_address: valeur })
    setEnvoi(false)
    if (!r.ok) { setErreur(r.message); return }
    allerA(3)
  }

  async function choisirLogo(fichier: File) {
    if (!estImageAcceptee(fichier.type)) {
      setEtatLogo({ phase: 'echec', attenteLongue: false, erreur: 'Ce fichier n’est pas une image. Choisis un logo en JPG, PNG ou WebP.' })
      return
    }
    setEtatLogo({ phase: 'detourage', attenteLongue: false, erreur: null })
    minuteurLogo.current = setTimeout(
      () => setEtatLogo(l => (l.phase === 'detourage' ? { ...l, attenteLongue: true } : l)),
      DELAI_ATTENTE_LONGUE_MS,
    )
    try {
      let detoure: Blob
      try {
        detoure = await retirerLeFond(fichier)
      } catch {
        setEtatLogo({ phase: 'echec', attenteLongue: false, erreur: 'Le fond n’a pas pu être retiré. Vérifie ta connexion (un modèle se télécharge la première fois) puis réessaie.' })
        return
      }
      if (minuteurLogo.current) clearTimeout(minuteurLogo.current)
      setEtatLogo({ phase: 'envoi', attenteLongue: false, erreur: null })
      const reduit = await compressImage(new File([detoure], 'logo.png', { type: 'image/png' }), LOGO_OPTIONS)
      const r = await envoyerImage('logo', reduit)
      if (!r.ok) { setEtatLogo({ phase: 'echec', attenteLongue: false, erreur: r.message }); return }
      setLogoUrl(r.data)
      setEtatLogo({ phase: 'fait', attenteLongue: false, erreur: null })
      allerA(4)
    } finally {
      if (minuteurLogo.current) clearTimeout(minuteurLogo.current)
    }
  }

  async function terminer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    setEnvoi(true)
    const r = await appeler('enregistrer', 'POST', '/api/washer/onboarding', { acquisition_source: source ?? undefined, profil_activite: profil })
    setEnvoi(false)
    if (!r.ok) { setErreur(r.message); return }
    allerA(PRET)
  }

  function ouvrirTableauDeBord() {
    setEnvoi(true)
    router.push('/dashboard')
    router.refresh()
  }

  const lienComplet = `${DOMAINE}/book/${slugEnregistre}`
  async function copierLien() {
    try {
      await navigator.clipboard.writeText(`https://${lienComplet}`)
      setCopie(true)
    } catch { /* presse-papiers refusé : le lien reste lisible et sélectionnable */ }
  }

  const couleurEtat = disponibilite === 'libre'
    ? 'text-[color:var(--v2-color-vert)]'
    : disponibilite === 'invalide' || disponibilite === 'pris' || disponibilite === 'erreur'
      ? 'text-[color:var(--v2-color-rouge)]'
      : 'text-[color:var(--v2-color-gris)]'
  const point = disponibilite === 'libre' || disponibilite === 'pris' || disponibilite === 'invalide' || disponibilite === 'erreur'

  const occupeLogo = etatLogo.phase === 'detourage' || etatLogo.phase === 'envoi'
  const info = etape === PRET ? null : ETAPES[etape as Exclude<Etape, 6>]

  // ── Colonne de gauche sur ordinateur : le parcours, puis la page de réservation qui se
  // construit au fil des réponses.
  const gauche = (
    <>
      <ol className="flex flex-col">
        {([1, 2, 3, 4, 5] as const).map(n => {
          const fait = n < etape
          const ici = n === etape
          return (
            <li key={n} className={`grid grid-cols-[22px_1fr] items-center gap-3 border-b border-[color:var(--v2-filet)] py-2.5 text-sm last:border-b-0 ${fait || ici ? 'text-[color:var(--v2-color-encre)]' : 'text-[color:var(--v2-color-gris)]'} ${ici ? 'font-semibold' : ''}`}>
              <span
                aria-hidden
                className={`h-[9px] w-[9px] justify-self-center rounded-full border-[1.5px] ${fait ? 'border-[color:var(--v2-color-encre)] bg-[color:var(--v2-color-encre)]' : ici ? 'border-[color:var(--v2-color-accent)] bg-[color:var(--v2-color-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--v2-color-accent)_22%,transparent)]' : 'border-[color:var(--v2-color-gris)]'}`}
              />
              <span>
                {ETAPES[n].parcours}
                {ETAPES[n].facultative && <small className="ml-1.5 font-normal text-[color:var(--v2-color-gris)]">facultatif</small>}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="mt-auto flex flex-col gap-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
        <p className="flex justify-between text-xs text-[color:var(--v2-color-gris)]">
          <span>Ta page de réservation</span><span>se remplit au fil des étapes</span>
        </p>
        <div className="flex items-center gap-3">
          <Vignette logoUrl={logoUrl} nom={nom} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{nom || 'Ton entreprise'}</p>
            <p className="break-all text-xs text-[color:var(--v2-color-accent)]">{DOMAINE}/book/{candidat || '…'}</p>
          </div>
        </div>
        <p className="flex justify-between gap-3 border-t border-[color:var(--v2-filet)] pt-2.5 text-[13px]">
          <span className="text-[color:var(--v2-color-gris)]">Départ</span>
          <span className="min-w-0 text-right">{adresse.trim() || '—'}</span>
        </p>
      </div>
    </>
  )

  const retour = etape === 1 || etape === PRET ? null : { onClick: () => allerA((etape - 1) as Etape), desactive: envoi || occupeLogo }

  return (
    <CadreEntree
      gauche={gauche}
      retour={retour}
      etape={etape === PRET ? TOTAL_ETAPES_ONBOARDING : etape}
      etapeNeuve={sens === 'av'}
      largeur={etape >= 4 ? 'large' : 'etroite'}
    >
      {etape === PRET && <Mousse />}
      <div key={etape} className={sens ? `wb-entree-vue-${sens}` : ''}>
        {info && (
          <div className="mb-5">
            {etape === 1 && <Guide gens={['rectangles']} texte="Choisis un lien facile à dire au téléphone." />}
            {etape === 4 && <Guide gens={['rondes']} texte="Ça nous aide à te conseiller. Une touche par réponse, c’est rapide." />}
            <TitreEntree
              titre={info.titre}
              sousTitre={info.sousTitre}
              surTitre={
                <>
                  {info.facultative && (
                    <p className="mb-2.5 flex items-center gap-[7px] text-[13px] font-[550] text-[color:var(--v2-color-vert)]">
                      <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-current" />Dernière étape
                    </p>
                  )}
                  <p className="mb-2 hidden text-[13px] tabular-nums text-[color:var(--v2-color-gris)] lg:block">Étape {etape} sur {TOTAL_ETAPES_ONBOARDING}</p>
                </>
              }
            />
          </div>
        )}

        {etape === 1 && (
          <form onSubmit={validerLien} noValidate className="flex flex-col gap-4">
            <GroupeChamps>
              <Champ id="slug" label="Personnalise ton lien">
                <div className="flex items-baseline text-base">
                  <span className="whitespace-nowrap text-[color:var(--v2-color-gris)]">{DOMAINE}/book/</span>
                  <input
                    id="slug"
                    type="text"
                    value={saisie}
                    onChange={e => { setSaisie(e.target.value); setErreur(null) }}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={60}
                    disabled={envoi}
                    aria-describedby="etat-lien"
                    className={SAISIE}
                  />
                </div>
              </Champ>
            </GroupeChamps>

            <p id="etat-lien" role="status" aria-live="polite" className={`flex min-h-5 items-center gap-[7px] text-[13px] ${couleurEtat}`}>
              {point && <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full bg-current" />}
              {disponibilite === 'actuel' && 'C’est ton lien actuel. Tu pourras le changer plus tard dans tes réglages.'}
              {disponibilite === 'invalide' && PHRASE_SLUG_INVALIDE}
              {disponibilite === 'verification' && <span className="inline-flex items-center gap-1.5"><Spinner />Vérification…</span>}
              {disponibilite === 'libre' && 'Disponible'}
              {disponibilite === 'pris' && 'Ce lien est déjà utilisé. Choisis-en un autre.'}
              {disponibilite === 'erreur' && verification?.message}
            </p>

            {erreur && <Erreur texte={erreur} />}

            <BarreActions>
              <BoutonPrincipal type="submit" chargement={envoi} libelleChargement="Enregistrement…" disabled={disponibilite !== 'actuel' && disponibilite !== 'libre'}>
                Continuer
              </BoutonPrincipal>
            </BarreActions>
          </form>
        )}

        {etape === 2 && (
          <form onSubmit={validerAdresse} noValidate className="flex flex-col gap-4">
            <GroupeChamps>
              <Champ id="adresse" label="Ton adresse">
                <AddressAutocomplete
                  id="adresse"
                  value={adresse}
                  onChange={v => { setAdresse(v); setErreur(null) }}
                  placeholder="12 rue de la Paix, 75001 Paris"
                  className={SAISIE}
                />
              </Champ>
            </GroupeChamps>
            <CarteZones adressePosee={!!adresse.trim()} />
            <p className="text-xs text-[color:var(--v2-color-gris)]">
              Exemple de zones : tu régleras tes vrais tarifs de déplacement plus tard. Ton adresse n’est jamais montrée à tes clients.
            </p>

            {erreur && <Erreur texte={erreur} />}

            <BarreActions>
              <BoutonPrincipal type="submit" chargement={envoi} libelleChargement="Enregistrement…" disabled={!adresse.trim()}>
                Continuer
              </BoutonPrincipal>
              <button type="button" onClick={() => allerA(1)} disabled={envoi} className={`${LIEN_DISCRET} hidden lg:block`}>
                Revenir au lien
              </button>
            </BarreActions>
          </form>
        )}

        {etape === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
              {etatLogo.phase === 'detourage' ? (
                <div aria-hidden className="wb-entree-detourage relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[18px] border border-[color:var(--v2-filet-fort)]" />
              ) : (
                <Vignette logoUrl={logoUrl} nom={nom} grande />
              )}
              <p className="min-w-0 text-sm leading-snug text-[color:var(--v2-color-gris)]">
                {logoUrl
                  ? 'Il est affiché en petit carré : les bords d’une image large sont coupés.'
                  : 'Pas encore de logo : tes clients voient la première lettre de ton nom.'}
              </p>
            </div>

            <p className="text-xs leading-snug text-[color:var(--v2-color-gris)]">
              Le fond de l’image est retiré automatiquement. La première fois, c’est un peu plus long.
            </p>

            <div className="min-h-[22px]" aria-live="polite">
              <EtatEnvoi etat={etatLogo} />
            </div>

            <input
              ref={inputLogo}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) choisirLogo(f); e.target.value = '' }}
            />

            <BarreActions>
              <BoutonPrincipal type="button" onClick={() => inputLogo.current?.click()} chargement={occupeLogo} libelleChargement="En cours…">
                {logoUrl ? 'Changer l’image' : 'Choisir une image'}
              </BoutonPrincipal>
              <button type="button" onClick={() => { setEtatLogo(REPOS_LOGO); allerA(4) }} disabled={occupeLogo} className={LIEN_DISCRET}>
                Plus tard
              </button>
            </BarreActions>
          </div>
        )}

        {etape === 4 && (
          <form onSubmit={e => { e.preventDefault(); if (obligatoiresOk) allerA(5) }} noValidate className="flex flex-col gap-[22px]">
            {QUESTIONS_OBLIGATOIRES.map(q => (
              <Question key={q.cle} q={q} reponse={profil[q.cle]} onChoisir={v => choisirReponse(q, v)} disabled={envoi} derniere={derniere} />
            ))}

            <BarreActions>
              <BoutonPrincipal type="submit" disabled={!obligatoiresOk} className={brille ? 'wb-entree-brille' : ''}>
                {obligatoiresOk ? 'Continuer' : `Continuer · ${nbRepondues} sur ${QUESTIONS_OBLIGATOIRES.length}`}
              </BoutonPrincipal>
            </BarreActions>
          </form>
        )}

        {etape === 5 && (
          <form onSubmit={terminer} noValidate className="flex flex-col gap-[22px]">
            {QUESTIONS_FACULTATIVES.map(q => (
              <Question key={q.cle} q={q} reponse={profil[q.cle]} onChoisir={v => choisirReponse(q, v)} disabled={envoi} derniere={derniere} />
            ))}

            <fieldset className="min-w-0">
              <legend className="mb-2.5 text-[15px] font-semibold">Comment as-tu connu WashBoard ?</legend>
              <div className="flex flex-wrap gap-[7px]">
                {SOURCES_ACQUISITION.map(s => {
                  const choisi = source === s.valeur
                  return (
                    <button
                      key={s.valeur}
                      type="button"
                      aria-pressed={choisi}
                      onClick={() => { setSource(choisi ? null : s.valeur); setDerniere(`source:${s.valeur}`); setErreur(null) }}
                      disabled={envoi}
                      className={`${PASTILLE} ${choisi ? PASTILLE_CHOISIE : PASTILLE_LIBRE} ${choisi && derniere === `source:${s.valeur}` ? 'wb-entree-pop' : ''}`}
                    >
                      {s.libelle}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {erreur && (
              <>
                <Erreur texte={erreur} />
                {/* Une réponse qui ne s'enregistre pas ne doit pas fermer l'accès au compte. */}
                <Link href="/dashboard" className={`${LIEN_DISCRET} self-start`}>Aller au tableau de bord</Link>
              </>
            )}

            <BarreActions>
              <BoutonPrincipal type="submit" chargement={envoi} libelleChargement="Enregistrement…">Terminer</BoutonPrincipal>
            </BarreActions>
          </form>
        )}

        {etape === PRET && (
          <div className="flex flex-col gap-5">
            <div>
              <Guide gens={['rectangles', 'ryan', 'rondes']} texte="On est là si tu as besoin d’aide." />
              <TitreEntree titre="Ton espace est prêt" sousTitre="Partage ton lien : tes clients peuvent déjà réserver dès que tes prestations et tes horaires sont en place." />
            </div>

            <div className="flex flex-col gap-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4">
              <div className="flex items-center gap-3.5">
                <Vignette logoUrl={logoUrl} nom={nom} />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{nom || 'Ton entreprise'}</p>
                  <p className="text-xs text-[color:var(--v2-color-gris)]">Ta page de réservation</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2.5 border-t border-[color:var(--v2-filet)] pt-3 text-[13px]">
                <span className="min-w-0 select-all break-all text-[color:var(--v2-color-accent)]">{lienComplet}</span>
                <button type="button" onClick={copierLien} className="wb-entree-bouton shrink-0 rounded-[10px] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-fond)] px-3 py-[7px] text-[13px] font-semibold">
                  {copie ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>

            <ul className="flex flex-col gap-2 text-sm">
              {[
                { texte: 'Ton lien de réservation', fait: true },
                { texte: 'Ton adresse de départ', fait: true },
                { texte: 'Ton logo', fait: !!logoUrl },
                { texte: 'Tes prestations et tes horaires, dans le tableau de bord', fait: false },
              ].map((l, i) => (
                <li key={l.texte} style={{ animationDelay: `${i * 120}ms` }} className={`wb-entree-coche grid grid-cols-[18px_1fr] items-center gap-2.5 ${l.fait ? '' : 'text-[color:var(--v2-color-gris)]'}`}>
                  <span aria-hidden className={l.fait ? 'font-bold text-[color:var(--v2-color-vert)]' : ''}>{l.fait ? '✓' : '○'}</span>
                  {l.texte}
                </li>
              ))}
            </ul>

            <BarreActions>
              <BoutonPrincipal type="button" onClick={ouvrirTableauDeBord} chargement={envoi} libelleChargement="Ouverture…">
                Ouvrir mon tableau de bord
              </BoutonPrincipal>
            </BarreActions>
          </div>
        )}
      </div>
    </CadreEntree>
  )
}
