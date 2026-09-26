import { createClient } from '@/lib/supabase/server'
import { quotaPrestations, planEffectif } from '@/lib/plan'
import { aMettreEnVeille, estVisibleParLesClients } from '@/lib/prestation'
import { COLONNE_INCONNUE } from '@/lib/compterPrestations'
import { RappelPrestationsEnVeille } from '@/components/dashboard/RappelPrestationsEnVeille'

/** Enveloppe commune à tout le tableau de bord.
 *
 *  Elle ne sert aujourd'hui qu'à une chose : poser la question du catalogue
 *  trop grand SUR N'IMPORTE QUELLE PAGE, et pas seulement sur l'accueil.
 *
 *  Le laveur n'arrive pas toujours par l'accueil. L'application installée se
 *  rouvre là où il l'avait laissée — son agenda, le plus souvent — et une
 *  notification de réservation l'emmène droit sur une fiche de rendez-vous. La
 *  question posée uniquement sur `/dashboard` ne lui serait donc jamais
 *  arrivée, alors que sa page de réservation n'affiche déjà plus tout son
 *  catalogue.
 *
 *  Coût : une lecture de la fiche laveur à chaque page du tableau de bord,
 *  sur un index (`user_id`). Les offres sans plafond — Pro, Business, clients
 *  historiques — s'arrêtent là ; seules celles qui en ont un lisent le
 *  catalogue. La fiche est certes déjà lue par chaque page, mais la mutualiser
 *  demanderait de faire descendre le résultat du layout vers les pages, ce que
 *  Next ne permet pas sans contexte : une requête indexée de plus est moins
 *  chère que cette plomberie.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pas de session : les pages elles-mêmes redirigent vers la connexion. Ici on
  // se contente de ne rien ajouter.
  if (!user) return <>{children}</>

  const { data: washer } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const plafond = quotaPrestations(washer)
  if (!washer || plafond === null) return <>{children}</>

  // La colonne `en_veille` est demandée EXPLICITEMENT : tant que la migration
  // 005 n'a pas tourné, cette lecture échoue, on n'a rien, et la fenêtre ne
  // s'affiche pas. Elle ne peut donc pas proposer une action que le serveur
  // refuserait. Voir `compterPrestations` pour le même raisonnement côté API.
  const { data: services, error } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, vehicle_types, en_veille')
    .eq('washer_id', washer.id)
    .order('created_at', { ascending: true })

  if (error && (error as { code?: string }).code !== COLONNE_INCONNUE) {
    // Une vraie panne de lecture : on n'affiche rien plutôt que de deviner.
    return <>{children}</>
  }

  const actives = (services ?? []).filter(estVisibleParLesClients)
  const aRanger = aMettreEnVeille(actives.length, plafond)

  return (
    <>
      {children}
      {aRanger > 0 && (
        <RappelPrestationsEnVeille actives={actives} plafond={plafond} aRanger={aRanger} offre={planEffectif(washer)} />
      )}
    </>
  )
}
