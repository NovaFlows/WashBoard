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

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { name, types, display_order } = await request.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nom de catégorie requis' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('service_categories')
    .insert({
      washer_id: washer.id,
      name: name.trim(),
      types: sanitizeTypes(types),
      display_order: Number(display_order) || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
