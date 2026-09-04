import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rafraîchissement de la session à chaque requête.
//
// Pourquoi ce fichier existe : un jeton d'accès Supabase ne vit qu'une heure.
// Sans rien pour le renouveler côté serveur, un laveur qui rouvrait WashBoard
// le lendemain était renvoyé vers la page de connexion — alors que son jeton
// de rafraîchissement, lui, était toujours valable. Le rendu serveur lisait
// simplement un cookie périmé et concluait « pas connecté ».
//
// C'est particulièrement visible depuis l'application installée sur le
// téléphone : on s'attend à la retrouver ouverte, comme n'importe quelle app.
//
// `getUser()` renouvelle le jeton quand il a expiré ; il reste à réécrire les
// cookies dans la réponse, sinon le navigateur garde les anciens et
// l'opération recommence à chaque page.
//
// Ce fichier ne redirige personne : chaque page du tableau de bord vérifie
// déjà l'accès de son côté. Y ajouter une garde ferait deux endroits à tenir
// d'accord, et le premier oubli ouvrirait une page privée.
//
// ⚠️ En Next.js 16, `middleware.ts` est déprécié et renommé `proxy.ts`
// (même comportement, autre nom de fichier et de fonction exportée).

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Sans cookie de session, il n'y a rien à rafraîchir : une page de
  // réservation client ou un appel d'API public n'en portent aucun. Cela évite
  // un aller-retour vers Supabase qui, mesuré sur la suite de tests, rendait
  // l'ensemble du site environ cinq fois plus lent.
  const aUneSession = request.cookies.getAll().some(c => c.name.startsWith('sb-'))
  if (!aUneSession) return response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Les cookies vont dans la requête (pour le rendu qui suit) ET dans
          // la réponse (pour que le navigateur les conserve).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Un échec ici ne doit jamais empêcher la page de s'afficher : sans réseau
  // vers Supabase, mieux vaut servir la page et laisser la garde de la page
  // décider, plutôt que de renvoyer une erreur sur tout le site.
  try {
    await supabase.auth.getUser()
  } catch {
    // Session non rafraîchie : la page appliquera sa propre règle.
  }

  return response
}

export const config = {
  // Uniquement les PAGES qui lisent une session laveur.
  //
  // `/api/:path*` en était volontairement retiré le 2026-09-04 : l'affichage
  // d'un écran déclenche la navigation PUIS plusieurs appels d'API, tous en
  // même temps. Chacun passait alors ici et tentait son propre
  // rafraîchissement. Or Supabase fait tourner le jeton de rafraîchissement :
  // le premier appel réussit et invalide le jeton, les suivants arrivent avec
  // un jeton déjà consommé et perdent la session. D'où des reconnexions
  // répétées, particulièrement visibles depuis l'application installée, qui
  // ouvre le tableau de bord d'un coup.
  //
  // Les routes d'API n'en ont pas besoin : elles créent leur propre client
  // Supabase, qui sait rafraîchir et écrire les cookies de son côté.
  //
  // Le blog, la landing et les pages de réservation client ne portent aucune
  // session : les y faire passer n'ajouterait que de la latence.
  matcher: [
    '/dashboard/:path*',
    '/login',
    '/signup',
  ],
}
