import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Endpoint de nettoyage réservé aux tests E2E — bloqué en production.
//
// Les tests écrivent dans la vraie base (le projet n'a pas encore de séparation
// dev/prod, voir TODO.md). Tout ce qu'ils créent est préfixé `[E2E]` et doit
// repartir ensuite, sinon la base du compte de test se remplit de déchets à
// chaque exécution.
//
// Deux modes :
//   - `client_email` : supprime les réservations de ce client (usage historique)
//   - `prefix`       : supprime les objets de test portant ce préfixe
const E2E_PREFIX = '[E2E]'

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Non disponible en production' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { client_email, prefix } = body as { client_email?: string; prefix?: string }

  const supabase = createAdminClient()

  if (client_email) {
    if (!client_email.includes('@')) {
      return NextResponse.json({ error: 'client_email invalide' }, { status: 400 })
    }
    const { error } = await supabase.from('bookings').delete().eq('client_email', client_email)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (prefix) {
    // Garde-fou : on n'accepte que le préfixe de test. Un préfixe libre
    // permettrait d'effacer les données d'un vrai laveur depuis un test.
    if (prefix !== E2E_PREFIX) {
      return NextResponse.json({ error: `prefix doit valoir « ${E2E_PREFIX} »` }, { status: 400 })
    }

    const pattern = `${prefix}%`
    const résultats = await Promise.all([
      supabase.from('services').delete().like('name', pattern).select('id'),
      supabase.from('service_categories').delete().like('name', pattern).select('id'),
      supabase.from('washer_expenses').delete().like('label', pattern).select('id'),
      supabase.from('washer_recurring_expenses').delete().like('label', pattern).select('id'),
    ])

    // Un échec est renvoyé plutôt qu'avalé : un nettoyage qui échoue en
    // silence laisse la base se remplir sans que personne ne s'en aperçoive.
    const échec = résultats.find(r => r.error)
    if (échec?.error) {
      return NextResponse.json({ error: échec.error.message }, { status: 500 })
    }

    const supprimés = résultats.reduce((n, r) => n + (r.data?.length ?? 0), 0)
    return NextResponse.json({ ok: true, supprimés })
  }

  return NextResponse.json({ error: 'client_email ou prefix requis' }, { status: 400 })
}
