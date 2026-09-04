'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Traite les jetons que Supabase dépose dans le hash de l'URL
 * (`#access_token=...&type=...`), quelle que soit la page d'arrivée.
 *
 * Deux cas, deux traitements :
 *
 * — `type=recovery` : réinitialisation de mot de passe. On redirige vers
 *   `/reset-password` en conservant le hash intact.
 *
 * — `type=magiclink` : connexion par lien, utilisée par l'accès support. Le
 *   hash n'est JAMAIS transmis au serveur : la page a donc déjà été rendue
 *   avec la session précédente. Sans traitement, on lisait le jeton du bon
 *   compte dans l'URL tout en voyant le tableau de bord de l'ancien — au point
 *   de croire que le lien avait ouvert le mauvais compte. On établit donc la
 *   session, puis on recharge pour que le serveur voie les nouveaux cookies.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const type = params.get('type')

    if (type === 'recovery' && accessToken) {
      if (!window.location.pathname.startsWith('/reset-password')) {
        window.location.replace(`/reset-password${hash}`)
      }
      return
    }

    if (type === 'magiclink' && accessToken) {
      const refreshToken = params.get('refresh_token')
      if (!refreshToken) return

      createClient()
        .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) return
          // Rechargement complet, et non `router.refresh()` : le rendu serveur
          // doit repartir des cookies fraîchement posés. `replace` remplace
          // l'entrée d'historique, ce qui retire au passage le jeton de la
          // barre d'adresse — il n'a rien à y faire une fois consommé.
          window.location.replace(window.location.pathname)
        })
        .catch(() => {
          // Échec d'établissement : on laisse la page telle quelle plutôt que
          // de boucler sur un rechargement. L'utilisateur voit qu'il n'est pas
          // sur le bon compte et peut redemander un lien.
        })
    }
  }, [])

  return null
}
