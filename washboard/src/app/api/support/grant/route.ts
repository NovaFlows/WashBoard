import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import {
  SUPPORT_ACCESS_DURATION_MS,
  isSupportAccessActive,
  supportAccessMinutesLeft,
} from '@/lib/supportAccess'

// Le laveur ouvre, consulte ou referme l'accès du support à son compte.
// Ces trois routes sont les seules à écrire ces autorisations : le support ne
// peut jamais s'en accorder une lui-même.

async function laveurConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { erreur: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const { data: washer, error } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (error || !washer) {
    return { erreur: NextResponse.json({ error: 'Profil introuvable' }, { status: 404 }) }
  }
  return { supabase, washerId: washer.id as string }
}

/** État de l'accès : ouvert ou non, temps restant, dernier passage du support. */
export async function GET() {
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur

  const { data, error } = await ctx.supabase!
    .from('support_access_grants')
    .select('expires_at, revoked_at, used_at')
    .eq('washer_id', ctx.washerId)
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // Répondre « fermé » sur un échec de lecture laisserait croire au laveur
    // que personne ne peut entrer, alors qu'un accès peut être ouvert.
    logger.error('support.grant.read_failed', { washerId: ctx.washerId }, error)
    return NextResponse.json({ error: 'Impossible de lire l’état de l’accès.' }, { status: 503 })
  }

  const now = new Date()
  return NextResponse.json({
    active: isSupportAccessActive(data, now),
    minutesLeft: supportAccessMinutesLeft(data, now),
    lastUsedAt: data?.used_at ?? null,
  })
}

/** Ouvre un accès d'une heure. */
export async function POST() {
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur

  const expiresAt = new Date(Date.now() + SUPPORT_ACCESS_DURATION_MS).toISOString()
  const { error } = await ctx.supabase!
    .from('support_access_grants')
    .insert({ washer_id: ctx.washerId, expires_at: expiresAt })

  if (error) {
    logger.error('support.grant.create_failed', { washerId: ctx.washerId }, error)
    return NextResponse.json({ error: 'Impossible d’ouvrir l’accès. Réessayez dans un instant.' }, { status: 503 })
  }

  logger.info('support.grant.created', { washerId: ctx.washerId, expiresAt })
  return NextResponse.json({ active: true, minutesLeft: 60 })
}

/** Referme immédiatement tous les accès ouverts. */
export async function DELETE() {
  const ctx = await laveurConnecte()
  if (ctx.erreur) return ctx.erreur

  const { error } = await ctx.supabase!
    .from('support_access_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('washer_id', ctx.washerId)
    .is('revoked_at', null)

  // Écrire la colonne ne suffisait pas : la session déjà ouverte du support
  // continuait de fonctionner, et le rafraîchissement automatique la
  // prolongeait indéfiniment. Le bouton « Fermer l'accès maintenant »
  // affichait donc une promesse fausse — signalé par un audit externe le
  // 2026-09-05.
  //
  // Portée « others » : toutes les autres sessions de ce compte sont
  // invalidées, celle du laveur qui vient de cliquer est conservée. On ne
  // peut pas distinguer la session du support de la sienne — elles portent le
  // même utilisateur — donc on coupe tout le reste, ce qui inclut ses autres
  // appareils. C'est le prix d'une promesse tenue.
  const { data: { session } } = await ctx.supabase!.auth.getSession()
  if (session?.access_token) {
    const admin = createAdminClient()
    const { error: coupureError } = await admin.auth.admin.signOut(session.access_token, 'others')
    if (coupureError) {
      // Le laveur doit savoir que la coupure a échoué : lui répondre « fermé »
      // alors que l'accès reste ouvert serait exactement le mensonge qu'on
      // corrige ici.
      logger.error('support.grant.signout_failed', { washerId: ctx.washerId }, coupureError)
      return NextResponse.json(
        { error: 'L’accès n’a pas pu être coupé. Réessayez, ou changez votre mot de passe.' },
        { status: 503 },
      )
    }
  }

  if (error) {
    // Le laveur doit savoir que sa demande a échoué : lui répondre « fermé »
    // alors que l'accès reste ouvert serait le pire des mensonges ici.
    logger.error('support.grant.revoke_failed', { washerId: ctx.washerId }, error)
    return NextResponse.json({ error: 'Impossible de fermer l’accès. Réessayez.' }, { status: 503 })
  }

  logger.info('support.grant.revoked', { washerId: ctx.washerId })
  return NextResponse.json({ active: false, minutesLeft: 0 })
}
