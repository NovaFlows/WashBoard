import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

async function washerConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: washer, error } = await supabase.from('washers').select('id').eq('user_id', user.id).single()
  if (error || !washer) {
    logger.error('taches.washer_read_failed', {}, error)
    return { erreur: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }
  }
  return { erreur: null, supabase, washerId: washer.id as string }
}

/** Coche ou décoche une tâche — `faite_le` porte QUAND, pas un simple booléen, pour rester
 *  cohérent avec `paye_le` (documents) et `masque_le` (clients) : cette forme sert déjà deux
 *  fois ailleurs dans le fichier. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await washerConnecte()
  if (ctx.erreur) return ctx.erreur

  const corps = await req.json().catch(() => ({})) as { faite?: unknown }
  if (typeof corps.faite !== 'boolean') {
    return NextResponse.json({ error: 'faite doit être vrai ou faux' }, { status: 400 })
  }

  const { error } = await ctx.supabase!
    .from('client_taches')
    .update({ faite_le: corps.faite ? new Date().toISOString() : null })
    .eq('id', id)
    .eq('washer_id', ctx.washerId!)
  if (error) return errorResponse('taches.patch.db', error)

  logger.info('taches.maj', { washerId: ctx.washerId, faite: corps.faite })
  return NextResponse.json({ id, faite: corps.faite })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await washerConnecte()
  if (ctx.erreur) return ctx.erreur

  const { error } = await ctx.supabase!.from('client_taches').delete().eq('id', id).eq('washer_id', ctx.washerId!)
  if (error) return errorResponse('taches.delete.db', error)

  logger.info('taches.supprimee', { washerId: ctx.washerId })
  return NextResponse.json({ success: true })
}
