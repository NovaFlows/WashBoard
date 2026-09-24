'use client'

import { DiagnosticPwa } from '@/components/dashboard/DiagnosticPwa'
import Link from 'next/link'
import type { Washer } from '@/types'
import { hasFeature, PLAN_LABELS } from '@/lib/plan'
import { nombreActifs } from '@/lib/messagesAutomatiques'
import { useTheme } from '@/components/ui/ThemeProvider'
import { useSupportBadges } from '@/components/dashboard/SupportBadgesContext'

// « Plus » — refonte 2026, passe 6. Présentation v2 de l'écran de réglages,
// réservée à la PWA installée en mode standalone (voir ParametresForm.tsx, le
// point de branchement ; décision d'Alexandre, 2026-09-22 : le site reste v1
// sans exception). Planche `project/Reglages.dc.html` de la maquette.
//
// Différence de FOND avec l'ancien écran (deux onglets, un formulaire géant) :
// ici, un menu — « rangé par fréquence : de temps en temps / une fois / mon
// compte » (`.claude/agents/refonte.md`, « L'architecture : 5 destinations »).
// Chaque ligne renvoie soit vers un écran existant qui a déjà sa route
// (`/dashboard/admin`, `/dashboard/abonnement`, `/dashboard/assistance`), soit
// vers `/dashboard/parametres/tout` — la nouvelle route qui rend l'ancien
// formulaire complet tel quel (ParametresFormV1, réutilisé sans modification),
// pour les réglages qui n'ont pas encore leur propre écran v2 (Équipe ; les
// Messages automatiques ont le leur depuis le 2026-09-24 :
// `/dashboard/parametres/messages`). Aucune requête ni aucun calcul n'est dupliqué ici :
// cet écran est un sommaire, pas une nouvelle source de vérité.
//
// Dernière ligne du menu (« Tous les réglages »), absente de la maquette :
// ajoutée pour éviter le bug qui a tué la première version du CRM (six pages
// orphelines, voir refonte.md). Sans elle, l'email, le mot de passe, les
// notifications, l'accès support et la zone de danger n'auraient plus AUCUN
// chemin depuis la PWA — le menu latéral (Sidebar) pointe lui aussi vers
// `/dashboard/parametres`, qui affiche maintenant ce menu v2 en PWA. Signalé
// dans le compte rendu de la passe : à répartir sur ses propres lignes du
// menu au fur et à mesure que ces réglages ont leur écran v2 dédié.
//
// 2026-09-24 — l'en-tête (☰, titre, badge de plan, déconnexion, thème) et le
// menu latéral disparaissent de la PWA en bêta (voir DashboardShell.tsx,
// `wb-entete-beta` dans globals.css). « Plus » devient alors le SEUL chemin
// vers ce que le menu donnait et que ni la barre du bas ni Chiffres
// n'atteignent : le guide, l'ancien écran CRM (export Excel, liens par
// réseau — sans le mot « CRM »), et pour l'équipe l'outil interne « Support »
// avec son compteur. Le compteur de messages non lus de l'assistance, qui
// vivait sur le ☰, est désormais porté par la ligne « Aide et assistance ».
// Abonnement, apparence (thème) et déconnexion y étaient déjà.

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const nom = `${police} [font-weight:var(--v2-type-nom-poids)] [font-stretch:var(--v2-type-nom-largeur)]`

// Initiales d'avatar : même algorithme que ClientsViewV2.tsx (`initiales`),
// dupliqué ici à l'identique — fonction pure de deux lignes, non exportée par
// ce fichier, pas de raison d'en faire un module partagé pour si peu.
function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ stroke: 'var(--v2-color-gris)', opacity: 0.55 }}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </svg>
  )
}

