import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'done']),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)

  if (!parsed.success) {
    return Response.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer } = await supabase
    .from('washers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!washer) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await supabase
    .from('bookings')
    .update({ status: parsed.data.status })
    .eq('id', id)
    .eq('washer_id', washer.id)

  if (error) return Response.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 })

  return Response.json({ success: true })
}
