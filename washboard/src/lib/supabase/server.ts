import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Silence volontaire, et le seul du projet : écrire un cookie
            // depuis un Server Component lève toujours. Le rafraîchissement
            // de session est alors assuré par le proxy (`src/proxy.ts`), donc
            // il n'y a rien à signaler ni à réparer ici. Tracer cette erreur
            // noierait les vraies pannes sous un bruit permanent.
          }
        },
      },
    }
  )
}
