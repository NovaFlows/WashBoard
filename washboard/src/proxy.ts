import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Blocage si abonnement expiré (sauf sur la page abonnement elle-même)
  if (user && request.nextUrl.pathname.startsWith('/dashboard') && !request.nextUrl.pathname.startsWith('/dashboard/abonnement')) {
    const { data: washer } = await supabase
      .from('washers')
      .select('subscription_status, trial_ends_at')
      .eq('user_id', user.id)
      .single()

    if (washer) {
      const isExpiredStatus = washer.subscription_status === 'expired'
      const isTrialExpired = washer.subscription_status === 'trial' &&
        washer.trial_ends_at &&
        new Date(washer.trial_ends_at) < new Date()

      if (isExpiredStatus || isTrialExpired) {
        return NextResponse.redirect(new URL('/dashboard/abonnement', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
