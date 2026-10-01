import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PHRASE_SLUG_INVALIDE, slugValide, slugLibre } from '@/lib/slug'

// Disponibilité d'un lien de réservation, vérifiée pendant la saisie (onboarding).
// Elle ne dispense pas `PATCH /api/washer` de revérifier : entre les deux, un
// autre laveur peut avoir pris le lien.
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const slug = (request.nextUrl.searchParams.get('slug') ?? '').trim().toLowerCase()
  if (!slugValide(slug)) {
    return NextResponse.json({ error: PHRASE_SLUG_INVALIDE }, { status: 400 })
  }

  const disponibilite = await slugLibre(createAdminClient(), slug, user.id)
  if (!disponibilite.ok) {
    // Répondre « libre » sur une lecture ratée ferait valider un lien que
    // l'enregistrement refuserait ensuite.
    logger.error('washer.slug.disponibilite_illisible', { userId: user.id }, disponibilite.erreur)
    return NextResponse.json(
      { error: 'Impossible de vérifier la disponibilité de ce lien. Réessaie dans un instant.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ disponible: disponibilite.libre })
}
