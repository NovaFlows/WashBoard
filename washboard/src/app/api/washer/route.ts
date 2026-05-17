import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { name, phone, logo_url, welcome_message } = await request.json()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name?.trim() ?? null
  if (phone !== undefined) updates.phone = phone?.trim() || null
  if (logo_url !== undefined) updates.logo_url = logo_url?.trim() || null
  if (welcome_message !== undefined) updates.welcome_message = welcome_message?.trim() || null

  const { error } = await admin
    .from('washers')
    .update(updates)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
