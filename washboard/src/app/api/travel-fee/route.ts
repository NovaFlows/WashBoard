import { createAdminClient } from '@/lib/supabase/admin'
import { computeTravelFee } from '@/lib/travelFee'
import { refusSiQuotaMapsDepasse } from '@/lib/publicApiGuard'

export async function GET(req: Request) {
  // Chaque appel de cette route coûte de l'argent chez Google : plafond partagé, voir publicApiGuard.
  const refus = refusSiQuotaMapsDepasse(req)
  if (refus) return refus

  const { searchParams } = new URL(req.url)
  const washer_id    = searchParams.get('washer_id')
  const address      = searchParams.get('address')
  // scheduled_at optionnel : si fourni, utilisé pour le mode "RDV précédent"
  // Sinon on utilise maintenant (→ aucun RDV précédent possible → fallback base)
  const scheduled_at = searchParams.get('scheduled_at') ?? new Date().toISOString()

  if (!washer_id || !address) {
    return Response.json({ fee: 0 })
  }

  // Client admin, et pas celui de la session : la fiche du laveur n'est plus
  // lisible par la clé publique depuis l'audit du 2026-09-05, et un visiteur
  // anonyme recevait donc « aucun frais » quels que soient les paliers réglés.
  // Rien ne sort d'ici qu'un nombre — aucune donnée du laveur n'est exposée.
  const fee = await computeTravelFee(createAdminClient(), washer_id, address, scheduled_at)
  return Response.json({ fee })
}
