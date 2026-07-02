import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Endpoint de nettoyage réservé aux tests E2E — bloqué en production.
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Non disponible en production' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { client_email } = body as { client_email?: string }

  if (!client_email || !client_email.includes('@')) {
    return NextResponse.json({ error: 'client_email invalide' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('bookings').delete().eq('client_email', client_email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
