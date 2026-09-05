import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.category_id !== undefined) updates.category_id = body.category_id ?? null
  if (body.description !== undefined) updates.description = body.description?.trim() || null
  if (body.price !== undefined) updates.price = Number(body.price)
  if (body.duration_minutes !== undefined) updates.duration_minutes = Number(body.duration_minutes)
  if (body.vehicle_types !== undefined) updates.vehicle_types = body.vehicle_types
  if (body.vehicle_price_overrides !== undefined) updates.vehicle_price_overrides = body.vehicle_price_overrides
  if (body.addons !== undefined) updates.addons = body.addons

  const { error } = await supabase.from('services').update(updates).eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('services.id.patch.db', error)
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { error } = await supabase.from('services').delete().eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('services.id.delete.db', error)
  return NextResponse.json({ success: true })
}
