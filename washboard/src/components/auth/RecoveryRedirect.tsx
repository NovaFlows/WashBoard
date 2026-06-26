'use client'

import { useEffect } from 'react'

/**
 * Filet de sécurité global : si Supabase dépose un token de récupération
 * de mot de passe dans le hash de l'URL (#access_token=...&type=recovery)
 * sur n'importe quelle page (souvent la racine à cause du www/redirect URL),
 * on redirige vers /reset-password en conservant le hash intact.
 */
export default function RecoveryRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const isRecovery = params.get('type') === 'recovery' && params.get('access_token')

    if (isRecovery && !window.location.pathname.startsWith('/reset-password')) {
      window.location.replace(`/reset-password${hash}`)
    }
  }, [])

  return null
}
