import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Résout le laveur connecté, pour cloisonner les routes qui manipulent SES
// données par identifiant.
//
// Pourquoi ce helper existe : six routes `[id]` faisaient `.eq('id', id)` sans
// filtrer sur le laveur. Leur isolation reposait donc entièrement sur des
// policies RLS Supabase — dont cinq tables sur onze n'ont aucune trace dans le
// dépôt, et sont donc invérifiables par quiconque relit le code. Un audit
// externe l'a relevé le 2026-09-05.
//
// Le filtre applicatif ne remplace pas la RLS : il la double. Si une policy est
// modifiée, supprimée ou mal écrite un jour, l'isolation tient encore. C'est le
// motif que `bookings/[id]` appliquait déjà seul, et qu'on généralise ici.

export type WasherContext = {
  supabase: SupabaseClient
  washerId: string
}

/** Renvoie le laveur connecté, ou la réponse d'erreur à retourner tel quel. */
export async function requireWasher(): Promise<
  { ok: true; ctx: WasherContext } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }
  }

  const { data: washer, error } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()

  if (error || !washer) {
    // Un échec de lecture ne doit pas laisser passer : sans certitude sur
    // l'identité du laveur, on ne touche à aucune ligne.
    return { ok: false, response: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }
  }

  return { ok: true, ctx: { supabase, washerId: washer.id as string } }
}
