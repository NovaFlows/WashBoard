import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Tâches d'un client — « Rappeler », « proposer l'intérieur » (menu « … » de la fiche,
// 2026-09-28). Table `client_taches`, SQL donné dans la conversation du 2026-09-28. Un
// pense-bête court, pas un gestionnaire de projet : ni échéance, ni priorité, ni assignation —
// un seul laveur, une seule liste.

const TEXTE_MAX = 300

/** `cle` vient de `cleClient` : un email en minuscules, ou `tel:` + des chiffres. */
function cleValide(cle: string): boolean {
  return /^[^\s]+@[^\s]+\.[^\s]+$/.test(cle) || /^tel:\d{6,}$/.test(cle)
}

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

/** Ouvertes seulement (`faite_le` nul), les plus récentes en premier — une tâche cochée ne
 *  revient pas encombrer la fiche, elle n'a pas besoin d'un historique. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle: cleBrute } = await params
  const cle = decodeURIComponent(cleBrute)
  if (!cleValide(cle)) return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })

  const ctx = await washerConnecte()
  if (ctx.erreur) return ctx.erreur

  const { data, error } = await ctx.supabase!
    .from('client_taches')
    .select('id, texte, faite_le, created_at')
    .eq('washer_id', ctx.washerId!)
    .eq('cle', cle)
    .is('faite_le', null)
    .order('created_at', { ascending: false })
  if (error) return errorResponse('taches.get.db', error)

  return NextResponse.json({
    taches: (data ?? []).map(t => ({ id: t.id, texte: t.texte, faiteLe: t.faite_le, creeLe: t.created_at })),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle: cleBrute } = await params
  const cle = decodeURIComponent(cleBrute)
  if (!cleValide(cle)) return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })

  const ctx = await washerConnecte()
  if (ctx.erreur) return ctx.erreur

  const corps = await req.json().catch(() => ({})) as { texte?: unknown }
  const texte = typeof corps.texte === 'string' ? corps.texte.trim().slice(0, TEXTE_MAX) : ''
  if (!texte) return NextResponse.json({ error: 'Indiquez le texte de la tâche.' }, { status: 400 })

  const { data, error } = await ctx.supabase!
    .from('client_taches')
    .insert({ washer_id: ctx.washerId!, cle, texte })
    .select('id, texte, faite_le, created_at')
    .single()
  if (error) return errorResponse('taches.post.db', error)

  logger.info('taches.creee', { washerId: ctx.washerId })
  return NextResponse.json({ id: data.id, texte: data.texte, faiteLe: data.faite_le, creeLe: data.created_at })
}
