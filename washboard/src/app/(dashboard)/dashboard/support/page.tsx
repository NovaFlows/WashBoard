import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSupportMember } from '@/lib/supportAccess'
import { logger } from '@/lib/logger'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import SupportAccessForm from '@/components/dashboard/SupportAccessForm'
import SupportInbox from '@/components/dashboard/SupportInbox'

export const dynamic = 'force-dynamic'

// Page réservée à l'équipe support : ouvrir une session sur le compte d'un
// laveur qui a demandé de l'aide.
//
// Elle n'apparaît dans aucun menu et renvoie vers l'accueil pour quiconque
// n'est pas dans SUPPORT_ADMIN_EMAILS — un laveur qui devinerait l'adresse ne
// doit pas même savoir qu'elle existe.
//
// Coque du tableau de bord (DashboardShell, avec son menu) : affichée, mais
// SANS supposer de fiche laveur. DashboardShell attend `washerName`,
// `trialEndsAt`, `plan`… des informations qui n'existent que pour un compte
// laveur. Aujourd'hui l'adresse support est aussi celle d'un compte laveur,
// la fiche existe donc par coïncidence — mais le jour où un compte support
// dédié sera créé, elle n'existera plus. On lit donc la fiche directement,
// PAS via `washerDuUtilisateur` (celle-ci déconnecte un compte sans fiche :
// exactement le piège à éviter ici), et on la passe à DashboardShell si elle
// existe. Si elle n'existe pas, DashboardShell bascule dans un mode dégradé
// (pas de nom de laveur, pas de badge d'abonnement) plutôt que de planter ou
// rediriger — voir le commentaire dans DashboardShell.tsx.
export default async function SupportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const liste = process.env.SUPPORT_ADMIN_EMAILS
  if (!isSupportMember(user.email, liste)) {
    // La redirection reste muette pour le visiteur — inutile de lui révéler
    // que cette page existe. Mais sans trace côté serveur, le refus est
    // indiagnosticable : on ne sait pas distinguer « variable absente du
    // déploiement » de « mauvaise adresse », alors que le remede diffère du
    // tout au tout.
    logger.warn('support.page.denied', {
      email: user.email ?? null,
      listeConfiguree: !!liste,
    })
    redirect('/dashboard')
  }

  // La liste des conversations est chargée par SupportInbox lui-même, via
  // /api/support/team-questions : cette route répond 503 (et trace l'échec)
  // plutôt qu'une liste vide en cas de souci de lecture — un comportement
  // qu'un rendu serveur qui se contenterait de passer `[]` en cas d'erreur ne
  // pourrait pas distinguer d'un « aucune question ».

  // Fiche laveur du compte connecté, si elle existe — lecture directe (pas
  // `washerDuUtilisateur`, voir le commentaire en tête de fichier). Un échec
  // de lecture n'est pas plus grave ici qu'une fiche absente : dans les deux
  // cas, DashboardShell passe simplement en mode dégradé.
  const { data: washer, error: washerError } = await supabase
    .from('washers')
    // `*` et non une liste de colonnes : `beta_refonte` doit rester lisible ici
    // pour que la PWA en bêta garde sa barre du bas sur cette page (sans elle,
    // le châssis retomberait sur l'en-tête et le menu, retirés du bêta), et une
    // liste nommée casserait tant que la colonne n'existe pas en base — même
    // règle que guide/assistance (refonte 2026, passe 4).
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (washerError) {
    logger.warn('support.page.washer_read_failed', { userId: user.id }, washerError)
  }

  return (
    <DashboardShell
      washerName={washer?.name}
      trialEndsAt={washer?.trial_ends_at ?? null}
      subscriptionStatus={washer?.subscription_status ?? null}
      plan={washer?.plan}
      grandfathered={washer?.grandfathered ?? false}
      stripeSubscriptionId={washer?.stripe_subscription_id ?? null}
      cancelsAt={washer?.cancels_at ?? null}
      betaRefonte={washer?.beta_refonte}
    >
      <h1 className="text-2xl font-black text-slate-900 dark:text-white">Support</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
        Accéder au compte d&apos;un laveur qui a ouvert l&apos;accès depuis ses réglages.
        Connecté en tant que {user.email}.
      </p>

      <SupportAccessForm />

      <h2 className="text-lg font-black text-slate-900 dark:text-white mt-10 mb-1">Questions des laveurs</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Les non lues en premier.
      </p>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
        <SupportInbox />
      </div>
    </DashboardShell>
  )
}
