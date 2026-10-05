'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { BarreBasV2 } from './BarreBasV2'
import { RailBureauV2 } from './RailBureauV2'
import ConfirmationEnvoiV2 from './ConfirmationEnvoiV2'
import RetourGesteV2 from './RetourGesteV2'
import VisiteGuidee from './VisiteGuidee'
import { SupportBadgesContext } from './SupportBadgesContext'
import { OffreContext } from './OffreContext'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PLAN_LABELS, PLAN_COULEURS, planEffectif, doitChoisirFormule, accesComplet, hasFeature, requiredPlan, type Plan, type Feature } from '@/lib/plan'
import { isCardRegistered, formatDateFR } from '@/lib/subscription'
import { useSupportUnreadBadge } from '@/lib/useSupportUnreadBadge'
import { useSupportUnreadTeamBadge } from '@/lib/useSupportUnreadTeamBadge'
import { useEstEquipeSupport } from '@/lib/useEstEquipeSupport'
import { UnreadCountBadge, unreadLabel } from '@/components/ui/UnreadCountBadge'
import { usePreferenceLocale } from '@/hooks/usePreferenceLocale'
import { usePwaStandalone } from '@/hooks/usePwaStandalone'
import { useDashboardV2 } from '@/hooks/useDashboardV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'

type Props = {
  // Absent pour un compte qui n'a pas de fiche laveur (ex. un membre du
  // support sans compte laveur associé, voir `/dashboard/support`) : dans ce
  // cas, ni le nom ni le badge d'abonnement ne peuvent être affichés — voir
  // plus bas où `washerName` conditionne leur rendu. Le menu (Sidebar), lui,
  // reste toujours affiché : il ne dépend d'aucune donnée laveur.
  washerName?: string
  children: React.ReactNode
  trialEndsAt?: string | null
  subscriptionStatus?: string | null
  plan?: Plan
  grandfathered?: boolean
  stripeSubscriptionId?: string | null
  cancelsAt?: string | null
  // `washer.beta_refonte`. Depuis le 2026-10-01, n'importe quelle application INSTALLÉE
  // reçoit la refonte sans condition (plus besoin de ce drapeau pour la PWA). Remise en
  // service à la passe « châssis bureau » (2026-10-05) pour un seul cas : le SITE (pas la
  // PWA) sur grand écran — voir `useDashboardV2.ts`, qui en a besoin pour ne pas basculer
  // toute l'équipe d'un coup sur un tableau de bord moitié migré. À retirer avec ce
  // garde-fou, quand la dernière passe (Aujourd'hui) sera livrée.
  betaRefonte?: boolean | null
  /** Date de création de la fiche : décide si ce compte suit la règle 2026
   *  (retour sur Découverte à la fin de l'essai) ou l'ancienne (suspension). */
  createdAt?: string | null
  /** Lien public du laveur, pour la liste de bascule anticipée (COMPTES_TEST_RETOUR_GRATUIT). */
  slug?: string | null
  /** Fin de la période payée (colonne écrite par le webhook Stripe) : décide du délai de grâce avant le retour sur Découverte. */
  subscriptionEndsAt?: string | null
  /** Seule `/dashboard` le renseigne : c'est la seule page qui déclenche la visite guidée. */
  visiteGuidee?: boolean
}

