import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { washerDuUtilisateur } from '@/lib/washerCourant'
import { formationAdmin, formationOuverte } from '@/lib/formationAcces'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// Garde et cadre communs aux pages « Formation » (branche feat/formation, 2026-11-10) : connexion
// exigée, puis `notFound()` pour tout compte qui n'a pas accès à l'onglet — la page n'existe pas
// pour lui, au lieu d'afficher un « accès refusé » qui révélerait qu'elle existe.

export async function contexteFormation(ecran: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!formationOuverte(user.id)) notFound()

  const washer = await washerDuUtilisateur(supabase, user.id, ecran)
  const liste: ReglagesListeProps = {
    nom: washer.name,
    slug: washer.slug,
    brandColor: washer.brand_color,
    plan: washer.plan,
    grandfathered: washer.grandfathered,
  }
  return { washer, liste, admin: formationAdmin(user.id) }
}

type Washer = Awaited<ReturnType<typeof contexteFormation>>['washer']

export function CadreFormation({ washer, children }: { washer: Washer; children: React.ReactNode }) {
  return (
    <DashboardShell
      washerName={washer.name}
      trialEndsAt={washer.trial_ends_at}
      subscriptionStatus={washer.subscription_status}
      plan={washer.plan}
      grandfathered={washer.grandfathered}
      subscriptionEndsAt={washer.subscription_ends_at ?? null}
      createdAt={washer.created_at}
      slug={washer.slug}
      stripeSubscriptionId={washer.stripe_subscription_id ?? null}
      cancelsAt={washer.cancels_at ?? null}
    >
      {/* Ordinateur seulement pour l'instant (Alexandre, 2026-11-12) : sur téléphone, un message à la place. En CSS pur, sans clignotement au chargement. */}
      <div className="hidden md:block">{children}</div>
      <div className="md:hidden px-1 py-10 text-center" data-testid="formation-ordinateur-seulement">
        <p className="text-[17px] font-semibold">La formation est disponible sur ordinateur</p>
        <p className="mt-2 text-[14px] text-zinc-500">Ouvrez WashBoard depuis votre ordinateur pour suivre les vidéos.</p>
      </div>
    </DashboardShell>
  )
}
