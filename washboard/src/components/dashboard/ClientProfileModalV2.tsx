'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Phone, Mail, MapPin, MoreHorizontal, Star, BellRing, Car } from 'lucide-react'
import type { ClientProfile } from '@/lib/clientProfile'
import { timelineClient } from '@/lib/clientTimeline'
import { FUSEAU } from '@/lib/dateUtils'
import { statutAffiche, type StatutAffiche } from '@/lib/cloture'
import { useBloquerDefilement, useGlisserPourFermer } from '@/hooks/useFeuilleTactile'
import { marquerNePlusContacter, rattacherEntreprise, modifierFiche } from '@/lib/clientsApi'
import { creerEtRattacher } from '@/components/dashboard/FicheEntrepriseV2'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION } from '@/components/dashboard/FeuilleV2'
import { Constat } from '@/components/dashboard/PrestationsUiV2'

// La fiche client, présentation v2 — une feuille qui monte du bas (mobile) ou
// une carte centrée (ordinateur), réservée à la PWA installée en mode
// standalone (voir ClientProfileModal.tsx, le point de branchement ;
// décision d'Alexandre, 2026-09-22 : le site reste v1 sans exception).
// Anciennement la passe 3 de la refonte 2026, au-dessus de la liste Clients
// ou de l'ancien CRM (CrmDashboard.tsx la réutilise telle quelle — voir le
// compte rendu de la passe pour ce que ça implique). Seule la présentation
// change, buildClientProfile et ClientProfile n'ont pas bougé, et elle n'est
// pas dupliquée avec ClientProfileModalV1.tsx.
//
// La maquette (specs/08_Fiche-feuille.txt, page_08.png) montre des données que le profil ne
// calculait pas au départ. État au 2026-09-28 (canevas de Yanis, discuté avec Alexandre) :
//  - « son rythme » (`ClientProfile.rythmeJours`) et le menu d'options (« ... ») EXISTENT
//    désormais, voir plus bas ;
//  - la timeline mélange prestations, avis et relances (`lib/clientTimeline.ts`), plutôt que
//    la seule liste de rendez-vous d'avant ;
//  - RESTE À CONSTRUIRE : le bouton « Rendez-vous » (suppose de brancher cet écran sur le
//    formulaire de rendez-vous manuel de l'Agenda, `RendezVousManuelV2.tsx` — un autre écran,
//    d'autres données chargées), les contacts et sites multiples pour un pro (table `sites`,
//    pas construite).
//
// Le menu d'options (« ... ») ne porte qu'UNE action pour l'instant, « ne plus contacter »
// (2026-09-28) : les autres (tâche, fusion de doublons, export RGPD) demandent des tables qui
// n'existent pas encore (voir TODO.md, « Roadmap produit »). Construit en sheet dès maintenant,
// pas en simple lien, pour ne pas avoir à tout redécouper le jour où ces actions arrivent.

