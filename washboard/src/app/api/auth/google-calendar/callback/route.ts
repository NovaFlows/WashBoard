import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCode } from '@/lib/google-calendar'

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code     = searchParams.get('code')
  const washerId = searchParams.get('state')

  if (!code || !washerId)
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar`)

  const refreshToken = await exchangeCode(code)
  if (!refreshToken)
    return NextResponse.redirect(`${BASE}/dashboard/admin?error=google-calendar-no-token`)

  const supabase = await createClient()
  await supabase
    .from('washers')
    .update({ google_refresh_token: refreshToken })
    .eq('id', washerId)

  return NextResponse.redirect(`${BASE}/dashboard/admin?tab=identite&success=google-calendar`)
}
