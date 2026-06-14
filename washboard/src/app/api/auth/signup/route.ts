import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export async function POST(request: NextRequest) {
  const { name, email, password } = await request.json()

  if (!name?.trim() || !email?.includes('@') || !password || password.length < 6) {
    return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (authError) {
    const msg = authError.message.includes('already registered')
      ? 'Cet email est déjà utilisé'
      : authError.message
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const baseSlug = generateSlug(name.trim())
  const slug = `${baseSlug}-${randomUUID().slice(0, 4)}`

  const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  const { error: washerError } = await supabase
    .from('washers')
    .insert({
      id: randomUUID(),
      user_id: authData.user.id,
      name: name.trim(),
      slug,
      trial_ends_at: trialEndsAt,
      subscription_status: 'trial',
    })

  if (washerError) {
    await supabase.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: 'Erreur lors de la création du profil' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