// Rôles de police — mêmes constantes que ClientsViewV2.tsx (passe 2), plus
// `hero` pour les trois chiffres de la fiche (planche Système : "chiffre
// héros" 650/largeur 118/-0.045em/tabular-nums — même rôle qu'à l'accueil,
// une taille plus petite ici).
const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`

// Statuts d'un rendez-vous : un point plein + le mot, jamais une pastille
// pastel (planche Système, panneau Couleurs — "les statuts sont un point
// plein + le mot, jamais une pastille pastel"). Couleurs reprises du
// panneau "Composants" de la planche : Confirmé vert, En attente ambre,
// Terminé GRIS (pas bleu — l'ancienne fiche l'inventait), Annulé rouge.
// "Délai dépassé" n'existe pas dans la planche (propre au produit) : posé
// en ambre par cohérence avec "en attente", à confirmer.
const STATUT: Record<StatutAffiche, { couleur: string; label: string }> = {
  pending: { couleur: 'var(--v2-color-ambre)', label: 'En attente' },
  confirmed: { couleur: 'var(--v2-color-vert)', label: 'Confirmé' },
  done: { couleur: 'var(--v2-color-gris)', label: 'Terminé' },
  cancelled: { couleur: 'var(--v2-color-rouge)', label: 'Annulé' },
  a_cloturer: { couleur: 'var(--v2-color-ambre)', label: 'À clôturer' },
}

// Éléments qu'un Tab peut atteindre à l'intérieur de la feuille — sert au
// piège de focus (le Tab ne doit pas s'échapper vers la liste derrière).
const SELECTEUR_FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function dateCourte(iso: string, maintenant: number): string {
  const d = new Date(iso)
  const memeAnnee = d.getFullYear() === new Date(maintenant).getFullYear()
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', ...(memeAnnee ? {} : { year: 'numeric' }), timeZone: FUSEAU,
  })
}

const depuis = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: FUSEAU })

/** « 2 mois », « 12 j » — au-delà de 45 jours, le mois est plus lisible qu'un compte de jours ;
 *  en dessous, un mois arrondi (« 1 mois » pour 20 jours d'écart) donnerait une fausse
 *  précision. Même seuil que les arrondis déjà en place ailleurs dans l'écran Chiffres. */
function formatRythme(jours: number): string {
  if (jours < 45) return `${jours} j`
  const mois = Math.round(jours / 30)
  return `${mois} mois`
}

/** Rattacher un contact à une entreprise — depuis la Fiche client, quand il n'est pas encore
 *  rattaché (fiche entreprise, 2026-09-28). Choisir une entreprise existante, ou en créer une en
 *  tapant simplement son nom : les deux mènent au même geste, « rattacher ». */
function FeuilleRattacherV2({
  cle, entreprisesDisponibles, onRattache, onClose,
}: {
  cle: string
  entreprisesDisponibles: { id: string; nom: string }[]
  onRattache: (entrepriseId: string) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [entrepriseId, setEntrepriseId] = useState<string | 'nouvelle' | ''>('')
  const [nouveauNom, setNouveauNom] = useState('')
  const [role, setRole] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // `entreprisesDisponibles` et la liste des contacts d'une entreprise viennent toutes deux
  // d'une prop tirée de `clients/page.tsx` (composant serveur) — jamais mises à jour toutes
  // seules. SANS ce `router.refresh()`, ouvrir la fiche juste après (`onRattache`) tombait sur
  // l'ancienne liste : une entreprise TOUT JUSTE créée n'y figurait pas encore, et l'écran ne
  // faisait rien de visible (relevé par Alexandre, 2026-09-28). Le refresh part AVANT
  // `onRattache` : au moment où l'identifiant est retenu, les données fraîches sont déjà en
  // chemin.
  async function soumettre() {
    if (enCours) return
    if (entrepriseId === '') { setErreur('Choisissez une entreprise, ou créez-en une.'); return }
    if (entrepriseId === 'nouvelle' && !nouveauNom.trim()) { setErreur('Indiquez le nom de l’entreprise.'); return }
    setEnCours(true)
    setErreur(null)
    if (entrepriseId === 'nouvelle') {
      const r = await creerEtRattacher(nouveauNom.trim(), cle, role)
      setEnCours(false)
      if (typeof r === 'string') { setErreur(r); return }
      router.refresh()
      onRattache(r.id)
    } else {
      const r = await rattacherEntreprise(cle, entrepriseId, role)
      setEnCours(false)
      if (!r.ok) { setErreur(r.message); return }
      router.refresh()
      onRattache(entrepriseId)
    }
  }

  return (
    <Feuille
      titre="Rattacher à une entreprise"
      onClose={onClose}
      pied={
        <button type="button" onClick={() => void soumettre()} disabled={enCours} className={`${BOUTON} w-full text-white`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
          {enCours ? 'Rattachement…' : 'Rattacher'}
        </button>
      }
    >
      <div className="space-y-4">
        {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        <div>
          <label htmlFor="rattacher-entreprise" className={ETIQUETTE}>Entreprise</label>
          <select
            id="rattacher-entreprise" value={entrepriseId} onChange={e => setEntrepriseId(e.target.value as typeof entrepriseId)}
            className={CHAMP}
          >
            <option value="" disabled>Choisir…</option>
            {entreprisesDisponibles.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
            <option value="nouvelle">+ Nouvelle entreprise…</option>
          </select>
        </div>
        {entrepriseId === 'nouvelle' && (
          <div>
            <label htmlFor="rattacher-nom" className={ETIQUETTE}>Nom de l’entreprise</label>
            <input id="rattacher-nom" className={CHAMP} value={nouveauNom} onChange={e => setNouveauNom(e.target.value)} maxLength={200} autoFocus />
          </div>
        )}
        <div>
          <label htmlFor="rattacher-role" className={ETIQUETTE}>Son rôle (facultatif)</label>
          <input id="rattacher-role" className={CHAMP} value={role} onChange={e => setRole(e.target.value)} placeholder="Chef d’atelier, comptabilité…" maxLength={200} />
        </div>
      </div>
    </Feuille>
  )
}

/** Modifier la fiche — notes et véhicules, texte libre (2026-09-28, Alexandre : « comme ça on
 *  sait les voitures des gens »). Les deux s'écrivent ensemble : un seul aller-retour, pas deux
 *  sheets pour deux champs qui vivent sur la même ligne `clients`. */
function FeuilleModifierFicheV2({
  cle, notes, vehicules, onEnregistre, onClose,
}: {
  cle: string
  notes: string | null
  vehicules: string | null
  onEnregistre: (champs: { notes: string | null; vehicules: string | null }) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [notesSaisies, setNotesSaisies] = useState(notes ?? '')
  const [vehiculesSaisis, setVehiculesSaisis] = useState(vehicules ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    const champs = { notes: notesSaisies.trim() || null, vehicules: vehiculesSaisis.trim() || null }
    const r = await modifierFiche(cle, champs)
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    router.refresh()
    onEnregistre(champs)
  }

  return (
    <Feuille
      titre="Modifier la fiche"
      onClose={onClose}
      pied={
        <button type="button" onClick={() => void enregistrer()} disabled={enCours} className={`${BOUTON} w-full text-white`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
          {enCours ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      }
    >
      <div className="space-y-4">
        {erreur && <Constat ton="rouge" role="alert">{erreur}</Constat>}
        <div>
          <label htmlFor="fiche-vehicules" className={ETIQUETTE}>Véhicules</label>
          <textarea
            id="fiche-vehicules" value={vehiculesSaisis} onChange={e => setVehiculesSaisis(e.target.value)} rows={2} maxLength={2000}
            placeholder="Peugeot 208 grise, plaque AB-123-CD"
            className={`w-full min-w-0 resize-none rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 py-2.5 text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
          />
        </div>
        <div>
          <label htmlFor="fiche-notes" className={ETIQUETTE}>Notes (facultatif)</label>
          <textarea
            id="fiche-notes" value={notesSaisies} onChange={e => setNotesSaisies(e.target.value)} rows={3} maxLength={2000}
            placeholder="Portail à code 1234, préfère le samedi matin…"
            className={`w-full min-w-0 resize-none rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 py-2.5 text-[16px] ${corps} text-[color:var(--v2-color-encre)] placeholder:text-[color:var(--v2-color-gris)] focus:outline-none focus:ring-2 focus:ring-[color:var(--v2-color-accent)]/40`}
          />
        </div>
      </div>
    </Feuille>
  )
}