function PlanBadge({ grandfathered, effectif }: { grandfathered?: boolean; effectif: Plan }) {
  // `plan` est ce qui est écrit en base, `effectif` ce qui s'applique
  // aujourd'hui : après un essai non transformé, les deux diffèrent, et c'est
  // le second que le laveur doit lire.
  const label = grandfathered ? 'Accès complet' : PLAN_LABELS[effectif]
  const color = grandfathered
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
    : effectif === 'pro' || effectif === 'business'
      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
  return (
    <Link
      href="/dashboard/abonnement"
      title="Voir mon abonnement"
      aria-label={`Abonnement : ${label}`}
      // Même hauteur que les deux boutons voisins (36 px, 40 px dès sm) et
      // carré sur téléphone, où seule la couronne s'affiche.
      className={`inline-flex items-center justify-center gap-1.5 h-9 min-w-9 sm:h-10 sm:min-w-10 px-0 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap hover:opacity-80 transition-opacity ${color}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zM5 20h14"/>
      </svg>
      {/* Sur téléphone, seule la couronne reste : le libellé du plan poussait
          « WashBoard » hors de l'écran, qui s'affichait « Wa… ». Le badge reste
          cliquable et son intitulé passe par aria-label. */}
      <span className="hidden sm:inline-flex items-center gap-1.5">
        {/* Pas de pastille pour un client historique : « Accès complet » n'est
            pas une offre de la grille, lui en donner une couleur laisserait
            croire qu'il existe un cinquième palier. */}
        {!grandfathered && (
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: PLAN_COULEURS[effectif] }}
            aria-hidden
          />
        )}
        {label}
      </span>
    </Link>
  )
}

// Description du bouton ☰ quand il porte les deux compteurs à la fois
// (compte à la fois laveur et membre de l'équipe — le cas de Ryan en local,
// ce sera peut-être celui d'Alexandre demain).
//
// Choix : le CHIFFRE affiché sur le bouton est la SOMME des deux compteurs,
// pas seulement celui qu'on jugerait prioritaire. Deux raisons :
//  1. Le bouton ☰ n'a jamais eu la prétention de tout détailler — c'est un
//     simple signal « quelque chose t'attend », le détail (qui, combien de
//     chaque côté) est à un clic, dans le menu déjà déplié où « Assistance »
//     et « Support » portent chacun leur propre nombre.
//  2. Un choix de priorité masquerait carrément un des deux compteurs dès que
//     l'autre est non nul — un laveur-équipe qui voit « 3 » sur le bouton ne
//     doit jamais se demander si ce sont 3 laveurs qui attendent ou 3
//     réponses de l'équipe qu'il n'a pas lues : avec la somme, la question ne
//     se pose plus, il sait juste qu'il a des choses à regarder et va les
//     trouver en ouvrant le menu.
// L'aria-label, lui, reste détaillé (voir `libelleBoutonMenu`) : ce que la
// pastille visuelle ne peut pas dire en un chiffre, la description vocale le
// peut en une phrase.
function libelleBoutonMenu(unreadSupportCount: number | null, unreadTeamCount: number | null): string {
  const assistance = unreadSupportCount ?? 0
  const equipe = unreadTeamCount ?? 0
  const parties: string[] = []
  if (assistance > 0) parties.push(`${unreadLabel(assistance)} de l’équipe`)
  if (equipe > 0) parties.push(`${equipe > 1 ? `${equipe} messages` : '1 message'} de laveurs en attente de réponse`)
  return parties.length > 0 ? `Ouvrir le menu — ${parties.join(', ')}` : 'Ouvrir le menu'
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button onClick={onDismiss} aria-label="Fermer" className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-1">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  )
}

// ── Bandeaux d'information : une forme par version ─────────────────────────
//
// Les bandeaux (fin d'essai, paiement en retard, annonce des offres, bêta de
// l'application) restent affichés dans la PWA : c'est de l'information
// commerciale, on ne la retire pas à celui qui est justement en train de
// choisir son offre. Mais ils arrivaient tels quels du site — bleu pleine
// largeur, texte centré, liens soulignés — posés au-dessus du papier de la
// refonte. Alexandre l'a dit le 2026-09-29 en voyant l'écran : « ça n'a rien à
// voir ». D'où cette forme v2 : une carte de la même famille que les autres,
// alignée à gauche, filet de la couleur du ton plutôt qu'un aplat.
//
// Le site, lui, ne bouge pas d'un pixel : c'est la branche `!isPwa` ci-dessous,
// reprise à l'identique de ce que chaque bandeau rendait avant.
type TonBandeau = 'accent' | 'vert' | 'ambre' | 'rouge' | 'nouveau'

const V2_POLICE = '[font-family:var(--font-archivo)]'
const V2_FORT = `${V2_POLICE} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`

/** Couleur v2 d'un ton. « nouveau » n'existe pas dans les jetons : c'est
 *  l'accent, réservé ici aux annonces produit. */
const couleurTon = (ton: TonBandeau) =>
  ton === 'nouveau' ? 'var(--v2-color-accent)' : `var(--v2-color-${ton})`

function BandeauV2({ etiquette, ton, children, lien, libelleLien, onDismiss }: {
  etiquette?: string
  ton: TonBandeau
  children: React.ReactNode
  lien?: string
  libelleLien?: string
  onDismiss?: () => void
}) {
  const couleur = couleurTon(ton)
  return (
    <div className="wb-bandeau-v2 px-3 pt-3 sm:px-4">
      <div
        className="flex items-start gap-2.5 rounded-[var(--v2-radius-carte)] border bg-[color:var(--v2-color-surface)] px-3.5 py-3"
        style={{ borderColor: `color-mix(in srgb, ${couleur} 35%, transparent)` }}
      >
        <span className="min-w-0 flex-1">
          {etiquette && (
            <span
              className="mb-1 block text-[10.5px] font-black uppercase tracking-[0.18em]"
              style={{ color: couleur }}
            >
              {etiquette}
            </span>
          )}
          <span className={`block text-[13.5px] leading-snug ${V2_FORT} text-[color:var(--v2-color-encre)]`}>
            {children}
          </span>
          {lien && libelleLien && (
            <Link
              href={lien}
              className={`mt-1 inline-block text-[12.5px] ${V2_FORT}`}
              style={{ color: couleur }}
            >
              {libelleLien} →
            </Link>
          )}
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Fermer"
            className="-mr-1 -mt-1 shrink-0 p-1 text-[color:var(--v2-color-gris)] transition-opacity hover:opacity-70"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// Rhabillage du châssis bureau (passe « bureau », 2026-10-05, décision d'Alexandre) : plus de
// carte posée sur le papier, une simple ligne discrète — le bloc de verre/carte de BandeauV2
// se voyait trop sur un écran déjà dense (menu + rail + contenu large). Toujours sur
// `--v2-color-surface`, un filet en bas plutôt qu'une bordure tout autour, le texte à l'encre
// QUEL QUE SOIT LE TON (pas d'ambre, pas de rouge ici : « une ligne discrète », pas une alerte)
// — seul le lien reste en accent, pour qu'il reste le seul élément qui invite au clic. Le
// padding horizontal reprend celui du `<main>` du châssis bureau (34px, voir plus bas) pour que
// le texte s'aligne avec le contenu qu'il surplombe, au lieu de partir du bord de l'écran.
//
// Le SITE (hors bureau) et la PWA sur téléphone gardent leur propre habillage (BandeauV2 ou la
// bannière v1 bleue) — ce composant n'est utilisé QUE derrière `showRailBureau`.
function BandeauBureauV2({ etiquette, children, lien, libelleLien, onDismiss }: {
  etiquette?: string
  children: React.ReactNode
  lien?: string
  libelleLien?: string
  onDismiss?: () => void
}) {
  return (
    <div className="wb-bandeau-v2 border-b border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-[34px] py-2.5">
      <div className="flex items-center gap-3">
        <span className={`min-w-0 flex-1 text-[13px] leading-snug ${V2_POLICE} text-[color:var(--v2-color-encre)]`}>
          {etiquette && (
            <span className="mr-2 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--v2-color-gris)]">
              {etiquette}
            </span>
          )}
          {children}
          {lien && libelleLien && (
            <Link href={lien} className={`ml-2 ${V2_FORT}`} style={{ color: 'var(--v2-color-accent)' }}>
              {libelleLien} →
            </Link>
          )}
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Fermer"
            className="shrink-0 p-1 text-[color:var(--v2-color-gris)] transition-opacity hover:opacity-70"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// Annonce de l'application mobile, en bêta.
//
// Deux règles pour qu'un bandeau d'annonce ne devienne pas un meuble qu'on ne
// voit plus :
//   1. il ne s'affiche pas à qui a DÉJÀ activé les notifications — annoncer une
//      nouveauté à quelqu'un qui s'en sert est le meilleur moyen d'apprendre à
//      ignorer les bandeaux ;
//   2. il se ferme, et la fermeture est retenue d'une visite à l'autre.
//
// Il s'affiche en revanche AUSSI sur ordinateur, contrairement à un premier
// réflexe. L'installation se fait certes sur un téléphone, mais le bandeau
// informe, il ne demande pas d'agir sur-le-champ : un laveur qui gère son
// activité depuis son PC n'apprendrait jamais que l'application existe, et
// n'ouvrirait donc jamais le tableau de bord sur son mobile — précisément
// parce qu'il ignore que c'est possible.
const CLE_FERME = 'wb_annonce_app_beta_fermee'

/** Props communes aux quatre bandeaux, pour la coordination « un seul à la fois » (Alexandre,
 *  2026-10-05) et le rhabillage bureau — voir `BandeauBureauV2` et le commentaire au-dessus de
 *  `ORDRE_BANDEAUX` dans `DashboardShell`. Chaque bandeau continue de décider lui-même, comme
 *  avant, s'il A ENVIE de s'afficher (son propre `localStorage`, ses propres conditions) ; ce
 *  qui change, c'est qu'il le SIGNALE au châssis (`onDisponibiliteChange`) au lieu de s'afficher
 *  directement, et n'affiche réellement son contenu que si `actif` le confirme — c'est-à-dire
 *  si aucun bandeau de priorité plus haute n'est lui-même disponible. */
type PropsBandeau = {
  bureau: boolean
  actif: boolean
  onDisponibiliteChange: (dispo: boolean) => void
}

function AppBetaBanner({ bureau, actif, onDisponibiliteChange }: PropsBandeau) {
  // On part de « masqué » : ce qui décide de l'affichage n'existe que dans le
  // navigateur, et un rendu serveur différent provoquerait un clignotement.
  const [visible, setVisible] = useState(false)
  const isPwa = usePwaStandalone()

  useEffect(() => {
    let annule = false
    ;(async () => {
      try {
        if (localStorage.getItem(CLE_FERME)) return
      } catch {
        // Stockage bloqué (navigation privée, réglage du navigateur) : on
        // affiche quand même, quitte à le remontrer. Mieux vaut un bandeau de
        // trop qu'une annonce que personne ne voit jamais.
      }

      // Déjà abonné aux notifications : il n'a rien à apprendre ici.
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const reg = await navigator.serviceWorker.getRegistration()
          if (await reg?.pushManager.getSubscription()) return
        }
      } catch {
        // Impossible de savoir : on affiche, le guide ne fera de mal à personne.
      }

      if (!annule) setVisible(true)
    })()
    return () => { annule = true }
  }, [])

  // Signalé même quand ce bandeau n'est pas celui qu'on montre : c'est ce qui permet au
  // suivant, dans l'ordre de priorité, de savoir qu'il doit rester caché.
  useEffect(() => { onDisponibiliteChange(visible) }, [visible, onDisponibiliteChange])

  if (!visible || !actif) return null

  function fermer() {
    setVisible(false)
    try { localStorage.setItem(CLE_FERME, '1') } catch { /* rien à faire */ }
  }

  if (bureau) {
    return (
      <BandeauBureauV2 etiquette="Bêta" lien="/dashboard/guide#guide-application" libelleLien="En savoir plus" onDismiss={fermer}>
        Recevez vos réservations en notification sur votre téléphone.
      </BandeauBureauV2>
    )
  }

  if (isPwa) {
    return (
      <BandeauV2
        etiquette="Bêta"
        ton="accent"
        lien="/dashboard/guide#guide-application"
        libelleLien="En savoir plus"
        onDismiss={fermer}
      >
        Recevez vos réservations en notification sur votre téléphone.
      </BandeauV2>
    )
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800 text-sm font-semibold py-2.5 px-3 flex items-center gap-2">
      <div className="flex-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center min-w-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wide bg-blue-600/10 dark:bg-blue-400/15 px-1.5 py-0.5 rounded">Bêta</span>
          Recevez vos réservations en notification sur votre téléphone.
        </span>
        <Link
          href="/dashboard/guide#guide-application"
          className="underline font-bold whitespace-nowrap hover:opacity-70"
        >
          En savoir plus →
        </Link>
      </div>
      <DismissButton onDismiss={fermer} />
    </div>
  )
}

// Fermer le bandeau d'essai le fermait pour CETTE page seulement : chaque écran rend son
// propre châssis, et il revenait au changement d'onglet (Alexandre, 2026-09-27). Le choix est
// donc retenu sur l'appareil, et repéré par ce que le bandeau ANNONCE — « 23 jours restants ».
// Il se rouvre de lui-même quand ce repère change, c'est-à-dire quand un jour tombe : le
// laveur n'a pas à le revoir dix fois par jour, mais il ne peut pas non plus l'oublier
// jusqu'à l'expiration.
const CLE_BANDEAU_ESSAI = 'wb-bandeau-essai'

// Annonce des 4 offres 2026, une seule fois par laveur.
//
// Même règle de fermeture que AppBetaBanner : une fois fermé, on ne le
// remontre plus. Contrairement à celui-ci, il n'y a pas de condition de
// masquage automatique (« déjà activé les notifications ») — l'information
// concerne tout le monde, y compris un client historique à l'accès complet,
// qui garde le même accès quoi qu'il arrive mais peut vouloir savoir que
// l'offre existe désormais pour en parler à un confrère.
const CLE_FERMEE_OFFRES_2026 = 'wb_annonce_offres_2026_fermee'

function NouvellesOffresBanner({ bureau, actif, onDisponibiliteChange }: PropsBandeau) {
  // Comme pour AppBetaBanner : on part de masqué pour éviter un clignotement
  // au premier rendu serveur, avant de savoir si ce laveur l'a déjà fermé.
  const [visible, setVisible] = useState(false)
  const isPwa = usePwaStandalone()

  useEffect(() => {
    let annule = false
    ;(async () => {
      let fermee = false
      try {
        fermee = !!localStorage.getItem(CLE_FERMEE_OFFRES_2026)
      } catch {
        // Stockage bloqué : on affiche quand même, voir la justification de
        // AppBetaBanner ci-dessus — un bandeau de trop plutôt qu'une annonce
        // que personne ne voit.
      }
      if (!annule && !fermee) setVisible(true)
    })()
    return () => { annule = true }
  }, [])

  useEffect(() => { onDisponibiliteChange(visible) }, [visible, onDisponibiliteChange])

  if (!visible || !actif) return null

  function fermer() {
    setVisible(false)
    try { localStorage.setItem(CLE_FERMEE_OFFRES_2026, '1') } catch { /* rien à faire */ }
  }

  if (bureau) {
    return (
      <BandeauBureauV2 etiquette="Nouveau" lien="/dashboard/abonnement" libelleLien="Voir les offres" onDismiss={fermer}>
        WashBoard passe à 4 offres — Découverte, Starter, Pro, Business.
      </BandeauBureauV2>
    )
  }

  if (isPwa) {
    return (
      <BandeauV2
        etiquette="Nouveau"
        ton="nouveau"
        lien="/dashboard/abonnement"
        libelleLien="Voir les offres"
        onDismiss={fermer}
      >
        WashBoard passe à 4 offres — Découverte, Starter, Pro, Business.
      </BandeauV2>
    )
  }

  return (
    <div className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-b border-indigo-200 dark:border-indigo-800 text-sm font-semibold py-2.5 px-3 flex items-center gap-2">
      <div className="flex-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center min-w-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wide bg-indigo-600/10 dark:bg-indigo-400/15 px-1.5 py-0.5 rounded">Nouveau</span>
          WashBoard passe à 4 offres — Découverte, Starter, Pro, Business.
        </span>
        <Link
          href="/dashboard/abonnement"
          className="underline font-bold whitespace-nowrap hover:opacity-70"
        >
          Voir les offres →
        </Link>
      </div>
      <DismissButton onDismiss={fermer} />
    </div>
  )
}

// Annonce de la nouvelle application (refonte 2026), une seule fois par
// laveur — et UNIQUEMENT sur le site, jamais dans l'application installée
// (demande explicite d'Alexandre, 2026-10-01) : inviter quelqu'un à essayer
// la nouvelle version alors qu'il s'en sert déjà n'aurait aucun sens, et
// laisserait croire qu'il manque quelque chose à ce qu'il a sous les yeux.
const CLE_FERMEE_ANNONCE_PWA = 'wb_annonce_pwa_2026_fermee'

function AnnoncePwaBanner({ bureau, actif, onDisponibiliteChange }: PropsBandeau) {
  const isPwa = usePwaStandalone()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isPwa) return
    let annule = false
    ;(async () => {
      let fermee = false
      try {
        fermee = !!localStorage.getItem(CLE_FERMEE_ANNONCE_PWA)
      } catch {
        // Stockage bloqué : on affiche quand même, voir AppBetaBanner.
      }
      if (!annule && !fermee) setVisible(true)
    })()
    return () => { annule = true }
  }, [isPwa])

  // Jamais dans l'application installée (voir l'en-tête du fichier) : on le signale comme
  // indisponible plutôt que de laisser le châssis attendre un signal qui ne viendra jamais.
  useEffect(() => { onDisponibiliteChange(!isPwa && visible) }, [isPwa, visible, onDisponibiliteChange])

  if (isPwa || !visible || !actif) return null

  function fermer() {
    setVisible(false)
    try { localStorage.setItem(CLE_FERMEE_ANNONCE_PWA, '1') } catch { /* rien à faire */ }
  }

  if (bureau) {
    return (
      <BandeauBureauV2 etiquette="Nouveau" lien="/dashboard/guide#guide-application" libelleLien="En savoir plus" onDismiss={fermer}>
        WashBoard évolue — venez essayer la nouvelle version de l&apos;application.
      </BandeauBureauV2>
    )
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800 text-sm font-semibold py-2.5 px-3 flex items-center gap-2">
      <div className="flex-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center min-w-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wide bg-blue-600/10 dark:bg-blue-400/15 px-1.5 py-0.5 rounded">Nouveau</span>
          WashBoard évolue — venez essayer la nouvelle version de l&apos;application.
        </span>
        <Link
          href="/dashboard/guide#guide-application"
          className="underline font-bold whitespace-nowrap hover:opacity-70"
        >
          En savoir plus →
        </Link>
      </div>
      <DismissButton onDismiss={fermer} />
    </div>
  )
}

function TrialBanner({ trialEndsAt, subscriptionStatus, stripeSubscriptionId, cancelsAt, choisirFormule, grandfathered, subscriptionEndsAt, bureau, actif, onDisponibiliteChange }: {
  trialEndsAt?: string | null; subscriptionStatus?: string | null; stripeSubscriptionId?: string | null; cancelsAt?: string | null; choisirFormule?: boolean; grandfathered?: boolean; subscriptionEndsAt?: string | null
} & PropsBandeau) {
  const [ferme, setFerme] = usePreferenceLocale(CLE_BANDEAU_ESSAI)
  const [now] = useState(() => Date.now())
  const isPwa = usePwaStandalone()

  /** Rend le bandeau, ou rien s'il a déjà été fermé pour ce repère. */
  const bandeau = (repere: string, contenu: (fermer: () => void) => React.ReactElement) =>
    (ferme === repere ? null : contenu(() => setFerme(repere)))

  // Habillage v1 par ton — repris à l'identique de ce que chaque état rendait
  // avant, pour que le site ne bouge pas d'un pixel.
  const HABIT_V1: Record<TonBandeau | 'urgent' | 'expire', string> = {
    accent: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800',
    nouveau: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800',
    vert: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800',
    ambre: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800',
    rouge: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800',
    urgent: 'bg-orange-500 text-white',
    expire: 'bg-red-600 text-white',
  }

  /** Un état du bandeau, dans la forme de la version en cours. Tout bandeau se ferme
   *  (demandé par Alexandre, 2026-09-30) : la porte vers les offres reste dans le menu. */
  const etat = (
    ton: TonBandeau, habitV1: keyof typeof HABIT_V1,
    texte: React.ReactNode, libelleLien: string, fermer?: () => void,
  ) => {
    if (bureau) {
      return (
        <BandeauBureauV2 lien="/dashboard/abonnement" libelleLien={libelleLien} onDismiss={fermer}>
          {texte}
        </BandeauBureauV2>
      )
    }
    if (isPwa) {
      return (
        <BandeauV2 ton={ton} lien="/dashboard/abonnement" libelleLien={libelleLien} onDismiss={fermer}>
          {texte}
        </BandeauV2>
      )
    }
    return (
      <div className={`text-sm font-semibold py-2.5 px-3 flex items-center gap-2 ${HABIT_V1[habitV1]}`}>
        <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center min-w-0">
          <span>{texte}</span>
          <Link href="/dashboard/abonnement" className="underline font-bold whitespace-nowrap hover:opacity-70">
            {libelleLien} →
          </Link>
        </div>
        {fermer && <DismissButton onDismiss={fermer} />}
      </div>
    )
  }

  // Toute la logique ci-dessous décide seulement CE QUE ce bandeau voudrait montrer
  // (`contenu`, nullable) — jamais si on l'affiche vraiment : ça, c'est `actif` (coordination
  // « un seul à la fois », voir `PropsBandeau`) qui en décide, plus bas. Repliée dans une
  // fonction plutôt que des `return` directs dans `TrialBanner`, pour pouvoir signaler le
  // résultat (`onDisponibiliteChange`) avant de rendre quoi que ce soit.
  const contenu = ((): React.ReactElement | null => {
    // Essai terminé, aucune formule choisie, et le compte suit la règle 2026 :
    // il tourne sur Découverte. Rien n'est cassé — donc pas de rouge, pas de
    // « votre compte va être suspendu ». Cette branche passe AVANT les autres :
    // sans elle, le laveur lirait « Votre période d'essai a expiré » en rouge
    // alors que sa page de réservation fonctionne toujours.
    if (choisirFormule) {
      return bandeau('choisir-formule', fermer => etat(
        'accent', 'accent',
        'Essai terminé — vous êtes sur l’offre Découverte, gratuite. Choisissez votre formule quand vous voulez.',
        'Voir les offres', fermer,
      ))
    }

    // Résiliation programmée : abonnement encore actif jusqu'à la date de fin
    if (cancelsAt && (subscriptionStatus === 'active' || subscriptionStatus === 'trial')) {
      return bandeau(`resilie-${cancelsAt}`, fermer => etat(
        'rouge', 'rouge',
        <>Abonnement résilié — valable jusqu&apos;au {formatDateFR(cancelsAt)}</>,
        'Réactiver', fermer,
      ))
    }

    if (!subscriptionStatus || subscriptionStatus === 'active') return null

    // Client historique dont la période payée court encore (`subscription_ends_at` dans le futur) :
    // son statut peut dire « expired » (reliquat de l'ancien essai), mais il a tout ouvert et rien
    // n'est échu — lui afficher « votre essai a expiré » serait faux (constaté sur AutoNett,
    // 2026-09-30 : grandfathered, échéance au 14 octobre).
    if (grandfathered && subscriptionEndsAt && new Date(subscriptionEndsAt).getTime() > now) return null

    if (subscriptionStatus === 'expired') {
      return bandeau('expire', fermer => etat(
        'rouge', 'expire',
        'Votre période d’essai a expiré. Activez votre abonnement pour continuer à utiliser WashBoard.',
        'Voir les offres', fermer,
      ))
    }

    if (subscriptionStatus === 'trial' && trialEndsAt) {
      const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24))
      const isUrgent = daysLeft <= 7

      // Carte enregistrée, facturation différée
      if (isCardRegistered(stripeSubscriptionId, subscriptionStatus)) {
        return bandeau(`carte-${daysLeft}`, fermer => etat(
          'vert', 'vert',
          <>✓ Carte enregistrée — facturation dans {daysLeft} jour{daysLeft > 1 ? 's' : ''}</>,
          'Gérer', fermer,
        ))
      }

      if (daysLeft <= 0) {
        return bandeau('essai-expire', fermer => etat('rouge', 'expire', 'Votre période d’essai a expiré.', 'Activer mon abonnement', fermer))
      }

      return bandeau(`essai-${daysLeft}`, fermer => etat(
        isUrgent ? 'ambre' : 'accent', isUrgent ? 'urgent' : 'accent',
        <>Essai gratuit — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}</>,
        'Voir l’abonnement', fermer,
      ))
    }

    return null
  })()

  const dispo = contenu !== null
  useEffect(() => { onDisponibiliteChange(dispo) }, [dispo, onDisponibiliteChange])

  return actif ? contenu : null
}

export function DashboardShell({ washerName, children, trialEndsAt, subscriptionStatus, plan, grandfathered, stripeSubscriptionId, cancelsAt, createdAt, slug, subscriptionEndsAt, visiteGuidee, betaRefonte }: Props) {
  // Reconstitué ici plutôt que calculé dans chacune des douze pages : une
  // règle recopiée douze fois est une règle qui finit par diverger.
  const fiche = {
    plan, grandfathered, slug,
    created_at: createdAt,
    subscription_status: subscriptionStatus,
    trial_ends_at: trialEndsAt,
    subscription_ends_at: subscriptionEndsAt,
  }
  const offreEffective = planEffectif(fiche)

  // Ce que l'offre actuelle ne couvre pas, signalé dans le menu par le nom de
  // l'offre qui l'ouvre. Avant, ces entrées étaient identiques aux autres : on
  // cliquait, on tombait sur un mur, et rien n'avait prévenu. Le badge le dit
  // d'avance, et l'entrée reste cliquable — c'est en voyant l'aperçu qu'on a
  // envie de l'offre, pas en butant sur une porte fermée.
  const badgesOffre = Object.fromEntries(
    ([
      ['/dashboard/crm', 'crm'],
      ['/dashboard/compta', 'compta'],
      ['/dashboard/factures', 'facturation'],
    ] as [string, Feature][])
      .filter(([, f]) => !hasFeature(fiche, f))
      .map(([href, f]) => {
        const requis = requiredPlan(f)
        return [href, { label: PLAN_LABELS[requis], couleur: PLAN_COULEURS[requis] }]
      }),
  )
  const complet = accesComplet(fiche)
  const offreCourante = useMemo(
    () => ({ offre: offreEffective, peut: (f: Feature) => hasFeature(fiche, f) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offreEffective, plan, grandfathered, slug, createdAt, subscriptionStatus, trialEndsAt, subscriptionEndsAt],
  )
  const choisirFormule = doitChoisirFormule(fiche)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Barre du bas (refonte 2026, passe 4) : uniquement dans la PWA installée
  // (usePwaStandalone — la FORME du châssis change, une nav en plus apparaît,
  // donc le hook plutôt que la classe CSS `wb-pwa`, voir globals.css). Depuis le
  // 2026-10-01, plus de filtre `beta_refonte` : toute application installée reçoit
  // la refonte. Le menu latéral (Sidebar, juste en dessous) n'est JAMAIS conditionné
  // par cette variable : il reste le filet de secours tant que les passes 5 et 6 ne
  // sont pas faites.
  const isPwa = usePwaStandalone()
  // Passe « châssis bureau » (2026-10-05, Alexandre, 2026-10-03) : sur grand écran, les 5
  // destinations deviennent le rail vertical (RailBureauV2) plutôt que la barre du bas — il
  // n'y a plus de pouce à ménager, mais toujours un menu à montrer. `useDashboardV2` dit si
  // CET écran doit être en v2 (PWA, n'importe quelle largeur ; OU site + grand écran +
  // `washer.beta_refonte`) ; `useGrandEcran` dit laquelle des deux formes de nav v2 s'applique.
  // Combinées :
  //   - PWA sur téléphone        → estV2 vrai, grandEcran faux  → barre du bas (inchangé)
  //   - Site, mobile ou étroit   → estV2 faux                   → v1 (menu + en-tête), inchangé
  //   - Site, grand écran + flag → estV2 vrai, grandEcran vrai  → rail
  //   - PWA sur ordinateur       → estV2 vrai, grandEcran vrai  → rail (cohérent avec le fait
  //     que la PWA voit toujours la v2, quelle que soit sa largeur — voir useDashboardV2.ts)
  // Un découpage à la largeur réelle (pas à `isPwa` seul) : avant cette passe, une PWA ouverte
  // sur ordinateur recevait encore la barre du bas, pensée pour un pouce qui n'existe plus là.
  const estV2 = useDashboardV2(betaRefonte)
  const grandEcran = useGrandEcran()
  const showBarreBas = isPwa && !grandEcran
  const showRailBureau = estV2 && grandEcran
  // La classe `wb-pwa` est posée sur <html> avant React ; si React réécrit `className`
  // (changement de thème, rafraîchissement du layout), elle disparaît et des règles CSS de la
  // refonte cessent de s'appliquer. On la remet dès qu'elle manque.
  //
  // `wb-barre-bas` / `wb-bureau` disent aux règles CSS laquelle des deux navs v2 est à l'écran
  // (papier de fond, voir globals.css). Ce repère était auparavant lu directement dans le DOM
  // (`body:has(.wb-barre-bas-verre)`) : Turbopack, qui construit les déploiements, abandonne
  // TOUT le fichier CSS à partir du premier `:has()` rencontré — la refonte partait donc en
  // production sans ses couleurs.
  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('wb-barre-bas', showBarreBas)
    html.classList.toggle('wb-bureau', showRailBureau)
    if (!isPwa) return
    const remettre = () => { if (!html.classList.contains('wb-pwa')) html.classList.add('wb-pwa') }
    remettre()
    const obs = new MutationObserver(remettre)
    obs.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [isPwa, showBarreBas, showRailBureau])
  // Décoratif (voir useSupportUnreadBadge) : porté ici pour n'interroger
  // /api/support/non-lues qu'une fois par page, puis partagé entre le menu
  // (Sidebar), le bouton ☰ juste en dessous — qui doivent montrer le même
  // nombre, sinon un laveur qui n'ouvre jamais le menu sur mobile ne verrait
  // jamais le compteur — et, dans la PWA en bêta où ni l'un ni l'autre
  // n'existe plus, l'écran « Plus » (via SupportBadgesContext).
  const unreadSupportCount = useSupportUnreadBadge()
  // Pendant équipe : nombre de messages de laveurs non lus par l'équipe.
  // Appelé pour tout compte (voir useSupportUnreadTeamBadge) — silencieux et
  // toujours `null` pour un laveur qui n'est pas de l'équipe.
  const unreadTeamCount = useSupportUnreadTeamBadge()
  // Idem : un seul appel à /api/support/est-equipe par page, partagé avec le
  // menu qui seul en a besoin ici.
  const estEquipeSupport = useEstEquipeSupport()
  // Chiffre unique affiché sur le bouton ☰ : la somme des deux compteurs,
  // voir `libelleBoutonMenu` juste au-dessus pour le pourquoi.
  const menuBadgeCount = (unreadSupportCount ?? 0) + (unreadTeamCount ?? 0)
  const supportBadges = useMemo(
    () => ({ estEquipeSupport, unreadSupportCount, unreadTeamCount }),
    [estEquipeSupport, unreadSupportCount, unreadTeamCount],
  )

  // Socle mobile (refonte 2026, passe 0) : pose sur <body> la classe qui
  // neutralise le rebond de défilement (voir globals.css,
  // `body.wb-dashboard-active`), tant que ce composant est monté. Même
  // mécanisme que `wb-hide-fab` un peu plus bas dans ce fichier. Limité au
  // dashboard : le reste du site (landing, blog, /book/[slug]) doit garder
  // le tirer-pour-rafraîchir natif.
  useEffect(() => {
    document.body.classList.add('wb-dashboard-active')
    return () => document.body.classList.remove('wb-dashboard-active')
  }, [])

  // La barre du bas flotte sur toute la largeur (left-3 right-3), au même
  // coin que le bouton WhatsApp (data-wb-whatsapp-fab, bottom-right) : sans
  // ça, la bulle resterait posée PAR-DESSUS la barre, au même titre que le
  // panneau de question (voir globals.css, body.wb-hide-fab, et
  // ClientProfileModalV2 qui utilise déjà exactement ce mécanisme).
  useEffect(() => {
    if (!showBarreBas) return
    document.body.classList.add('wb-hide-fab')
    return () => document.body.classList.remove('wb-hide-fab')
  }, [showBarreBas])

  // PWA en bêta : la barre d'état du téléphone prend le papier de la refonte, pour que le
  // beige (ou le gris foncé) monte jusqu'en haut de l'écran (demande d'Alexandre, 2026-09-25).
  //
  // La couleur elle-même est écrite par le SERVEUR dans le HTML de la page (voir
  // `generateViewport`, layout.tsx) : iOS ne lit `theme-color` qu'à ce moment-là, une balise
  // posée ensuite par JavaScript n'était prise en compte qu'au changement d'onglet suivant.
  // Comme le serveur ne peut pas savoir qu'on tourne dans l'application installée, c'est ce
  // cookie qui le lui dit — il prend donc effet au lancement SUIVANT.
  //
  // Le cookie est RETIRÉ hors de l'application installée : sur Android, le navigateur et
  // l'application partagent leurs cookies, et le site doit garder ses couleurs à lui.
  useEffect(() => {
    if (!isPwa) {
      document.cookie = 'wb_pwa_beta=; path=/; max-age=0; samesite=lax'
      return
    }
    document.cookie = `wb_pwa_beta=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
    // Rien à changer dans la page en cours : Next réécrit ses propres balises `theme-color`
    // (essayé, ça ne tient pas), et de toute façon iOS ne relit la couleur qu'au lancement.
    // Changer de thème en séance se voit donc au lancement suivant, lui aussi.
  }, [isPwa])

  // Contenu de page, identique quel que soit le châssis — isolé une seule fois pour ne pas
  // dupliquer les deux Providers entre la branche v1/PWA-téléphone et la branche bureau.
  const pageContent = (
    <SupportBadgesContext.Provider value={supportBadges}>
      <OffreContext.Provider value={offreCourante}>
        {children}
      </OffreContext.Provider>
    </SupportBadgesContext.Provider>
  )

  // Un seul bandeau visible à la fois, par ordre de priorité (Alexandre, 2026-10-05 : « je veux
  // qu'elle apparaisse qu'une seule fois ») — avant cette passe, jusqu'à trois des quatre
  // pouvaient s'empiler (fin d'essai + annonce PWA + nouvelles offres), trois lignes bleues
  // en haut du châssis bureau. Chaque bandeau garde EXACTEMENT sa logique d'avant (sa propre
  // clé `localStorage`, ses propres conditions d'affichage) : ce qui change, c'est qu'il
  // signale sa disponibilité ici plutôt que de s'afficher directement dès qu'il le peut, et
  // `estBandeauActif` ci-dessous ne laisse passer que le premier disponible dans cet ordre.
  // Priorité : l'essai/la facturation (ça touche à l'argent) d'abord, puis les annonces
  // produit, dans l'ordre où elles apparaissaient déjà.
  const ORDRE_BANDEAUX = ['trial', 'annoncePwa', 'offres2026', 'appBeta'] as const
  const [dispoBandeaux, setDispoBandeaux] = useState<Record<(typeof ORDRE_BANDEAUX)[number], boolean>>({
    trial: false, annoncePwa: false, offres2026: false, appBeta: false,
  })
  // Identité stable (deps vides) : sans ça, chaque bandeau recevrait une fonction différente à
  // chaque rendu de DashboardShell et redéclencherait son effet de signalement en boucle.
  const rapporterTrial = useCallback((d: boolean) => setDispoBandeaux(s => (s.trial === d ? s : { ...s, trial: d })), [])
  const rapporterAnnoncePwa = useCallback((d: boolean) => setDispoBandeaux(s => (s.annoncePwa === d ? s : { ...s, annoncePwa: d })), [])
  const rapporterOffres2026 = useCallback((d: boolean) => setDispoBandeaux(s => (s.offres2026 === d ? s : { ...s, offres2026: d })), [])
  const rapporterAppBeta = useCallback((d: boolean) => setDispoBandeaux(s => (s.appBeta === d ? s : { ...s, appBeta: d })), [])
  const estBandeauActif = (cle: (typeof ORDRE_BANDEAUX)[number]): boolean => {
    const rang = ORDRE_BANDEAUX.indexOf(cle)
    return dispoBandeaux[cle] && ORDRE_BANDEAUX.slice(0, rang).every(c => !dispoBandeaux[c])
  }

  // Chaque composant décide toujours lui-même sa propre FORME via `usePwaStandalone()` interne
  // (BandeauV2 en carte pour la PWA téléphone, bannière v1 pleine largeur sinon) ; `bureau`
  // ci-dessous est la seule information qu'il ne pouvait pas deviner seul — le rail n'existant
  // pas avant cette passe — et sélectionne la troisième forme, la ligne discrète (BandeauBureauV2).
  const bandeaux = (
    <>
      <TrialBanner
        trialEndsAt={trialEndsAt} subscriptionStatus={subscriptionStatus} stripeSubscriptionId={stripeSubscriptionId}
        cancelsAt={cancelsAt} choisirFormule={choisirFormule} grandfathered={grandfathered} subscriptionEndsAt={subscriptionEndsAt}
        bureau={showRailBureau} actif={estBandeauActif('trial')} onDisponibiliteChange={rapporterTrial}
      />
      <AnnoncePwaBanner bureau={showRailBureau} actif={estBandeauActif('annoncePwa')} onDisponibiliteChange={rapporterAnnoncePwa} />
      <NouvellesOffresBanner bureau={showRailBureau} actif={estBandeauActif('offres2026')} onDisponibiliteChange={rapporterOffres2026} />
      <AppBetaBanner bureau={showRailBureau} actif={estBandeauActif('appBeta')} onDisponibiliteChange={rapporterAppBeta} />
    </>
  )

  return (
    // PWA en bêta OU châssis bureau : tout le fond de l'écran est le papier de la refonte
    // (`--v2-color-fond`), pas seulement le rectangle que dessine chaque écran v2 — sinon les
    // bords et le bas de la page restent gris-bleu autour d'un rectangle beige (signalé par
    // Alexandre, 2026-09-25, pour la barre du bas ; même raisonnement pour le rail). Site et
    // PWA sans bêta : inchangé.
    <div
      className={`min-h-screen overflow-x-hidden wb-dashboard-shell ${
        showBarreBas || showRailBureau ? 'bg-[color:var(--v2-color-fond)]' : 'bg-slate-50 dark:bg-slate-950'
      }`}
    >
      {/* Menu latéral : retiré dans la PWA en bêta (refonte 2026, 2026-09-24) et dans le
          châssis bureau (passe « bureau », 2026-10-05) — dans les deux cas, le bouton ☰ qui
          l'ouvre a disparu avec l'en-tête, et le laisser monté offrirait des liens
          focalisables au clavier sur un tiroir que rien ne peut ouvrir. Tout ce qu'il donnait
          reste atteignable : les 5 destinations (barre du bas ou rail selon l'écran), et
          « Plus » pour le reste (guide, export et liens par réseau, assistance, abonnement,
          réglages, et l'outil interne de l'équipe). Liste vérifiée page par page dans
          TODO.md. Site étroit et PWA sans bêta : inchangé, le menu reste monté. */}
      {!showBarreBas && !showRailBureau && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          unreadSupportCount={unreadSupportCount}
          estEquipeSupport={estEquipeSupport}
          unreadTeamCount={unreadTeamCount}
          badgesOffre={badgesOffre}
        />
      )}

      {showBarreBas && <BarreBasV2 />}
      {isPwa && <ConfirmationEnvoiV2 />}
      {showBarreBas && <RetourGesteV2 />}

      {showRailBureau ? (
        // Châssis bureau (passe « bureau », 2026-10-05) : le rail remplace l'en-tête ET le
        // menu latéral — plus de hamburger, plus d'ancien en-tête. Rangée plutôt que colonne
        // empilée : le rail doit occuper toute la hauteur disponible à côté du contenu, pas
        // être poussé par lui (voir RailBureauV2.tsx pour ce qu'il porte).
        //
        // `h-screen` ici, PAS `min-h-screen` : un `min-height` ne fait que poser un plancher,
        // il n'empêche pas la ligne de grandir au-delà si son contenu le demande. Avec
        // `min-h-screen` (bug trouvé en capturant cette passe), le panneau de fiche de
        // Clients (600px) + les bandeaux poussaient la colonne de droite, donc CETTE ligne,
        // au-delà de la hauteur de l'écran — ce qui repoussait « Documents » et le pied du
        // rail hors du cadre visible, qui lui s'étire pour suivre (`align-items: stretch`,
        // par défaut). `h-screen` fixe la hauteur une fois pour toutes ; c'est `min-h-0` sur
        // la colonne de droite et sur `<main>` (overflow-y-auto) qui fait le reste : eux
        // défilent, le rail jamais.
        <div className="flex h-screen overflow-hidden">
          <RailBureauV2
            washerName={washerName}
            isPwa={isPwa}
            offreLabel={complet ? 'Accès complet' : PLAN_LABELS[offreEffective]}
            offreCouleur={complet ? null : PLAN_COULEURS[offreEffective]}
          />
          {/* `min-w-0`/`min-h-0` : sans eux, un enfant flex refuse de rétrécir sous la taille
              de son contenu (ex. une ligne de tableau large, ou le panneau de fiche) et
              pousserait le rail hors de l'écran au lieu de laisser `<main>` défiler seul. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {bandeaux}
            {/* Plus de `max-w-3xl mx-auto` : c'est tout le but de cette passe — donner au
                contenu la largeur restante, en particulier au panneau de fiche de Clients
                (ClientsViewV2.tsx, qui perd ici son propre plafond interne pour en profiter
                réellement — voir son en-tête). Les écrans pas encore migrés en v2 (Aujourd'hui,
                Agenda, Chiffres, Plus) héritent de cette largeur sans la demander : ils
                s'étirent, visibles sur les captures de la passe — attendu, pas corrigé ici. */}
            <main id="main-content" className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[34px] pt-[26px] pb-10">
              {pageContent}
            </main>
          </div>
        </div>
      ) : (
        <>
          {/* En-tête. La classe `wb-entete-beta` le réduit, par CSS et sans flash, à ses
              seuls bandeaux : la rangée ☰ / titre / badge de plan / déconnexion / thème
              (`wb-entete-barre`) est masquée, et le bloc perd son statut collant, son fond
              et son filet — voir globals.css. Les bandeaux (fin d'essai, paiement,
              résiliation, annonce) restent : information commerciale, ils ne sont jamais
              retirés. Ces règles sont portées par `html.wb-pwa` : sur le site, aucune ne
              s'applique et l'en-tête est identique à celui d'avant. */}
          <header
            className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 wb-entete-beta"
            // Dans la PWA en bêta, l'en-tête n'est plus qu'un porte-bandeaux : décidé ici, en JSX,
            // et pas seulement par la classe `wb-pwa` de <html> (que React peut effacer en
            // réécrivant `className`) — sinon la rangée v1 réapparaissait au fil de la navigation.
            style={showBarreBas ? { position: 'static', background: 'transparent', borderBottomWidth: 0 } : undefined}
          >
            {bandeaux}
            {!showBarreBas && <div className="wb-entete-barre w-full px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label={libelleBoutonMenu(unreadSupportCount, unreadTeamCount)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <line x1="3" y1="12" x2="21" y2="12"/>
                    <line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                  {/* Filet pour qui n'a pas activé les notifications : le menu est
                      replié derrière ce bouton sur mobile, le compteur doit donc
                      être visible ICI, pas seulement dans le menu ouvert. Le
                      libellé est déjà porté par l'aria-label du bouton
                      (announce=false) pour ne pas l'annoncer deux fois. */}
                  <span className="absolute -top-1 -right-1">
                    <UnreadCountBadge
                      count={menuBadgeCount}
                      label=""
                      announce={false}
                      variant="solid"
                      className="border-2 border-white dark:border-slate-900"
                    />
                  </span>
                </button>

                {/* Pas de logo ici : il est déjà dans le menu (trois barres). Dans
                    l'en-tête, il se répétait à côté du nom et encombrait la ligne
                    sur téléphone — retiré à la demande d'Alexandre le 2026-09-15. */}
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 leading-none tracking-tight truncate">WashBoard</p>
                  {/* Pas de fiche laveur (ex. compte support) : rien à afficher ici
                      plutôt qu'un texte inventé — le contenu de la page se charge
                      déjà de dire à qui appartient le compte connecté. */}
                  {washerName && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-none truncate hidden sm:block">{washerName}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Le badge d'abonnement n'a de sens que pour un compte laveur :
                    sans fiche, `plan` vaudrait toujours « essentiel » par défaut,
                    ce qui laisserait croire à un abonnement qui n'existe pas. */}
                {washerName && <PlanBadge grandfathered={complet} effectif={offreEffective} />}
                <form action="/api/auth/logout" method="POST">
                  <button
                    aria-label="Se déconnecter"
                    className="h-9 min-w-9 sm:h-10 sm:min-w-10 flex items-center justify-center px-0 sm:px-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-semibold border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                  >
                    <span className="hidden sm:inline">Déconnexion</span>
                    <span className="sm:hidden flex">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                      </svg>
                    </span>
                  </button>
                </form>
                <ThemeToggle header />
              </div>
            </div>}
          </header>

          <main
            id="main-content"
            className="max-w-3xl mx-auto px-3 sm:px-4 pt-6 pb-24 sm:pb-6 overflow-x-hidden"
            // La barre du bas flotte par-dessus le contenu (position: fixed) :
            // sans réserve explicite, elle couvrirait les dernières lignes d'une
            // longue page. `pb-24`/`sm:pb-6` ci-dessus suffisaient au bouton
            // WhatsApp seul ; la barre est plus haute (66px + 14px d'écart + encoche)
            // — d'où ce style qui prend le pas sur les deux classes Tailwind quand
            // elle est affichée (PWA sur téléphone uniquement : sur ordinateur, voir
            // la branche `showRailBureau` ci-dessus, qui n'a plus cette barre).
            style={showBarreBas ? { paddingBottom: 'calc(66px + 14px + 8px + env(safe-area-inset-bottom, 0px))' } : undefined}
          >
            {pageContent}
          </main>
        </>
      )}

      <VisiteGuidee aFaire={visiteGuidee} />

      {/* Retiré dans la PWA en bêta et dans le châssis bureau : posé sous la barre du bas, il
          allongeait la page de plus d'un écran de vide et passait sous la barre (2026-09-25) ;
          absent de la maquette bureau pour la même raison de principe (le rail n'a pas de
          pied de page sous lui). */}
      {!showBarreBas && !showRailBureau && (
      <footer className="max-w-3xl mx-auto px-3 sm:px-4 pb-6 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-600">
          Créé par{' '}
          <a
            href="https://novaflows.fr/realisations"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-500 transition-colors font-medium"
          >
            NovaFlows
          </a>
        </p>
      </footer>
      )}

      {/* Bouton WhatsApp flottant. data-wb-whatsapp-fab : accroche pour le
          masquer (globals.css) pendant qu'un panneau de question est ouvert —
          les deux se disputent le coin bas-droit au même z-index.
          Le bottom en calc() ci-dessous décale le bouton au-dessus de la
          zone d'encoche/barre d'accueil (safe-area-inset-bottom) au lieu de
          se faire chevaucher par elle — sans viewportFit=cover (layout.tsx)
          cette variable vaudrait 0 et la ligne ne changerait rien. */}
      <a
        href="https://wa.me/33684140438"
        target="_blank"
        rel="noopener noreferrer"
        data-wb-whatsapp-fab
        className="fixed right-3 sm:right-6 z-50 flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold p-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-lg shadow-green-500/30 transition-all hover:scale-105 bottom-[calc(1rem_+_env(safe-area-inset-bottom))] sm:bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))]"
        aria-label="Contacter le support WhatsApp"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span className="hidden sm:inline">Support</span>
      </a>
    </div>
  )
}
