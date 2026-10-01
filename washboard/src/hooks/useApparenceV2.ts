'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { compressImage, LOGO_OPTIONS, BACKGROUND_OPTIONS } from '@/lib/imageCompression'
import { enregistrerApparence, envoyerImage, type ChampsApparence } from '@/lib/apparenceApi'
import { DELAI_ATTENTE_LONGUE_MS, estImageAcceptee, messageNormalise, type PhaseImage } from '@/lib/apparence'
import { logger } from '@/lib/logger'
import { retirerLeFond } from '@/hooks/retirerLeFond'

// État de l'écran « Apparence de ma page » de la PWA (`ApparenceV2`) : les cinq
// réglages, leurs écritures et l'état des envois d'image.
//
// L'ÉTAT D'ENVOI VIT ICI, PAS DANS LES FEUILLES : le détourage du logo peut durer
// une minute la première fois (modèle à télécharger). Fermer la feuille n'annule
// rien, et un échec survenu feuille fermée reste affiché sur l'écran.
//
// Les valeurs « confirmées » (`logoUrl`, `couleur`, `fond`, `message`, `site`)
// ne changent QU'APRÈS un succès du serveur : l'aperçu et la liste ne montrent
// jamais un réglage qui n'est pas enregistré. Couleur et fond, choisis au tap,
// exposent en plus une valeur « en attente » que la FEUILLE affiche aussitôt (anneau
// sur la vignette touchée) ; en cas d'échec elle est simplement abandonnée, avec une
// phrase, et rien n'a changé.
//
// Mêmes routes, mêmes corps que l'ancien écran (`IdentiteForm`).

export type EtatImage = { phase: PhaseImage; attenteLongue: boolean; erreur: string | null }

const REPOS: EtatImage = { phase: 'repos', attenteLongue: false, erreur: null }
const echec = (erreur: string): EtatImage => ({ phase: 'echec', attenteLongue: false, erreur })

export const PHRASE_PAS_UNE_IMAGE = 'Ce fichier n’est pas une image. Choisissez un logo ou une photo (JPG, PNG, WebP).'
export const PHRASE_EN_COURS = 'Un envoi est déjà en cours. Patientez un instant.'
export const PHRASE_DETOURAGE_ECHEC =
  'Le fond n’a pas pu être retiré. Vérifiez votre connexion (un modèle se télécharge la première fois) puis réessayez.'

export type ReglagesApparence = {
  logoUrl: string | null
  couleur: string | null
  fond: string | null
  message: string | null
  site: string | null
}

