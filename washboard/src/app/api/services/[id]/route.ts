import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

async function getWasherId(userId: string): Promise<string | null> {
  const { data } = await admin().from('washers').select('id').eq('user_id', userId).single()
  return data?.id ?? null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const washerId = await getWasherId(user.id)
  if (!washerId) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.price !== undefined) updates.price = Number(body.price)
  if (body.duration_minutes !== undefined) updates.duration_minutes = Number(body.duration_minutes)
  if (body.vehicle_types !== undefined) updates.vehicle_types = body.vehicle_types

  const { error } = await admin().from('services').update(updates).eq('id', id).eq('washer_id', washerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const washerId = await getWasherId(user.id)
  if (!washerId) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { error } = await admin().from('services').delete().eq('id', id).eq('washer_id', washerId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
