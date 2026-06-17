import { createClient } from '@/lib/supabase/server'
import { computeTravelFee } from '@/lib/travelFee'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const washer_id    = searchParams.get('washer_id')
  const address      = searchParams.get('address')
  // scheduled_at optionnel : si fourni, utilisé pour le mode "RDV précédent"
  // Sinon on utilise maintenant (→ aucun RDV précédent possible → fallback base)
  const scheduled_at = searchParams.get('scheduled_at') ?? new Date().toISOString()

  if (!washer_id || !address) {
    return Response.json({ fee: 0 })
  }

  const supabase = await createClient()
  const fee = await computeTravelFee(supabase, washer_id, address, scheduled_at)
  return Response.json({ fee })
}
