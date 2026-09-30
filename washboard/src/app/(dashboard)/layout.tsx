import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Seul endroit qui ferme le tableau de bord à un compte dont l'email n'est pas
// confirmé. En pratique Supabase refuse déjà la connexion d'un tel compte ;
// cette garde couvre toute session qui y parviendrait par un autre chemin.
//
// Elle ne remplace PAS la vérification `if (!user) redirect('/login')` de
// chaque page : sans utilisateur (session absente, ou Supabase injoignable),
// elle laisse passer et la page applique sa propre règle.
export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user && !user.email_confirmed_at) redirect('/verifier-email')
  return children
}
