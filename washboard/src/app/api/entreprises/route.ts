import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Entreprises (comptes B2B à plusieurs contacts et plusieurs sites) — proposition de Yanis,
// canevas du 2026-09-28. Client RLS-scopé, pas le client admin : rien ici n'a besoin de sortir
// du garde-fou « ce laveur ne touche que ses propres lignes ».
//
// Pas de GET ici : les entreprises se lisent depuis `clients/page.tsx` (server component),
// avec leurs sites et leurs contacts déjà joints. Un mutation ici se suit d'un
// `router.refresh()` côté navigateur — même schéma que `ProfilV2.tsx`.

async function washerConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  const { data: washer, error } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (error || !washer) {
    logger.error('entreprises.washer_read_failed', {}, error)
    return { erreur: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }
  }
  return { supabase, washerId: washer.id as string }
}

const NOM_MAX = 200

export async function POST(req: NextRequest) {
  const ctx = await washerConnecte()
  if (ctx.erreur) return ctx.erreur

  const corps = await req.json().catch(() => ({})) as { nom?: unknown; delaiPaiementJours?: unknown }
  const nom = typeof corps.nom === 'string' ? corps.nom.trim() : ''
  if (!nom) return NextResponse.json({ error: 'Indiquez le nom de l’entreprise.' }, { status: 400 })
  if (nom.length > NOM_MAX) return NextResponse.json({ error: 'Ce nom est trop long.' }, { status: 400 })

  let delai: number | null = null
  if (corps.delaiPaiementJours !== undefined && corps.delaiPaiementJours !== null) {
    const n = Number(corps.delaiPaiementJours)
    if (!Number.isFinite(n) || n < 0 || n > 3650) {
      return NextResponse.json({ error: 'Le délai de paiement doit être un nombre de jours raisonnable.' }, { status: 400 })
    }
    delai = Math.round(n)
  }

  const { data, error } = await ctx.supabase!
    .from('entreprises')
    .insert({ washer_id: ctx.washerId, nom, delai_paiement_jours: delai })
    .select('id')
    .single()

  if (error) return errorResponse('entreprises.post.db', error)
  logger.info('entreprises.creee', { washerId: ctx.washerId, entrepriseId: data.id })
  return NextResponse.json({ id: data.id })
}
