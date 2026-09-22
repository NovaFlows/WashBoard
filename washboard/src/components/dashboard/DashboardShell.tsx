'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PLAN_LABELS, type Plan } from '@/lib/plan'
import { isCardRegistered, formatDateFR } from '@/lib/subscription'
import { useSupportUnreadBadge } from '@/lib/useSupportUnreadBadge'
import { useSupportUnreadTeamBadge } from '@/lib/useSupportUnreadTeamBadge'
import { useEstEquipeSupport } from '@/lib/useEstEquipeSupport'
import { UnreadCountBadge, unreadLabel } from '@/components/ui/UnreadCountBadge'

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
}

function PlanBadge({ plan, grandfathered }: { plan?: Plan; grandfathered?: boolean }) {
  const label = grandfathered ? 'Accès complet' : PLAN_LABELS[plan ?? 'essentiel']
  const color = grandfathered
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
    : plan === 'pro' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
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
      <span className="hidden sm:inline">{label}</span>
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

function AppBetaBanner() {
  // On part de « masqué » : ce qui décide de l'affichage n'existe que dans le
  // navigateur, et un rendu serveur différent provoquerait un clignotement.
  const [visible, setVisible] = useState(false)

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

  if (!visible) return null

  function fermer() {
    setVisible(false)
    try { localStorage.setItem(CLE_FERME, '1') } catch { /* rien à faire */ }
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

function TrialBanner({ trialEndsAt, subscriptionStatus, stripeSubscriptionId, cancelsAt }: { trialEndsAt?: string | null; subscriptionStatus?: string | null; stripeSubscriptionId?: string | null; cancelsAt?: string | null }) {
  const [dismissed, setDismissed] = useState(false)
  const [now] = useState(() => Date.now())

  if (dismissed) return null

  // Résiliation programmée : abonnement encore actif jusqu'à la date de fin
  if (cancelsAt && (subscriptionStatus === 'active' || subscriptionStatus === 'trial')) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-b border-red-200 dark:border-red-800 text-sm font-semibold py-2.5 px-3 flex items-center gap-2">
        <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center min-w-0">
          <span>Abonnement résilié — valable jusqu&apos;au {formatDateFR(cancelsAt)}</span>
          <Link href="/dashboard/abonnement" className="underline font-bold whitespace-nowrap hover:opacity-70">
            Réactiver →
          </Link>
        </div>
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    )
  }

  if (!subscriptionStatus || subscriptionStatus === 'active') return null

  if (subscriptionStatus === 'expired') {
    return (
      <div className="bg-red-600 text-white text-sm font-semibold py-2.5 px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <span>Votre période d&apos;essai a expiré. Activez votre abonnement pour continuer à utiliser WashBoard.</span>
        <Link href="/dashboard/abonnement" className="underline font-bold hover:text-red-100 whitespace-nowrap">
          Voir les offres →
        </Link>
      </div>
    )
  }

  if (subscriptionStatus === 'trial' && trialEndsAt) {
    const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - now) / (1000 * 60 * 60 * 24))
    const isUrgent = daysLeft <= 7

    // Carte enregistrée, facturation différée
    if (isCardRegistered(stripeSubscriptionId, subscriptionStatus)) {
      return (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-b border-emerald-200 dark:border-emerald-800 text-sm font-semibold py-2.5 px-3 flex items-center gap-2">
          <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center min-w-0">
            <span>
              ✓ Carte enregistrée — facturation dans {daysLeft} jour{daysLeft > 1 ? 's' : ''}
            </span>
            <Link href="/dashboard/abonnement" className="underline font-bold whitespace-nowrap hover:opacity-70">
              Gérer →
            </Link>
          </div>
          <DismissButton onDismiss={() => setDismissed(true)} />
        </div>
      )
    }

    if (daysLeft <= 0) {
      return (
        <div className="bg-red-600 text-white text-sm font-semibold py-2.5 px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span>Votre période d&apos;essai a expiré.</span>
          <Link href="/dashboard/abonnement" className="underline font-bold hover:text-red-100 whitespace-nowrap">
            Activer mon abonnement →
          </Link>
        </div>
      )
    }

    return (
      <div className={`text-sm font-semibold py-2.5 px-3 flex items-center gap-2 ${
        isUrgent
          ? 'bg-orange-500 text-white'
          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800'
      }`}>
        <div className="flex-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-center min-w-0">
          <span>
            Essai gratuit — {daysLeft} jour{daysLeft > 1 ? 's' : ''} restant{daysLeft > 1 ? 's' : ''}
          </span>
          <Link
            href="/dashboard/abonnement"
            className={`underline font-bold whitespace-nowrap ${isUrgent ? 'hover:text-orange-100' : 'hover:opacity-70'}`}
          >
            Voir l&apos;abonnement →
          </Link>
        </div>
        <DismissButton onDismiss={() => setDismissed(true)} />
      </div>
    )
  }

  return null
}

export function DashboardShell({ washerName, children, trialEndsAt, subscriptionStatus, plan, grandfathered, stripeSubscriptionId, cancelsAt }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Décoratif (voir useSupportUnreadBadge) : porté ici pour n'interroger
  // /api/support/non-lues qu'une fois par page, puis partagé entre le menu
  // (Sidebar) et le bouton ☰ juste en dessous, qui doivent montrer le même
  // nombre — sinon un laveur qui n'ouvre jamais le menu sur mobile ne verrait
  // jamais le compteur.
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 overflow-x-hidden wb-dashboard-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unreadSupportCount={unreadSupportCount}
        estEquipeSupport={estEquipeSupport}
        unreadTeamCount={unreadTeamCount}
      />

      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <TrialBanner trialEndsAt={trialEndsAt} subscriptionStatus={subscriptionStatus} stripeSubscriptionId={stripeSubscriptionId} cancelsAt={cancelsAt} />
        <AppBetaBanner />
        <div className="w-full px-3 sm:px-6 py-3 flex items-center justify-between gap-2">
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
            {washerName && <PlanBadge plan={plan} grandfathered={grandfathered} />}
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
        </div>
      </header>

      <main id="main-content" className="max-w-3xl mx-auto px-3 sm:px-4 pt-6 pb-24 sm:pb-6 overflow-x-hidden">
        {children}
      </main>

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
