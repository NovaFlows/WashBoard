import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { CategoryType } from '@/types'

function sanitizeTypes(raw: unknown): CategoryType[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => {
      const obj = t as { id?: unknown; name?: unknown }
      const name = typeof obj?.name === 'string' ? obj.name.trim() : ''
      const id = typeof obj?.id === 'string' && obj.id ? obj.id : crypto.randomUUID()
      return { id, name }
    })
    .filter((t) => t.name.length > 0)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.types !== undefined) updates.types = sanitizeTypes(body.types)
  if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0

  const { error } = await supabase.from('service_categories').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase.from('service_categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
