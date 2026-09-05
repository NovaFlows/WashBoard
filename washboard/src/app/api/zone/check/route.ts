import { NextRequest, NextResponse } from 'next/server'
import { getMapsApiKey } from '@/lib/googleMaps'
import { createAdminClient } from '@/lib/supabase/admin'
import { verdictZone } from '@/lib/zone'
import type { ZoneConfig } from '@/types'

// Appelée pendant la saisie de l'adresse, pour prévenir le client avant qu'il
// aille au bout du formulaire. La règle elle-même vit dans `@/lib/zone` et est
// rejouée à la création de réservation : cette route est un confort
// d'interface, pas un contrôle de sécurité.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const washerId = searchParams.get('washer_id')
  const address  = searchParams.get('address')

  if (!washerId || !address) return NextResponse.json({ allowed: true })

  // Sans session : lecture côté serveur, la table `washers` n'étant plus
  // lisible par la clé publique.
  const supabase = createAdminClient()
  const { data: washer } = await supabase
    .from('washers')
    .select('zone_config')
    .eq('id', washerId)
    .single()

  const verdict = await verdictZone(
    washer?.zone_config as ZoneConfig | null,
    address,
    getMapsApiKey(),
    { washerId },
  )
  return NextResponse.json(verdict)
}
