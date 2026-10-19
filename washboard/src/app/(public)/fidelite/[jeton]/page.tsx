import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { fideliteActive, jetonValide, phraseCarte } from '@/lib/fidelite'
import { apparenceCarte, etatDuClient } from '@/lib/fideliteServeur'
import CarteFidelite3D from '@/components/fidelite/CarteFidelite3D'

// Page de la carte de fidélité d'un client (lien reçu dans ses emails de réservation) :
// ses tampons chez CE laveur, la récompense qui l'attend, et un bouton pour réserver.
// Publique, sans compte : le jeton imprévisible de l'adresse tient lieu d'accès. Aucune
// donnée personnelle n'y figure (ni nom, ni email, ni téléphone du client).
//
// `?tampon=N` : le client arrive de l'email « Votre tampon est arrivé » (envoyé quand le
// laveur marque la prestation terminée, `api/bookings/[id]`) — les N derniers tampons (un par
// véhicule si le laveur l'a choisi) frappent la carte sous ses yeux. Sans ce paramètre, la
// carte est simplement montrée.

export const metadata: Metadata = {
  title: 'Ma carte de fidélité',
  robots: { index: false, follow: false },
}

export default async function CarteFidelite({ params, searchParams }: { params: Promise<{ jeton: string }>; searchParams: Promise<{ tampon?: string }> }) {
  const [{ jeton }, { tampon }] = await Promise.all([params, searchParams])
  if (!jetonValide(jeton)) notFound()
  const admin = createAdminClient()

  const { data: carte } = await admin.from('fidelite_cartes').select('washer_id, cle, ajustement').eq('jeton', jeton).maybeSingle()
  if (!carte) notFound()

  const { data: laveur } = await admin
    .from('washers')
    .select('id, name, slug, logo_url, brand_color, profile_updated_at, fidelite, plan, grandfathered, created_at, subscription_status, trial_ends_at, subscription_ends_at, account_status')
    .eq('id', carte.washer_id)
    .maybeSingle()
  if (!laveur || laveur.account_status !== 'active') notFound()

  const reglages = fideliteActive(laveur.fidelite)
  const etat = reglages ? await etatDuClient(admin, laveur.id, carte.cle as string, reglages.tampons, Number(carte.ajustement ?? 0), reglages.tampon_par_vehicule) : null
  const apparence = reglages ? apparenceCarte(laveur, reglages, jeton) : null
  // La carte en cours ; complète (récompense pas encore utilisée), elle reste pleine.
  const surLaCarte = etat ? (etat.disponibles > 0 ? etat.requis : etat.progression) : 0
  const nouveaux = Math.min(Math.max(0, Math.floor(Number(tampon) || 0)), surLaCarte)
  const scenario = nouveaux > 0 ? 'tampon' : 'consultation'
  const complete = etat ? surLaCarte >= etat.requis : false

  return (
    <main className="min-h-screen bg-[#F6F5F3] px-4 pb-12 pt-8 text-[#16161A] [font-family:var(--font-archivo)] dark:bg-[#0E0E11] dark:text-[#F3F3F5]">
      <div className="mx-auto max-w-md">
        {/* Retour à la page de réservation (demande d'Alexandre, 2026-10-18) : le client arrive ici
            depuis l'écran de confirmation ou depuis un email, sans historique sur lequel revenir. */}
        <Link href={`/book/${laveur.slug}`} className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-0.5 pr-3 text-[14px] font-semibold text-[#16161A] dark:text-[#F3F3F5]">
          <ChevronLeft size={22} strokeWidth={2} aria-hidden />
          Page de réservation
        </Link>
        <p className="text-[13px] font-medium text-[#6B6B76] dark:text-[#9A9AA4]">{laveur.name}</p>
        <h1 className="mt-1 text-[30px] font-bold leading-[1.05] tracking-[-0.03em] [font-stretch:112%]">
          {scenario === 'tampon' ? (complete ? 'Votre carte est complète' : nouveaux > 1 ? `Vos ${nouveaux} tampons sont arrivés` : 'Votre tampon est arrivé') : 'Ma carte de fidélité'}
        </h1>

        {reglages && etat && apparence ? (
          <>
            <div className="-mx-4 mt-2">
              <CarteFidelite3D
                {...apparence}
                requis={etat.requis}
                tampons={surLaCarte}
                scenario={scenario}
                nouveaux={Math.max(1, nouveaux)}
                largeur={380}
                legende={scenario === 'tampon' ? (complete ? 'Carte complète · récompense débloquée' : `+${nouveaux} tampon${nouveaux > 1 ? 's' : ''} · ${surLaCarte} sur ${etat.requis}`) : null}
              />
            </div>
            <p className="mt-2 text-[16px] leading-snug">{phraseCarte(etat, reglages)}</p>
            <p className="mt-2 text-[13px] leading-snug text-[#6B6B76] dark:text-[#9A9AA4]">
              {reglages.tampon_par_vehicule ? 'Un tampon par véhicule lavé' : 'Un tampon par prestation terminée'}. Réservez avec le même numéro de téléphone et le même email pour qu’il compte. Touchez la carte pour la retourner.
            </p>
          </>
        ) : (
          <p className="mt-6 text-[15px]">{laveur.name} ne propose plus de carte de fidélité pour le moment.</p>
        )}

        <Link href={`/book/${laveur.slug}`} className="mt-6 flex min-h-12 items-center justify-center rounded-2xl bg-[#16161A] px-4 text-[15px] font-semibold text-white active:scale-[.98] dark:bg-white dark:text-[#16161A]">
          Réserver un lavage
        </Link>
      </div>
    </main>
  )
}
