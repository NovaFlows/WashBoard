import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Portée « local » : seule la session de l'appareil qui clique est fermée.
//
// Par défaut, `signOut()` est « global » et révoque TOUTES les sessions du
// compte. Se déconnecter sur l'ordinateur déconnectait donc aussi
// l'application installée sur le téléphone, sans qu'on le voie : on la
// retrouvait sur l'écran de connexion quelques heures plus tard. Signalé le
// 2026-09-12.
async function signOutAndRedirect() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}

export async function POST() {
  await signOutAndRedirect()
}

export async function GET() {
  await signOutAndRedirect()
}
