import { createClient } from '@/lib/supabase/server'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import ParametresFormV1 from '@/components/dashboard/ParametresFormV1'

// « Tous les réglages » — refonte 2026, passe 6. Rend l'ancien formulaire de
// réglages (ParametresFormV1, deux onglets) tel quel, à une nouvelle adresse,
// sans passer par le branchement v1/v2 de `/dashboard/parametres` : cette
// page affiche TOUJOURS le même contenu, sur le site comme dans la PWA.
//
// Elle sert de filet de secours pour le nouveau menu « Plus » (v2,
// ParametresFormV2.tsx) : plusieurs réglages du formulaire complet (email,
// mot de passe, notifications, accès support, zone de danger, facturation)
// n'ont pas encore de ligne dédiée dans ce menu — voir son commentaire d'en-
// tête. Sans cette route, ils deviendraient inatteignables depuis la PWA
// (même bug que les « six pages orphelines » qui a coûté la première version
// du CRM, voir `.claude/agents/refonte.md`). Les liens « Messages
// automatiques » (#avis) et « Équipe » (#profil) du menu « Plus » pointent
// aussi ici, ainsi que « Un lien par réseau » (#lien-reservation).
//
// Aucune logique nouvelle : mêmes lectures, même composant que
// `/dashboard/parametres` en v1.
export default async function TousLesReglagesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const washer = await washerDuUtilisateur(supabase, user.id, 'parametres-tout')

  return (
    <DashboardShell washerName={washer.name} trialEndsAt={washer.trial_ends_at} subscriptionStatus={washer.subscription_status} plan={washer.plan} grandfathered={washer.grandfathered} stripeSubscriptionId={washer.stripe_subscription_id ?? null} cancelsAt={washer.cancels_at ?? null} betaRefonte={washer.beta_refonte}>
      <div className="mb-6">
        <Link
          href="/dashboard/parametres"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-3 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Plus
        </Link>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tous les réglages</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gérez vos informations et votre page client</p>
      </div>
      <ParametresFormV1 washer={washer} email={user.email ?? ''} />
    </DashboardShell>
  )
}
