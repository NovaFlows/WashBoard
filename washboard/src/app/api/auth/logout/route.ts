import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

async function signOutAndRedirect() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function POST() {
  await signOutAndRedirect()
}

export async function GET() {
  await signOutAndRedirect()
}
