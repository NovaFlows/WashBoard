import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/apiError'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sanitizeTypes } from '@/lib/categoryTypes'

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

  if (error) return errorResponse('categories.post.db', error)
  return NextResponse.json({ data })
}
