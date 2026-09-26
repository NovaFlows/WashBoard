import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { requireWasher } from '@/lib/requireWasher'
import { revaliderPageReservation } from '@/lib/revaliderPageReservation'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireWasher()
  if (!auth.ok) return auth.response
  const { supabase, washerId, slug } = auth.ctx

  const { error } = await supabase.from('availabilities').delete().eq('id', id).eq('washer_id', washerId)
  if (error) return errorResponse('availabilities.id.delete.db', error)
  revaliderPageReservation(slug, 'availabilities.id.delete')
  return NextResponse.json({ success: true })
}