export function useApparenceV2(initial: ReglagesApparence) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl)
  const [couleur, setCouleur] = useState(initial.couleur)
  const [fond, setFond] = useState(initial.fond)
  const [message, setMessage] = useState(initial.message)
  const [site, setSite] = useState(initial.site)

  const [logo, setLogo] = useState<EtatImage>(REPOS)
  const [fondPhoto, setFondPhoto] = useState<EtatImage>(REPOS)
  const [couleurEnAttente, setCouleurEnAttente] = useState<string | null>(null)
  const [couleurErreur, setCouleurErreur] = useState<string | null>(null)
  const [couleurFaite, setCouleurFaite] = useState(false)
  // `undefined` = aucun choix en cours ; `null` est un choix valide (« Original »).
  const [fondEnAttente, setFondEnAttente] = useState<string | null | undefined>(undefined)
  const [fondErreur, setFondErreur] = useState<string | null>(null)

  // Verrous : l'état d'un bouton n'est relu qu'au rendu suivant, un second tap
  // peut le précéder (voir `unSeulALaFois`, lib/horaires).
  const verrouLogo = useRef(false)
  const verrouCouleur = useRef(false)
  const verrouFond = useRef(false)
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current) }, [])

  // L'écran est lu depuis le serveur à chaque navigation ; on le rafraîchit après
  // une écriture pour qu'un retour vers Plus ne montre pas l'ancienne pastille.
  const rafraichir = () => router.refresh()

  // ── Logo ────────────────────────────────────────────────────────────────

  async function changerLogo(fichier: File) {
    if (verrouLogo.current) return
    if (!estImageAcceptee(fichier.type)) { setLogo(echec(PHRASE_PAS_UNE_IMAGE)); return }
    verrouLogo.current = true
    setLogo({ phase: 'detourage', attenteLongue: false, erreur: null })
    minuteur.current = setTimeout(
      () => setLogo(l => (l.phase === 'detourage' ? { ...l, attenteLongue: true } : l)),
      DELAI_ATTENTE_LONGUE_MS,
    )
    try {
      let detoure: Blob
      try {
        detoure = await retirerLeFond(fichier)
      } catch (e) {
        // Modèle injoignable, mémoire insuffisante, WebAssembly absent : sans trace,
        // un téléphone où le détourage ne marche jamais resterait invisible.
        logger.error('apparence.logo.detourage_failed', {}, e)
        setLogo(echec(PHRASE_DETOURAGE_ECHEC))
        return
      }
      if (minuteur.current) clearTimeout(minuteur.current)
      setLogo({ phase: 'envoi', attenteLongue: false, erreur: null })
      // Le détourage rend un PNG en pleine résolution (jusqu'à 4 Mo) : réduit avant
      // l'envoi, comme l'ancien écran — c'est ce plafond que le serveur contrôle.
      const reduit = await compressImage(new File([detoure], 'logo.png', { type: 'image/png' }), LOGO_OPTIONS)
      const r = await envoyerImage('logo', reduit)
      if (!r.ok) { setLogo(echec(r.message)); return }
      // Le fichier garde la même adresse d'un envoi à l'autre : sans ce paramètre,
      // le navigateur réafficherait l'ancien logo. Local à l'écran, jamais enregistré.
      setLogoUrl(`${r.data}?t=${Date.now()}`)
      setLogo({ phase: 'fait', attenteLongue: false, erreur: null })
      rafraichir()
    } finally {
      if (minuteur.current) clearTimeout(minuteur.current)
      verrouLogo.current = false
    }
  }

  /** `null` si le logo est retiré, sinon la phrase d'erreur. */
  async function retirerLogo(): Promise<string | null> {
    // Un envoi en cours réécrirait le logo juste après ce retrait.
    if (verrouLogo.current) return PHRASE_EN_COURS
    const r = await enregistrerApparence({ logo_url: null })
    if (!r.ok) return r.message
    setLogoUrl(null)
    setLogo(REPOS)
    rafraichir()
    return null
  }

  /** La feuille se ferme : ce qu'elle affichait (« mis en ligne », un échec) a été
   *  vu. Un envoi en cours, lui, continue et reste visible sur l'écran. */
  const acquitterLogo = () => setLogo(l => (l.phase === 'fait' || l.phase === 'echec' ? REPOS : l))
  const acquitterFond = () => {
    setFondPhoto(l => (l.phase === 'fait' || l.phase === 'echec' ? REPOS : l))
    setFondErreur(null)
  }

  // ── Couleur ─────────────────────────────────────────────────────────────

  async function choisirCouleur(hex: string) {
    if (verrouCouleur.current || hex === (couleurEnAttente ?? couleur)) return
    verrouCouleur.current = true
    setCouleurEnAttente(hex)
    setCouleurErreur(null)
    setCouleurFaite(false)
    try {
      const r = await enregistrerApparence({ brand_color: hex })
      if (r.ok) { setCouleur(hex); setCouleurFaite(true); rafraichir() }
      else setCouleurErreur(`${r.message} Votre couleur n’a pas changé.`)
    } finally {
      setCouleurEnAttente(null)
      verrouCouleur.current = false
    }
  }

  // ── Fond ────────────────────────────────────────────────────────────────

  /** Écrit le fond (`null` = Original). `null` en retour : enregistré ; sinon la
   *  phrase d'erreur, l'ancien fond restant en place. */
  async function ecrireFond(valeur: string | null): Promise<string | null> {
    if (verrouFond.current) return PHRASE_EN_COURS
    verrouFond.current = true
    setFondEnAttente(valeur)
    try {
      const champs: ChampsApparence = { background_theme: valeur }
      const r = await enregistrerApparence(champs)
      if (!r.ok) return r.message
      setFond(valeur)
      if (valeur === null) setFondPhoto(REPOS)
      rafraichir()
      return null
    } finally {
      setFondEnAttente(undefined)
      verrouFond.current = false
    }
  }

  async function choisirFond(valeur: string | null) {
    if (verrouFond.current || valeur === (fondEnAttente === undefined ? fond : fondEnAttente)) return
    setFondErreur(null)
    setFondPhoto(REPOS)
    const erreur = await ecrireFond(valeur)
    if (erreur) setFondErreur(`${erreur} Le fond précédent est conservé.`)
  }

  async function changerPhotoFond(fichier: File) {
    if (verrouFond.current) return
    if (!estImageAcceptee(fichier.type)) { setFondPhoto(echec(PHRASE_PAS_UNE_IMAGE)); return }
    verrouFond.current = true
    setFondErreur(null)
    // L'ancien fond reste affiché jusqu'au succès : `fond` ne change qu'à la fin.
    setFondPhoto({ phase: 'envoi', attenteLongue: false, erreur: null })
    try {
      const reduit = await compressImage(fichier, BACKGROUND_OPTIONS)
      // `compressImage` rend le fichier d'origine quand la réduction échoue : on ne l'envoie
      // que si c'est encore une image acceptée.
      if (!estImageAcceptee(reduit.type)) { setFondPhoto(echec(PHRASE_PAS_UNE_IMAGE)); return }
      const r = await envoyerImage('background', reduit)
      if (!r.ok) { setFondPhoto(echec(r.message)); return }
      // Même adresse d'un envoi à l'autre (voir `changerLogo`).
      setFond(`${r.data}?t=${Date.now()}`)
      setFondPhoto({ phase: 'fait', attenteLongue: false, erreur: null })
      rafraichir()
    } finally {
      verrouFond.current = false
    }
  }

  // ── Message et site (bouton Enregistrer, dans leur feuille) ──────────────

  /** `null` si enregistré, sinon la phrase d'erreur (le texte saisi reste dans la feuille). */
  async function enregistrerMessage(texte: string): Promise<string | null> {
    const valeur = messageNormalise(texte)
    const r = await enregistrerApparence({ welcome_message: valeur })
    if (!r.ok) return r.message
    setMessage(valeur)
    rafraichir()
    return null
  }

  async function enregistrerSite(valeur: string | null): Promise<string | null> {
    const r = await enregistrerApparence({ website_url: valeur })
    if (!r.ok) return r.message
    setSite(valeur)
    rafraichir()
    return null
  }

  return {
    logoUrl, couleur, fond, message, site,
    logo, fondPhoto,
    couleurEnAttente, couleurErreur, couleurFaite,
    fondEnAttente, fondErreur,
    changerLogo, retirerLogo, acquitterLogo,
    choisirCouleur,
    choisirFond, changerPhotoFond, retirerPhoto: () => ecrireFond(null), acquitterFond,
    enregistrerMessage, enregistrerSite,
  }
}