export default function ClientProfileModalV2({
  profile,
  onClose,
  entrepriseDuContact,
  entreprisesDisponibles = [],
  onOuvrirEntreprise,
}: {
  profile: ClientProfile
  onClose: () => void
  entrepriseDuContact?: { id: string; nom: string; role: string | null } | null
  entreprisesDisponibles?: { id: string; nom: string }[]
  onOuvrirEntreprise?: (id: string) => void
}) {
  const router = useRouter()
  const [maintenant] = useState(() => Date.now())
  const [visible, setVisible] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const feuilleRef = useRef<HTMLDivElement>(null)
  useBloquerDefilement()
  const glisser = useGlisserPourFermer(onClose)
  const focusPrecedent = useRef<HTMLElement | null>(null)

  // Optimiste : le laveur voit le changement tout de suite, la feuille reste ouverte — c'est un
  // aller-retour qu'il fait sans quitter la fiche, pas une saisie qu'on valide. Un échec revient
  // à l'état d'avant et le dit.
  const [nePlusContacter, setNePlusContacter] = useState(profile.nePlusContacter)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [optionsOuvertes, setOptionsOuvertes] = useState(false)
  const [rattachementOuvert, setRattachementOuvert] = useState(false)
  const [ficheOuverte, setFicheOuverte] = useState(false)
  const [notes, setNotes] = useState(profile.notes)
  const [vehicules, setVehicules] = useState(profile.vehicules)

  async function basculerNePlusContacter() {
    if (enCours) return
    const cible = !nePlusContacter
    setEnCours(true)
    setErreur(null)
    setNePlusContacter(cible)
    const r = await marquerNePlusContacter(profile.cle, cible)
    setEnCours(false)
    if (!r.ok) { setNePlusContacter(!cible); setErreur(r.message) }
  }

  /** `router.refresh()` : `entrepriseDuContact` vient d'une prop tirée de `clients/page.tsx`
   *  (composant serveur), pas d'un état local — sans le refresh, le menu continuerait à
   *  proposer « Se détacher » d'une entreprise déjà quittée. */
  async function detacherEntreprise() {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    const r = await rattacherEntreprise(profile.cle, null, '')
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    router.refresh()
  }

  // Entrée animée : un cran après le montage pour que le navigateur parte
  // bien de l'état initial (translate-y-full / opacity-0) avant de
  // transitionner — sans ce décalage, la feuille apparaît déjà en place.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Focus à l'ouverture, et surtout son retour à la fermeture : la ligne de
  // la liste qui a ouvert la fiche (ou le bouton qui l'a ouverte depuis
  // l'ancien CRM) reprend le focus, au lieu de le laisser tomber sur
  // <body>. document.activeElement est lu avant le .focus() du bouton
  // fermer ci-dessous, dans un effet séparé qui s'exécute avant (ordre de
  // déclaration) : au moment de la lecture, le focus est encore sur
  // l'élément d'origine.
  useEffect(() => {
    focusPrecedent.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (focusPrecedent.current?.isConnected) focusPrecedent.current.focus()
    }
  }, [])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Le bouton WhatsApp flottant du châssis est au même z-index que la
  // feuille et se pose par-dessus son bas. Même mécanisme que SupportPanel,
  // AssistanceContent et SupportInbox, qui le masquent déjà pendant qu'un
  // panneau couvre l'écran (voir globals.css, body.wb-hide-fab).
  useEffect(() => {
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [])

  // Échap pour fermer, Tab piégé dans la feuille : un menu ouvert au clavier
  // ne doit pas laisser échapper la tabulation vers la liste derrière.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (optionsOuvertes) setOptionsOuvertes(false)
        else onClose()
        return
      }
      if (e.key !== 'Tab' || !feuilleRef.current) return
      const items = feuilleRef.current.querySelectorAll<HTMLElement>(SELECTEUR_FOCUSABLE)
      if (items.length === 0) return
      const premier = items[0]
      const dernier = items[items.length - 1]
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault()
        dernier.focus()
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault()
        premier.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, optionsOuvertes])

  const titreClient = profile.isProfessional && profile.companyName ? profile.companyName : profile.name

  // Sous-titre : "Client depuis {mois} · {adresse}" — la maquette écrit un
  // nom de ville court ("· Pessac"), mais l'adresse est un champ libre sans
  // découpage rue/ville garanti (voir StepContact.tsx du flux de
  // réservation) : en extraire une ville serait deviner un format qui n'est
  // pas garanti. L'adresse complète la plus récente est affichée à la
  // place, tronquée si besoin.
  const depuisTexte = profile.firstVisit ? `Client depuis ${depuis(profile.firstVisit)}` : null
  const sousTitre = [depuisTexte, profile.addresses[0] ?? null].filter(Boolean).join(' · ')

  // Les modèles donnés par le client lui-même en réservant priment (source directe) ; le champ
  // manuel n'ajoute qu'un complément (plaque, couleur…) ou comble l'absence de réservation.
  const vehiculesTexte = [
    profile.vehiculesReserves.length > 0 ? profile.vehiculesReserves.join(', ') : null,
    vehicules,
  ].filter(Boolean).join(' · ')

  // Troisième chiffre : « son rythme » (l'écart moyen entre deux visites) plutôt que le panier
  // moyen — c'est ce que montre le canevas de Yanis, et une information que rien d'autre sur
  // cet écran ne donne (le panier moyen, lui, se retrouve en divisant les deux premiers
  // chiffres). Sans historique suffisant (moins de deux visites), on retombe sur le panier
  // moyen : « son rythme » sur un seul point ne voudrait rien dire, un tiret ferait un écran
  // à moitié vide pour un client tout neuf.
  const statistiques = [
    { label: 'lavages', valeur: String(profile.honoredCount) },
    { label: 'au total', valeur: `${profile.totalRevenue} €` },
    profile.rythmeJours !== null
      ? { label: 'son rythme', valeur: formatRythme(profile.rythmeJours) }
      : { label: 'panier moyen', valeur: `${profile.averageBasket} €` },
  ]
  const timeline = timelineClient(profile.bookings)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Fiche de ${titreClient}`}
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 touch-none bg-[color:var(--v2-color-encre)]/40 backdrop-blur-[2px] transition-opacity motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)' }}
      />

      <div
        ref={feuilleRef}
        className={`relative flex w-full max-h-[88dvh] flex-col overflow-hidden bg-[color:var(--v2-color-surface)] text-[color:var(--v2-color-encre)] ${police} rounded-t-[var(--v2-radius-feuille)] transition-transform motion-reduce:transition-none sm:max-w-md sm:rounded-[var(--v2-radius-surface)] sm:transition-[transform,opacity] ${
          visible
            ? 'translate-y-0 sm:scale-100 sm:opacity-100'
            : 'translate-y-full sm:translate-y-0 sm:scale-95 sm:opacity-0'
        }`}
        style={{ transitionDuration: 'var(--v2-duration-sheet)', transitionTimingFunction: 'var(--v2-ease-sheet)', ...glisser.styleFeuille }}
      >
        {/* Bande du haut (poignée + titre) : zone de tirage pour fermer la feuille. */}
        <div className="shrink-0" {...glisser.poignee}>
<div className="flex justify-center pt-2.5 pb-3 sm:hidden" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-[color:var(--v2-filet-fort)]" />
        </div>

        <div className="flex items-start gap-3 px-5 pt-1 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-[24px] ${titre}`}>{titreClient}</h2>
            {sousTitre && (
              <p className={`mt-1 truncate text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</p>
            )}
            {profile.isProfessional && profile.companyName && (
              <p className={`mt-0.5 truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                Contact · {profile.name}
              </p>
            )}
            {nePlusContacter && (
              <p className={`mt-1 text-[12px] ${corpsFort} text-[color:var(--v2-color-rouge)]`}>
                Ne reçoit plus de messages automatiques
              </p>
            )}
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setOptionsOuvertes(o => !o)}
              aria-label="Options de la fiche"
              aria-haspopup="menu"
              aria-expanded={optionsOuvertes}
              className="flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
            >
              <MoreHorizontal size={20} strokeWidth={2} />
            </button>
            {optionsOuvertes && (
              <>
                {/* Un tap n'importe où ailleurs referme le menu, sans fermer la fiche. */}
                <button aria-hidden tabIndex={-1} onClick={() => setOptionsOuvertes(false)} className="fixed inset-0 z-10 cursor-default" />
                <div
                  role="menu"
                  aria-label="Options"
                  className="absolute right-0 top-[52px] z-20 w-64 overflow-hidden rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] shadow-lg"
                >
                  {entrepriseDuContact ? (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOptionsOuvertes(false); onOuvrirEntreprise?.(entrepriseDuContact.id) }}
                        className={`w-full truncate px-4 py-3 text-left text-[14px] leading-snug ${corpsFort}`}
                      >
                        Voir « {entrepriseDuContact.nom} »
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={enCours}
                        onClick={() => { setOptionsOuvertes(false); void detacherEntreprise() }}
                        className={`w-full border-t border-[color:var(--v2-filet)] px-4 py-3 text-left text-[14px] leading-snug ${corpsFort} disabled:opacity-50`}
                        style={{ color: 'var(--v2-color-rouge)' }}
                      >
                        Se détacher de cette entreprise
                      </button>
                    </>
                  ) : entreprisesDisponibles !== undefined && onOuvrirEntreprise && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setOptionsOuvertes(false); setRattachementOuvert(true) }}
                      className={`w-full px-4 py-3 text-left text-[14px] leading-snug ${corpsFort}`}
                    >
                      Rattacher à une entreprise
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setOptionsOuvertes(false); setFicheOuverte(true) }}
                    className={`w-full border-t border-[color:var(--v2-filet)] px-4 py-3 text-left text-[14px] leading-snug ${corpsFort}`}
                  >
                    Modifier la fiche
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={enCours}
                    onClick={() => { setOptionsOuvertes(false); void basculerNePlusContacter() }}
                    className={`w-full border-t border-[color:var(--v2-filet)] px-4 py-3 text-left text-[14px] leading-snug ${corpsFort} disabled:opacity-50`}
                    style={{ color: nePlusContacter ? 'var(--v2-color-vert)' : 'var(--v2-color-rouge)' }}
                  >
                    {nePlusContacter ? 'Autoriser à nouveau les messages' : 'Ne plus contacter ce client'}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Fermer la fiche"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] transition-colors hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        </div>
        {erreur && (
          <p className={`px-5 pb-2 text-[12.5px] ${corps} text-[color:var(--v2-color-rouge)]`} role="alert">{erreur}</p>
        )}

        <div
          className="flex-1 overflow-y-auto overscroll-contain px-5 pt-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
        >
          <dl className="grid grid-cols-3 gap-3">
            {statistiques.map(s => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className={`m-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{s.label}</dt>
                <dd className={`m-0 text-[26px] leading-none ${hero}`}>{s.valeur}</dd>
              </div>
            ))}
          </dl>
          {profile.cancelledCount > 0 && (
            <p className={`mt-2 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>
              dont {profile.cancelledCount} annulé{profile.cancelledCount > 1 ? 's' : ''}
            </p>
          )}

          {/* Coordonnées : l'email est garanti (seul champ obligatoire de la
              fiche client), toujours affiché — y compris quand le
              téléphone manque et que les boutons Appeler/Message
              disparaissent, pour qu'il reste un moyen de contact visible.
              Les adresses au-delà de la première (déjà dans le sous-titre)
              s'ajoutent ici : le cas d'un professionnel à plusieurs sites. */}
          <div className={`mt-4 space-y-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {/* Un client né d'un devis n'a parfois qu'un téléphone : une enveloppe sans
                adresse serait un lien mort. */}
            {profile.email && (
              <a
                href={`mailto:${profile.email}`}
                className="flex items-center gap-2 transition-colors hover:text-[color:var(--v2-color-encre)]"
              >
                <Mail size={14} className="shrink-0" aria-hidden />
                <span className="truncate">{profile.email}</span>
              </a>
            )}
            {profile.addresses.slice(1).map(a => (
              <p key={a} className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0" aria-hidden />
                <span>{a}</span>
              </p>
            ))}
          </div>

          {vehiculesTexte && (
            <p className={`mt-3 flex items-start gap-2 text-[13px] ${corps} text-[color:var(--v2-color-encre)]`}>
              <Car size={14} className="mt-0.5 shrink-0 text-[color:var(--v2-color-gris)]" aria-hidden />
              <span>{vehiculesTexte}</span>
            </p>
          )}
          {notes && (
            <p className={`mt-2 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{notes}</p>
          )}

          {profile.daysSinceLastVisit !== null && profile.daysSinceLastVisit >= 90 && (
            <div className="mt-4 flex items-start gap-2.5 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-color-ambre)]/30 bg-[color:var(--v2-color-surface)] px-3.5 py-3">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--v2-color-ambre)' }}
                aria-hidden
              />
              <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-ambre)]`}>
                Pas revenu depuis {profile.daysSinceLastVisit} jours — bon candidat à une relance.
              </p>
            </div>
          )}

          {/* Appeler / Message : des liens tel: / sms:, du déclenchement, pas
              de l'écriture — légitimes dès maintenant si le téléphone
              existe. "Rendez-vous" (dans la maquette) suppose le rendez-vous
              manuel (étape 3 du plan CRM, pas encore construit) : absent
              volontairement, pas de bouton mort. */}
          {profile.phone && (
            <div className="mt-6 flex gap-2.5">
              <a
                href={`tel:${profile.phone}`}
                className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                <Phone size={16} strokeWidth={2} aria-hidden />
                Appeler
              </a>
              <a
                href={`sms:${profile.phone}`}
                className={`flex h-11 flex-1 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[15px] ${corpsFort} text-[color:var(--v2-color-encre)] transition-transform active:scale-[.97]`}
                style={{ transitionDuration: 'var(--v2-duration-press)', transitionTimingFunction: 'var(--v2-ease-out)' }}
              >
                Message
              </a>
            </div>
          )}

          {/* Devis et factures écrits à la main. Ils ne sont pas des rendez-vous et n'ont donc
              rien à faire dans l'historique ci-dessous : les y mêler ferait passer un devis
              pour une prestation faite (Alexandre, 2026-09-27). */}
          {profile.documents.length > 0 && (
            <div className="mt-6 border-t border-[color:var(--v2-filet)] pt-4">
              <h3 className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
                Devis et factures
              </h3>
              <ul className="mt-1.5">
                {profile.documents.map(d => (
                  <li key={d.id} className="flex items-baseline justify-between gap-2 py-1.5">
                    <span className="min-w-0">
                      <span className={`text-[14px] ${nom}`}>
                        {d.genre === 'devis' ? 'Devis' : 'Facture'} {d.numero ?? ''}
                      </span>
                      <span className={`ml-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                        {dateCourte(d.emis_le ?? d.created_at, maintenant)}
                      </span>
                      {/* Une facture émise n'est pas de l'argent reçu tant qu'elle n'est pas
                          encaissée — même règle que l'« Encaissé » de Chiffres. Rien pour un
                          devis : il n'est jamais « payé », la question ne se pose pas ici. */}
                      {d.genre === 'facture' && (
                        <span
                          className={`ml-2 text-[12.5px] ${corpsFort}`}
                          style={{ color: d.paye_le ? 'var(--v2-color-vert)' : 'var(--v2-color-ambre)' }}
                        >
                          {d.paye_le ? 'Encaissée' : 'À encaisser'}
                        </span>
                      )}
                    </span>
                    <a
                      href={`/api/documents/${d.id}/pdf`}
                      className={`shrink-0 text-[13px] ${corpsFort}`}
                      style={{ color: 'var(--v2-color-accent)' }}
                    >
                      PDF
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 border-t border-[color:var(--v2-filet)] pt-1">
            <h3 className="sr-only">Historique</h3>
            {profile.bookings.length === 0 && (
              <p className={`py-3 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                Aucun rendez-vous pour l’instant : ce client est né d’un document écrit à la main.
              </p>
            )}
            <ol>
              {timeline.map((e, i) => {
                const dernier = i === timeline.length - 1
                // Chaque type d'événement porte sa couleur de point et son contenu — voir
                // `lib/clientTimeline.ts` pour ce qui distingue une VRAIE relance/prestation
                // (reproduites exactement) d'une demande d'avis (déduite, comme partout
                // ailleurs où WashBoard l'affiche).
                const cle = e.type === 'prestation' ? e.booking.id : `${e.type}-${e.date}`
                const couleur = e.type === 'prestation'
                  ? STATUT[statutAffiche(e.booking)].couleur
                  : e.type === 'avis' ? 'var(--v2-color-ambre)' : 'var(--v2-color-accent)'
                return (
                  <li key={cle} className="flex gap-3 py-3">
                    <span className="relative flex w-2.5 shrink-0 justify-center">
                      <span className="absolute top-1.5 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: couleur }} aria-hidden />
                      {!dernier && (
                        <span
                          className="absolute top-3 w-px bg-[color:var(--v2-filet)]"
                          style={{ height: 'calc(100% + 0.75rem)' }}
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      {e.type === 'prestation' ? (
                        <>
                          <span className="flex items-baseline justify-between gap-2">
                            <span className={`truncate text-[14.5px] ${nom}`}>{e.booking.services?.name ?? 'Prestation'}</span>
                            <span className={`shrink-0 text-[14px] ${corpsFort} tabular-nums`}>
                              {e.booking.booked_price ?? e.booking.services?.price ?? 0} €
                            </span>
                          </span>
                          <span className={`mt-0.5 block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                            {dateCourte(e.booking.scheduled_at, maintenant)} · {STATUT[statutAffiche(e.booking)].label}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5">
                            {e.type === 'avis' ? <Star size={13} strokeWidth={2} aria-hidden /> : <BellRing size={13} strokeWidth={2} aria-hidden />}
                            <span className={`truncate text-[14.5px] ${nom}`}>
                              {e.type === 'avis' ? 'Demande d’avis envoyée' : 'Relance envoyée'}
                            </span>
                          </span>
                          <span className={`mt-0.5 block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                            {dateCourte(e.date, maintenant)}
                            {e.type === 'relance' && e.aReserveDepuis && ' · a réservé depuis'}
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>

      {rattachementOuvert && (
        <FeuilleRattacherV2
          cle={profile.cle}
          entreprisesDisponibles={entreprisesDisponibles}
          onRattache={id => { setRattachementOuvert(false); onOuvrirEntreprise?.(id) }}
          onClose={() => setRattachementOuvert(false)}
        />
      )}
      {ficheOuverte && (
        <FeuilleModifierFicheV2
          cle={profile.cle}
          notes={notes}
          vehicules={vehicules}
          onEnregistre={champs => { setNotes(champs.notes); setVehicules(champs.vehicules); setFicheOuverte(false) }}
          onClose={() => setFicheOuverte(false)}
        />
      )}
    </div>
  )
}
