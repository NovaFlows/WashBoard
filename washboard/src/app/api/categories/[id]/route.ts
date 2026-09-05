import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { sanitizeTypes } from '@/lib/categoryTypes'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.types !== undefined) updates.types = sanitizeTypes(body.types)
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0

  const { error } = await supabase.from('service_categories').update(updates).eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('categories.id.patch.db', error)
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId } = auth.ctx

  const { error } = await supabase.from('service_categories').delete().eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('categories.id.delete.db', error)
  return NextResponse.json({ success: true })
}
