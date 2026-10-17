import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasFeature } from '@/lib/plan'
import { urlVersionnee } from '@/lib/themes'
import { fideliteActive, jetonValide, phraseCarte } from '@/lib/fidelite'
import { etatDuClient } from '@/lib/fideliteServeur'
import RetenirCarte from '@/components/booking/RetenirCarte'

// Page de la carte de fidélité d'un client (lien reçu dans ses emails de réservation) :
// ses tampons chez CE laveur, la récompense qui l'attend, et un bouton pour réserver.
// Publique, sans compte : le jeton imprévisible de l'adresse tient lieu d'accès. Aucune
// donnée personnelle n'y figure (ni nom, ni email, ni téléphone du client).

export const metadata: Metadata = {
  title: 'Ma carte de fidélité',
  robots: { index: false, follow: false },
}

export default async function CarteFidelite({ params }: { params: Promise<{ jeton: string }> }) {
  const { jeton } = await params
  if (!jetonValide(jeton)) notFound()
  const admin = createAdminClient()

  const { data: carte } = await admin.from('fidelite_cartes').select('washer_id, cle, ajustement').eq('jeton', jeton).maybeSingle()
  if (!carte) notFound()

  const { data: laveur } = await admin
    .from('washers')
    .select('id, name, slug, logo_url, profile_updated_at, fidelite, plan, grandfathered, created_at, subscription_status, trial_ends_at, subscription_ends_at, account_status')
    .eq('id', carte.washer_id)
    .maybeSingle()
  if (!laveur || laveur.account_status !== 'active') notFound()

  const reglages = fideliteActive(laveur.fidelite)
  const etat = reglages ? await etatDuClient(admin, laveur.id, carte.cle as string, reglages.tampons, Number(carte.ajustement ?? 0)) : null
  const logo = hasFeature(laveur, 'page_personnalisee') && laveur.logo_url ? urlVersionnee(laveur.logo_url, laveur.profile_updated_at) : null

  return (
    <main className="min-h-screen bg-[#f6f5f3] px-4 py-10 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <RetenirCarte washerId={laveur.id} jeton={jeton} />
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          {logo
            // eslint-disable-next-line @next/next/no-img-element -- logo du laveur (Supabase)
            ? <img src={logo} alt="" className="h-12 w-12 rounded-xl object-cover" />
            : <div aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-200 text-xl font-bold text-zinc-500 dark:bg-zinc-800">{laveur.name.charAt(0).toUpperCase()}</div>}
          <div>
            <p className="text-lg font-bold leading-tight">{laveur.name}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Ma carte de fidélité</p>
          </div>
        </div>

        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          {reglages && etat ? (
            <>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {etat.disponibles > 0 ? 'Carte complète' : `${etat.progression} sur ${etat.requis}`}
              </p>
              <ol className="mt-3 grid grid-cols-5 gap-2.5" aria-label={`${etat.disponibles > 0 ? etat.requis : etat.progression} tampons sur ${etat.requis}`}>
                {Array.from({ length: etat.requis }, (_, i) => {
                  const plein = etat.disponibles > 0 || i < etat.progression
                  return (
                    <li key={i} aria-hidden
                      className={`flex aspect-square items-center justify-center rounded-full border-2 text-lg font-bold ${plein
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-dashed border-zinc-300 text-zinc-300 dark:border-zinc-700 dark:text-zinc-700'}`}>
                      {plein ? '✓' : i + 1}
                    </li>
                  )
                })}
              </ol>
              <p className="mt-4 text-[15px] leading-snug">{phraseCarte(etat, reglages)}</p>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Un tampon par prestation terminée. Réservez avec la même adresse email pour qu’il compte.</p>
            </>
          ) : (
            <p className="text-[15px]">{laveur.name} ne propose plus de carte de fidélité pour le moment.</p>
          )}
        </section>

        <Link href={`/book/${laveur.slug}`} className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-zinc-900 px-4 text-[15px] font-semibold text-white dark:bg-white dark:text-zinc-900">
          Réserver un lavage
        </Link>
      </div>
    </main>
  )
}
