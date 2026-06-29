import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Actions sur le compte du laveur connecté :
//  - deactivate : suspend le compte (réversible), masque la page de réservation
//  - reactivate : réactive un compte désactivé ou annule une suppression programmée
//  - delete     : programme la suppression définitive (purge réelle après 30 j
//                 via /api/cron/purge-accounts). Demande de retaper le nom exact.
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers').select('id, name, account_status').eq('user_id', user.id).single()
  if (!washer) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const { action, confirm_name } = await request.json() as { action?: string; confirm_name?: string }

  const updates: Record<string, unknown> = {}

  if (action === 'deactivate') {
    updates.account_status = 'deactivated'
    updates.deletion_scheduled_at = null
  } else if (action === 'reactivate') {
    updates.account_status = 'active'
    updates.deletion_scheduled_at = null
  } else if (action === 'delete') {
    if ((confirm_name ?? '').trim().toLowerCase() !== washer.name.trim().toLowerCase()) {
      return NextResponse.json({ error: "Le nom saisi ne correspond pas au nom de l'entreprise" }, { status: 400 })
    }
    updates.account_status = 'pending_deletion'
    updates.deletion_scheduled_at = new Date().toISOString()
  } else {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('washers').update(updates).eq('id', washer.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, account_status: updates.account_status })
}
