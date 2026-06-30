import { SupabaseClient } from '@supabase/supabase-js'

type Tier = { max_minutes: number; fee: number }

/** Sélectionne le frais de déplacement selon la durée de trajet (en minutes).
 *  Prend le 1er palier dont max_minutes >= durée ; au-delà, le palier le plus élevé.
 *  Fonction pure (testable). Renvoie 0 si aucun palier.
 */
export function pickTravelFee(tiers: Tier[], durationMin: number): number {
  if (!tiers || tiers.length === 0) return 0
  const sorted = [...tiers].sort((a, b) => a.max_minutes - b.max_minutes)
  const matching = sorted.find(t => durationMin <= t.max_minutes)
  return matching ? matching.fee : (sorted[sorted.length - 1]?.fee ?? 0)
}

/** Résout l'adresse d'origine selon le mode du laveur.
 *  - 'base'     : toujours depuis base_address
 *  - 'previous' : depuis l'adresse du dernier RDV terminé avant scheduled_at, sinon base_address
 */
async function resolveOrigin(
  supabase: SupabaseClient,
  washerId: string,
  mode: 'base' | 'previous',
  baseAddress: string | null,
  scheduledAt: string,
): Promise<string | null> {
  if (mode !== 'previous') return baseAddress

  // Chercher le dernier RDV confirmé/en attente du jour qui se termine avant scheduled_at
  const dayStart = scheduledAt.slice(0, 10) + 'T00:00:00.000Z'
  const { data: prevBookings } = await supabase
    .from('bookings')
    .select('address, scheduled_at, services(duration_minutes)')
    .eq('washer_id', washerId)
    .in('status', ['confirmed', 'pending'])
    .gte('scheduled_at', dayStart)
    .lt('scheduled_at', scheduledAt)
    .order('scheduled_at', { ascending: false })
    .limit(1)

  const prev = prevBookings?.[0]
  if (prev?.address) return prev.address
  return baseAddress
}

/** Calcule les frais de déplacement via Google Maps Distance Matrix.
 *  Retourne 0 si pas de clé, pas de tiers, ou pas d'adresse origine.
 */
export async function computeTravelFee(
  supabase: SupabaseClient,
  washerId: string,
  destinationAddress: string,
  scheduledAt: string,
): Promise<number> {
  const { data: washer } = await supabase
    .from('washers')
    .select('base_address, travel_fee_tiers, travel_fee_mode')
    .eq('id', washerId)
    .single()

  const tiers: Tier[] = washer?.travel_fee_tiers ?? []
  const baseAddr: string | null = washer?.base_address ?? null
  const mode: 'base' | 'previous' = washer?.travel_fee_mode ?? 'base'

  if (tiers.length === 0 || !baseAddr) return 0

  const origin = await resolveOrigin(supabase, washerId, mode, baseAddr, scheduledAt)
  if (!origin) return 0

  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destinationAddress)}&mode=driving&key=${apiKey}`
    const gmData = await (await fetch(url)).json()
    const durationSec = gmData?.rows?.[0]?.elements?.[0]?.duration?.value

    if (typeof durationSec !== 'number') return 0

    const durationMin = durationSec / 60
    return pickTravelFee(tiers, durationMin)
  } catch {
    return 0
  }
}
