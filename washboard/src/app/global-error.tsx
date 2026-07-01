'use client'

// Error boundary racine : capture les erreurs qui remontent jusqu'au layout
// racine (rare mais critique). Doit rendre <html>/<body> car il remplace le
// layout racine. Next attache `error.digest` = identifiant corrélé aux logs
// serveur → l'utilisateur donne ce code, on retrouve l'incident dans Vercel.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Trace côté client (visible dans la console navigateur / outils de session)
    console.error(JSON.stringify({
      level: 'error',
      event: 'react.global_error',
      digest: error.digest,
      message: error.message,
    }))
  }, [error])

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#e2e8f0' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0 }}>Oups.</p>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 8 }}>Une erreur inattendue est survenue</h1>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: 8 }}>
              L&apos;incident a été enregistré. Réessayez, et si le problème persiste, contactez le support en indiquant le code ci-dessous.
            </p>
            {error.digest && (
              <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b', marginTop: 12 }}>
                Code : {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ marginTop: 20, padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
