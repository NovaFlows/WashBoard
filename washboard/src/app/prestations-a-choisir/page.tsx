import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { quotaPrestations, planEffectif } from '@/lib/plan'
import { aMettreEnVeille, estVisibleParLesClients } from '@/lib/prestation'
import { COLONNE_INCONNUE } from '@/lib/compterPrestations'
import { ChoixVeillePage } from '@/components/dashboard/ChoixVeillePage'

export const dynamic = 'force-dynamic'

/** Écran de choix du catalogue, hors du groupe `(dashboard)`.
 *
 *  Hors du groupe, et c'est le point : c'est le layout du tableau de bord qui
 *  redirige ici. Si cette page vivait dedans, elle déclencherait sa propre
 *  redirection et la boucle serait infinie.
 *
 *  Toute situation qui ne demande plus de choix renvoie au tableau de bord :
 *  pas de session, offre sans plafond, catalogue rentré dans les clous, ou
 *  colonne `en_veille` absente. Une page qui reste ouverte sans rien à décider
 *  est une impasse. */
export default async function PrestationsAChoisirPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: washer } = await supabase
    .from('washers')
    .select('id, plan, grandfathered, slug, created_at, subscription_status, trial_ends_at, subscription_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const plafond = quotaPrestations(washer)
  if (!washer || plafond === null) redirect('/dashboard')

  const { data: services, error } = await supabase
    .from('services')
    .select('id, name, price, duration_minutes, vehicle_types, en_veille')
    .eq('washer_id', washer.id)
    .order('created_at', { ascending: true })

  // Colonne inconnue = migration 005 pas encore passée. Rien à proposer.
  if (error) {
    if ((error as { code?: string }).code !== COLONNE_INCONNUE) {
      // Une vraie panne de lecture : on ne devine pas, on renvoie au tableau de bord.
    }
    redirect('/dashboard')
  }

  const actives = (services ?? []).filter(estVisibleParLesClients)
  const aRanger = aMettreEnVeille(actives.length, plafond)
  if (aRanger <= 0) redirect('/dashboard')

  return (
    <ChoixVeillePage
      actives={actives}
      plafond={plafond}
      aRanger={aRanger}
      offre={planEffectif(washer)}
    />
  )
}
