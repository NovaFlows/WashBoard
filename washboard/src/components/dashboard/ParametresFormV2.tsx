'use client'

import { DiagnosticPwa } from '@/components/dashboard/DiagnosticPwa'
import Link from 'next/link'
import type { Washer } from '@/types'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2 from '@/components/dashboard/ListeReglagesV2'
import ApercuPageV2 from '@/components/dashboard/ApercuPageV2'
import { PLAN_LABELS } from '@/lib/plan'
import { infosFacturationManquantes } from '@/lib/facture'

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
// Messages automatiques ont le leur depuis le 2026-09-24, dans Clients depuis le 2026-09-30 :
// `/dashboard/clients/messages`). Aucune requête ni aucun calcul n'est dupliqué ici :
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

export function Chevron() {
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
export function NonLus({ count }: { count: number | null | undefined }) {
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
  /** Passe bureau (2026-10-06) : la destination que cette ligne ouvre est celle affichée à
   *  droite en ce moment (voir `ListeReglagesV2.tsx`) — fond `--v2-filet`, comme
   *  `.compte-row.selected` dans la maquette. Toujours `false` ailleurs (défaut), où `Ligne`
   *  n'a jamais porté de notion de sélection avant cette passe.
   *
   *  Essayé puis abandonné : un débordement par marge négative (`-mx-4 px-4`) jusqu'aux bords
   *  de la carte — repéré en capturant cette passe, il changeait la largeur réellement
   *  disponible pour `sousLabel` (le navigateur recalcule `margin-right` quand les deux marges
   *  négatives sur-contraignent l'équation de boîte, voir CSS 2.1 §10.3.3), et tronquait « Mon
   *  profil » en un seul caractère sur l'écran Profil alors que la même ligne, non
   *  sélectionnée, affichait « Entr… » sur l'écran de repos. La teinte reste donc INSET des
   *  16px de padding de `CarteListe`, pas de bord à bord — compromis visuel mineur, largeur
   *  garantie identique à l'état non sélectionné. */
  selected?: boolean
}

// Une ligne du menu. `href` → lien (navigation), `onClick` sans `href` →
// bouton (action sur place, ex. le thème). `chevron` par défaut vrai, mis à
// faux quand la ligne n'ouvre rien ailleurs (Déconnexion, Apparence — cette
// dernière bascule sur place plutôt que de naviguer vers un écran qui
// n'existe pas encore, déviation assumée par rapport à la maquette qui
// pointe vers l'artboard de référence `Sombre.dc.html`).
export function Ligne({ label, valeur, sousLabel, signal, href, onClick, chevron = true, selected = false }: LigneProps) {
  const contenu = (
    <>
      {/* La valeur peut être longue (le résumé des horaires) : c'est elle qui rétrécit et se
          termine par « … », jamais l'intitulé, et le chevron reste visible. Sans ça, la ligne
          débordait de la carte et le texte se coupait au milieu d'un chiffre (2026-09-27). */}
      <span className={`shrink-0 text-[15px] ${corps}`}>{label}</span>
      {sousLabel && <span className={`min-w-0 flex-1 truncate text-right text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousLabel}</span>}
      {valeur && <span className={`min-w-0 ${sousLabel ? 'shrink-0' : 'flex-1'} truncate text-right text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{valeur}</span>}
      {!sousLabel && !valeur && <span className="flex-1" />}
      {signal}
      {chevron && <Chevron />}
    </>
  )
  const classe = `flex items-center gap-2.5 min-h-[46px] py-1.5 w-full text-left ${selected ? 'bg-[color:var(--v2-filet)]' : ''}`
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
export function CarteListe({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)] overflow-hidden">
      <div className="px-4 divide-y divide-[color:var(--v2-filet)]">
        {children}
      </div>
    </div>
  )
}

export function TitreSection({ children }: { children: React.ReactNode }) {
  return (
    <p className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)] px-0.5 pb-2`}>
      {children}
    </p>
  )
}

// Fil d'Ariane du panneau de droite, grand écran UNIQUEMENT (planche Système, écrans 63/64 de
// la maquette bureau) : Guide et Assistance n'ont pas leur propre ligne dans `ListeReglagesV2`
// (elles s'ouvrent depuis la liste « De l'aide » de `ReglagesV2`, un niveau plus bas) — la
// ligne surlignée à gauche reste donc « Réglages », et c'est CE petit lien qui dit où l'on est
// vraiment. Absent sur téléphone : le chevron de retour de l'en-tête mobile joue déjà ce rôle.
export function FilAriane({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className={`mb-1.5 inline-flex items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)] hover:text-[color:var(--v2-color-encre)]`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
      </svg>
      {label}
    </Link>
  )
}

type Props = {
  washer: Washer
  /** Nombre de prestations, déjà compté côté serveur pour la barre
   *  d'avancement de `/dashboard/parametres` (voir page.tsx) — réutilisé tel
   *  quel, aucune requête ajoutée. `undefined` si le comptage a échoué : la
   *  ligne affiche alors son libellé sans le nombre plutôt qu'un zéro inventé. */
  servicesCount?: number
  /** Phrase de résumé des horaires (`resumeHoraires`, lib/horaires.ts), calculée par
   *  la page à partir d'une lecture de `availabilities`. `undefined` si la lecture
   *  a échoué : la ligne s'affiche alors sans valeur, jamais avec un « Aucun
   *  horaire » inventé. */
  resumeHoraires?: string
}

// Passe bureau (2026-10-06) : la liste elle-même a été extraite dans `ListeReglagesV2.tsx`
// (voir son en-tête) pour pouvoir être réutilisée à côté de chacune des 5 destinations
// qu'elle ouvre. Ce composant reste le point d'entrée de l'écran `/dashboard/parametres`
// lui-même : sur téléphone (PWA), il rend la liste SEULE, inchangé pixel pour pixel ; sur
// grand écran (`useGrandEcran`, ≥1024px — site en bêta ou PWA sur ordinateur), il l'affiche
// à gauche, en permanence, et montre à droite la page de réservation telle qu'elle est
// aujourd'hui (écran 60 de la maquette, état de repos — aucune ligne n'est sélectionnée ici,
// contrairement aux 5 écrans qui ouvrent VRAIMENT un réglage).
export default function ParametresFormV2({ washer, servicesCount, resumeHoraires }: Props) {
  const grandEcran = useGrandEcran()
  const facturationIncomplete = infosFacturationManquantes(washer).length > 0

  const liste = (
    <ListeReglagesV2
      nom={washer.name}
      slug={washer.slug}
      brandColor={washer.brand_color}
      plan={washer.plan}
      grandfathered={washer.grandfathered}
      servicesCount={servicesCount}
      resumeHoraires={resumeHoraires}
      facturationIncomplete={facturationIncomplete}
      selection={null}
    />
  )

  if (!grandEcran) {
    return (
      <div className={`max-w-3xl mx-auto space-y-6 ${police}`}>
        {liste}
        <DiagnosticPwa />
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${police}`}>
      <div className="flex items-start gap-5">
        {/* `sticky` plutôt qu'un second panneau à hauteur fixe (voir ClientsViewV2.tsx) :
            cette liste est courte et de hauteur à peu près constante — ce qu'il lui faut,
            c'est rester visible pendant qu'on fait défiler un réglage plus long à droite
            (Prestations, en particulier), pas un deuxième défilement indépendant. */}
        <div className="sticky top-0 w-[260px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
          {liste}
        </div>
        <div className="min-w-0 flex-1 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-7 py-6">
          <TitreSection>Votre page de réservation</TitreSection>
          <div className="mx-auto max-w-[380px]">
            <ApercuPageV2
              nom={washer.name}
              logoUrl={washer.logo_url ?? null}
              message={washer.welcome_message ?? null}
              couleur={washer.brand_color ?? null}
              fond={washer.background_theme ?? null}
            />
          </div>
          <p className={`mx-auto mt-4 max-w-[380px] text-center text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            C’est ce que voient vos clients quand ils réservent. Le logo, les couleurs et le
            message se règlent dans « Apparence de ma page ».
          </p>
          <div className="mx-auto mt-5 max-w-[380px]">
            <CarteListe>
              <div className="flex items-center justify-between gap-3 py-3">
                <span className={`text-[13px] ${corps}`}>Lien</span>
                <span className={`truncate text-[12px] ${corpsFort} tabular-nums`}>/book/{washer.slug}</span>
              </div>
              <div className="flex items-center justify-between gap-3 py-3">
                <span className={`text-[13px] ${corps}`}>Offre actuelle</span>
                <span className={`text-[13px] ${corpsFort}`}>
                  {washer.grandfathered ? 'Accès complet' : PLAN_LABELS[washer.plan]}
                </span>
              </div>
            </CarteListe>
          </div>
        </div>
      </div>

      <DiagnosticPwa />
    </div>
  )
}
