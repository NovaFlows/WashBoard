import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Dépenses récurrentes d'un laveur.
//
// Deux corrections après un audit externe du 2026-09-05 :
//
// 1. `update(body)` écrivait TOUT ce que le navigateur envoyait, y compris
//    `washer_id` — un laveur pouvait donc réaffecter sa dépense au compte d'un
//    autre. Seuls les champs listés ci-dessous sont désormais modifiables.
//
// 2. Ni la modification ni la suppression ne filtraient sur le laveur : elles
//    ne tenaient que par une policy RLS absente du dépôt, donc invérifiable.
//    Les deux scopent maintenant explicitement, comme le fait déjà
//    `bookings/[id]`.

/** Champs qu'un laveur a le droit de modifier. Tout le reste est ignoré. */
const CHAMPS_MODIFIABLES = ['label', 'amount', 'category', 'day_of_month', 'active'] as const

async function laveurConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: washer, error } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (error || !washer) {
    return { erreur: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }
  }
  return { supabase, washerId: washer.id as string }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const champ of CHAMPS_MODIFIABLES) {
    if (body[champ] !== undefined) updates[champ] = body[champ]
  }

  // Un corps ne contenant que des champs interdits ne doit pas passer pour un
  // succès : sinon l'appelant croit sa modification enregistrée.
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
  }

  const { error } = await ctx.supabase!
    .from('washer_recurring_expenses')
    .update(updates)
    .eq('id', id)
    .eq('washer_id', ctx.washerId)

  if (error) {
    logger.error('expenses.recurring.update_failed', { washerId: ctx.washerId }, error)
    return NextResponse.json({ error: 'Modification impossible' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur

  const { error } = await ctx.supabase!
    .from('washer_recurring_expenses')
    .delete()
    .eq('id', id)
    .eq('washer_id', ctx.washerId)

  if (error) {
    logger.error('expenses.recurring.delete_failed', { washerId: ctx.washerId }, error)
    return NextResponse.json({ error: 'Suppression impossible' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
