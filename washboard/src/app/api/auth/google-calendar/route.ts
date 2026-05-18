import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL))

  return NextResponse.redirect(getGoogleAuthUrl(washer.id))
}
