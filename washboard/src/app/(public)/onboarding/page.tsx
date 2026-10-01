import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { etatOnboarding } from '@/lib/onboarding'
import Onboarding from './Onboarding'

export const metadata: Metadata = {
  title: 'Bienvenue | WashBoard',
  robots: { index: false },
}

// Montré une seule fois : un compte qui l'a terminé — ou antérieur à sa mise en
// place — repart vers le tableau de bord, y compris en revenant sur l'URL.
export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!user.email_confirmed_at) redirect('/verifier-email')

  const { destination, slug } = await etatOnboarding(supabase, user.id)
  if (destination !== '/onboarding' || !slug) redirect('/dashboard')

  return <Onboarding slug={slug} />
}