// Messages non lus du canal d'assistance : point plein + le mot, jamais une
// pastille colorée (tableau des tics d'IA, refonte.md). Même seuil de
// troncature que UnreadCountBadge (« 9+ ») — un « 47 » n'apprend rien de plus
// qu'un « beaucoup » à quelqu'un qui n'a pas ouvert ses messages. `null`/`0` :
// rien ne s'affiche, jamais un « 0 non lu ».
function NonLus({ count }: { count: number | null | undefined }) {
  if (!count || count <= 0) return null
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${corpsFort} shrink-0`} style={{ color: 'var(--v2-color-accent)' }}>
      <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--v2-color-accent)' }} />
      {count > 9 ? '9+' : count} non lu{count > 1 ? 's' : ''}
    </span>
  )
}

type LigneProps = {
  label: string
  valeur?: string | null
  sousLabel?: string
  /** Signal à droite du libellé (ex. `NonLus`), avant le chevron. */
  signal?: React.ReactNode
  href?: string
  onClick?: () => void
  chevron?: boolean
}

// Une ligne du menu. `href` → lien (navigation), `onClick` sans `href` →
// bouton (action sur place, ex. le thème). `chevron` par défaut vrai, mis à
// faux quand la ligne n'ouvre rien ailleurs (Déconnexion, Apparence — cette
// dernière bascule sur place plutôt que de naviguer vers un écran qui
// n'existe pas encore, déviation assumée par rapport à la maquette qui
// pointe vers l'artboard de référence `Sombre.dc.html`).
function Ligne({ label, valeur, sousLabel, signal, href, onClick, chevron = true }: LigneProps) {
  const contenu = (
    <>
      <span className={`flex-1 text-[15px] ${corps}`}>{label}</span>
      {sousLabel && <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] shrink-0`}>{sousLabel}</span>}
      {valeur && <span className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)] shrink-0`}>{valeur}</span>}
      {signal}
      {chevron && <Chevron />}
    </>
  )
  const classe = 'flex items-center gap-2.5 min-h-[46px] py-1.5 w-full text-left'
  if (href) {
    return <Link href={href} className={classe}>{contenu}</Link>
  }
  return (
    <button type="button" onClick={onClick} className={classe}>
      {contenu}
    </button>
  )
}

// Une carte-liste : fond surface, filet, rayon de surface, lignes séparées
// par un filet fin — planche Système, mêmes jetons que ChiffresArgent.tsx.
function CarteListe({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
      <div className="px-4 divide-y divide-[color:var(--v2-filet)]">
        {children}
      </div>
    </div>
  )
}

function TitreSection({ children }: { children: React.ReactNode }) {
  return (
    <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>
      {children}
    </p>
  )
}

// Résumé de la zone d'intervention à partir de `zone_config` — simple lecture
// du champ déjà stocké (rayon en km, ou nombre de départements), aucune règle
// métier nouvelle. Pas d'équivalent pour un rayon "en communes" comme le
// montre la maquette ("12 communes") : la donnée n'existe pas sous cette
// forme, jamais approximée.
function resumeZone(washer: Washer): string | null {
  const z = washer.zone_config
  if (!z || z.enabled === false) return null
  if (z.type === 'departments') return `${z.departments.length} département${z.departments.length > 1 ? 's' : ''}`
  return `${z.radius_km} km`
}

type Props = {
  washer: Washer
  /** Nombre de prestations, déjà compté côté serveur pour la barre
   *  d'avancement de `/dashboard/parametres` (voir page.tsx) — réutilisé tel
   *  quel, aucune requête ajoutée. `undefined` si le comptage a échoué : la
   *  ligne affiche alors son libellé sans le nombre plutôt qu'un zéro inventé. */
  servicesCount?: number
}

export default function ParametresFormV2({ washer, servicesCount }: Props) {
  const { theme, setTheme } = useTheme()
  // Signaux du canal d'assistance, interrogés une fois par DashboardShell (voir
  // SupportBadgesContext) — ce sont eux que portait le menu latéral et le
  // bouton ☰, disparus de la PWA en bêta.
  const { estEquipeSupport, unreadSupportCount, unreadTeamCount } = useSupportBadges()
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const domaine = origin.replace(/^https?:\/\//, '')
  const lienReservation = `${domaine}/book/${washer.slug}`

  const canTeam = hasFeature(washer, 'multi_laveurs')
  // Ce qui part VRAIMENT : un avis « activé » sans lien Google, ou une relance
  // sans message, ne part pas (le cron les traite sans rien envoyer) — compter
  // « 2 actifs » ici alors que l'écran Messages automatiques en montre 1 serait
  // se contredire.
  const automatismesActifs = nombreActifs(
    {
      review_enabled: !!washer.review_enabled,
      review_delay_hours: washer.review_delay_hours,
      google_review_url: washer.google_review_url,
      review_channel: washer.review_channel === 'sms' ? 'sms' : 'email',
      followup_enabled: !!washer.followup_enabled,
      followup_delay_days: washer.followup_delay_days,
      followup_message: washer.followup_message,
    },
    { smsAutorise: hasFeature(washer, 'avis_sms') },
  )
  const zone = resumeZone(washer)
  const planLabel = washer.grandfathered ? 'Accès complet' : PLAN_LABELS[washer.plan]

  return (
    <div className={`max-w-3xl mx-auto space-y-6 ${police}`}>
      {/* Carte du haut : page de réservation, mêmes données que l'ancien
          onglet « Page client » (ClientTab de ParametresFormV1), présentées
          en résumé. L'édition du lien et les liens par réseau restent dans
          ParametresFormV1 (id="lien-reservation") — pas dupliqués ici. */}
      <CarteListe>
        <div className="flex items-center gap-3 py-3.5">
          <span
            className={`w-[42px] h-[42px] shrink-0 rounded-[12px] bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] flex items-center justify-center text-[16px] ${corpsFort} tracking-tight`}
            aria-hidden
          >
            {initiales(washer.name)}
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-px">
            <span className={`text-[16px] ${nom} truncate`}>{washer.name}</span>
            <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Votre page de réservation</span>
          </span>
          <a
            href={`/book/${washer.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-[13px] ${corpsFort} shrink-0`}
            style={{ color: 'var(--v2-color-accent)' }}
          >
            Voir
          </a>
        </div>

        <div className="flex items-center gap-2.5 py-3">
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className={`text-[13px] ${corpsFort}`}>Mon lien</span>
            <span
              className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)] truncate`}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {lienReservation}
            </span>
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${origin}/book/${washer.slug}`)}
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[var(--v2-radius-pilule)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] text-[13px] ${corpsFort} shrink-0`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: 'var(--v2-color-encre)' }} aria-hidden>
              <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.4 1.4" />
              <path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.4-1.4" />
            </svg>
            Copier
          </button>
        </div>

        <Ligne
          label="Un lien par réseau"
          sousLabel="Instagram, TikTok, Facebook, Google"
          href="/dashboard/parametres/tout#lien-reservation"
        />
      </CarteListe>

      {/* De temps en temps */}
      <div>
        <TitreSection>De temps en temps</TitreSection>
        <CarteListe>
          <Ligne
            label="Messages automatiques"
            valeur={`${automatismesActifs} actif${automatismesActifs > 1 ? 's' : ''}`}
            href="/dashboard/parametres/messages"
          />
          {/* « Modèles de messages » de la maquette (7) n'a pas d'équivalent
              dans le code : un seul message d'avis (codé en dur, voir
              refonte.md) et un seul message de relance personnalisable,
              aucune notion de modèles multiples. Pas construite plutôt
              qu'approximée — voir TODO.md. */}
          <Ligne
            label="Équipe"
            valeur={canTeam ? `${washer.team_size} laveur${washer.team_size > 1 ? 's' : ''}` : 'Pro'}
            href="/dashboard/parametres/tout#profil"
          />
          {/* Ancien écran « CRM » (`/dashboard/crm`), sans le mot : il porte
              ce que Chiffres n'a pas repris — l'export Excel des réservations
              (CrmDashboard) et les liens par réseau, avec le sélecteur de
              période complet des statistiques de visite. Ligne ajoutée le
              2026-09-24, quand le menu latéral (seule entrée vers cette page)
              a disparu de la PWA en bêta. */}
          <Ligne label="Export et liens par réseau" href="/dashboard/crm" />
        </CarteListe>
      </div>

      {/* Une fois */}
      <div>
        <TitreSection>Une fois</TitreSection>
        <CarteListe>
          <Ligne
            label="Prestations et prix"
            valeur={typeof servicesCount === 'number' ? String(servicesCount) : undefined}
            href="/dashboard/admin#prestations"
          />
          <Ligne label="Horaires" href="/dashboard/admin#disponibilites" />
          <Ligne label="Zone et déplacement" valeur={zone ?? undefined} href="/dashboard/admin#zone" />
          <Link href="/dashboard/admin#identite" className="flex items-center gap-2.5 min-h-[46px] py-1.5 w-full">
            <span className={`flex-1 text-[15px] ${corps}`}>Apparence de ma page</span>
            {washer.brand_color && (
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-[color:var(--v2-filet-fort)]"
                style={{ backgroundColor: washer.brand_color }}
                aria-hidden
              />
            )}
            <Chevron />
          </Link>
          {/* « Importer mes clients » de la maquette n'a aucune logique
              derrière : la table `clients` et son import (étape 1 du plan
              CRM, refonte.md) ne sont pas construits. Pas de ligne plutôt
              qu'un lien mort — voir TODO.md. */}
        </CarteListe>
      </div>

      {/* Mon compte */}
      <div>
        <TitreSection>Mon compte</TitreSection>
        <CarteListe>
          <Ligne label="Abonnement" valeur={planLabel} href="/dashboard/abonnement" />
          <Ligne
            label="Apparence"
            valeur={theme === 'dark' ? 'Sombre' : 'Clair'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            chevron={false}
          />
          {/* Le guide n'avait plus d'entrée : il n'était atteignable que par le
              menu latéral (et par un lien discret dans l'assistance). */}
          <Ligne label="Guide d’utilisation" href="/dashboard/guide" />
          <Ligne
            label="Aide et assistance"
            href="/dashboard/assistance"
            signal={<NonLus count={unreadSupportCount} />}
          />
          <form action="/api/auth/logout" method="POST" className="flex items-center min-h-[46px] py-1.5">
            <button type="submit" className={`text-[15px] ${corps} text-left`} style={{ color: 'var(--v2-color-rouge)' }}>
              Déconnexion
            </button>
          </form>
        </CarteListe>
      </div>

      {/* Réservé à l'équipe, jamais deviné côté client (voir
          useEstEquipeSupport : la valeur vient du serveur). Séparé de « Mon
          compte » comme l'était « Outil interne » dans le menu latéral — on
          doit comprendre d'un coup d'œil que ce n'est pas une fonction du
          produit. Le compteur est celui des laveurs qui attendent une réponse,
          distinct de celui d'« Aide et assistance » au-dessus. */}
      {estEquipeSupport && (
        <div>
          <TitreSection>Outil interne</TitreSection>
          <CarteListe>
            <Ligne
              label="Support (équipe)"
              href="/dashboard/support"
              signal={<NonLus count={unreadTeamCount} />}
            />
          </CarteListe>
        </div>
      )}

      {/* Filet de secours (voir le commentaire en tête de fichier) : email,
          mot de passe, notifications, accès support, zone de danger. */}
      <Link
        href="/dashboard/parametres/tout"
        className={`flex items-center justify-center px-1 h-11 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}
      >
        Tous les réglages
      </Link>

      <DiagnosticPwa />
    </div>
  )
}
