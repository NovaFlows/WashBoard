import { NextRequest, NextResponse } from 'next/server'
import { getMapsApiKey } from '@/lib/googleMaps'
import { createAdminClient } from '@/lib/supabase/admin'
import { verdictZone } from '@/lib/zone'
import type { ZoneConfig } from '@/types'
import { refusSiQuotaMapsDepasse } from '@/lib/publicApiGuard'
import { logger } from '@/lib/logger'

// Appelée pendant la saisie de l'adresse, pour prévenir le client avant qu'il
// aille au bout du formulaire. La règle elle-même vit dans `@/lib/zone` et est
// rejouée à la création de réservation : cette route est un confort
// d'interface, pas un contrôle de sécurité.

export async function GET(request: NextRequest) {
  // Chaque appel de cette route coûte de l'argent chez Google : plafond partagé, voir publicApiGuard.
  const refus = refusSiQuotaMapsDepasse(request)
  if (refus) return refus

  const { searchParams } = new URL(request.url)
  const washerId = searchParams.get('washer_id')
  const address  = searchParams.get('address')

  if (!washerId || !address) return NextResponse.json({ allowed: true })

  // Sans session : lecture côté serveur, la table `washers` n'étant plus
  // lisible par la clé publique.
  const supabase = createAdminClient()
  const { data: washer, error: errWasher } = await supabase
    .from('washers')
    .select('zone_config')
    .eq('id', washerId)
    .single()
  if (errWasher) logger.error('zone.check.washer.read_failed', { washerId }, errWasher)

  const verdict = await verdictZone(
    washer?.zone_config as ZoneConfig | null,
    address,
    getMapsApiKey(),
    { washerId },
  )
  return NextResponse.json(verdict)
}
