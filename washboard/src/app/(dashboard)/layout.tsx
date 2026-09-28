import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { quotaPrestations, planEffectif } from '@/lib/plan'
import { aMettreEnVeille, estVisibleParLesClients } from '@/lib/prestation'
import { COLONNE_INCONNUE } from '@/lib/compterPrestations'
import { COOKIE_REPORT } from '@/lib/veilleReport'
import { ChoixVeilleModal } from '@/components/dashboard/ChoixVeilleModal'

/** Enveloppe commune à tout le tableau de bord.
 *
 *  Elle ne sert aujourd'hui qu'à une chose : demander au laveur quelles
 *  prestations garder en ligne, quand il en a plus que son offre n'en affiche.
 *
 *  Pourquoi ici et pas sur la seule page d'accueil : le laveur n'arrive pas
 *  toujours par là. L'application installée se rouvre là où il l'avait laissée
 *  — son agenda, le plus souvent — et une notification de réservation l'emmène
 *  droit sur une fiche de rendez-vous. La question posée sur `/dashboard`
 *  seulement ne lui serait jamais arrivée, alors que sa page de réservation
 *  n'affiche déjà plus tout son catalogue.
 *
 *  « Plus tard » reste toujours possible, sinon ce serait une porte fermée —
 *  et il pose un cookie, sans quoi la fenêtre resurgirait au premier clic dans
 *  le menu.
 *
 *  Coût : une lecture de la fiche laveur par page, sur un index (`user_id`).
 *  Les offres sans plafond — Pro, Business, clients historiques — s'arrêtent
 *  là ; seules celles qui en ont un lisent le catalogue. La fiche est certes
 *  déjà lue par chaque page, mais la mutualiser demanderait de faire descendre
 *  le résultat du layout vers les pages, ce que Next ne permet pas sans
 *  contexte : une requête indexée de plus coûte moins cher que cette plomberie.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // « Plus tard » : on ne redirige plus de la visite. Lu en premier, pour ne
  // même pas payer les requêtes quand la question a déjà été repoussée.
  if ((await cookies()).get(COOKIE_REPORT)) return <>{children}</>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pas de session : les pages elles-mêmes redirigent vers la connexion.
  if (!user) return <>{children}</>

  const { data: washer } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const plafond = quotaPrestations(washer)
  if (!washer || plafond === null) return <>{children}</>

  // La colonne `en_veille` est demandée EXPLICITEMENT : tant que la migration
  // 005 n'a pas tourné, cette lecture échoue, on n'a rien, et on ne redirige
  // nulle part. L'écran ne peut donc pas proposer une action que le serveur
  // refuserait. Voir `compterPrestations` pour le même raisonnement côté API.
  const { data: services, error } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, vehicle_types, en_veille')
    .order('created_at', { ascending: true })
    .eq('washer_id', washer.id)

  // Migration en attente ou vraie panne : dans les deux cas on laisse passer.
  // Interrompre la navigation sur une lecture ratée serait pire que le
  // problème qu'on cherche à signaler.
  if (error) return <>{children}</>

  const actives = (services ?? []).filter(estVisibleParLesClients)
  const aRanger = aMettreEnVeille(actives.length, plafond)

  return (
    <>
      {children}
      {aRanger > 0 && (
        <ChoixVeilleModal
          actives={actives}
          plafond={plafond}
          aRanger={aRanger}
          offre={planEffectif(washer)}
        />
      )}
    </>
  )
}
