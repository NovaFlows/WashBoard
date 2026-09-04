import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { isSupportAccessActive, isSupportMember } from '@/lib/supportAccess'

// Ouvre une session sur le compte d'un laveur, pour l'aider à le configurer.
//
// C'est la route la plus sensible du produit : elle donne accès aux données
// d'un client. Trois verrous, dans cet ordre, et chacun refuse par défaut :
//
//   1. le demandeur est connecté ;
//   2. son adresse figure dans SUPPORT_ADMIN_EMAILS ;
//   3. le laveur a ouvert un accès, non expiré et non annulé.
//
// Le passage est ensuite horodaté dans la même ligne : le laveur voit dans ses
// réglages que quelqu'un est entré, et quand.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)) {
    // Volontairement identique à un refus d'authentification : inutile de
    // révéler à un curieux que cette route existe et ce qu'elle fait.
    logger.warn('support.access.denied', { userId: user.id })
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { slug } = await request.json()
  if (!slug?.trim()) {
    return NextResponse.json({ error: 'Lien du laveur manquant' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: washer, error: washerError } = await admin
    .from('washers')
    .select('id, name, user_id')
    .eq('slug', String(slug).trim().toLowerCase())
    .maybeSingle()

  if (washerError) {
    logger.error('support.access.washer_lookup_failed', {}, washerError)
    return NextResponse.json({ error: 'Recherche impossible. Réessayez.' }, { status: 503 })
  }
  if (!washer) return NextResponse.json({ error: 'Aucun laveur avec ce lien' }, { status: 404 })

  const { data: grant, error: grantError } = await admin
    .from('support_access_grants')
    .select('id, expires_at, revoked_at')
    .eq('washer_id', washer.id)
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (grantError) {
    // Un échec de lecture ne doit jamais valoir autorisation : sans certitude
    // que le laveur a ouvert l'accès, on n'entre pas.
    logger.error('support.access.grant_read_failed', { washerId: washer.id }, grantError)
    return NextResponse.json({ error: 'Vérification impossible. Réessayez.' }, { status: 503 })
  }

  if (!isSupportAccessActive(grant, new Date())) {
    return NextResponse.json({
      error: `${washer.name} n’a pas ouvert d’accès, ou il a expiré. Demandez-lui de l’autoriser depuis ses réglages.`,
    }, { status: 403 })
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(washer.user_id)
  if (authError || !authUser?.user?.email) {
    logger.error('support.access.user_lookup_failed', { washerId: washer.id }, authError)
    return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: authUser.user.email,
  })

  if (linkError || !link?.properties?.action_link) {
    logger.error('support.access.link_failed', { washerId: washer.id }, linkError)
    return NextResponse.json({ error: 'Génération du lien impossible' }, { status: 503 })
  }

  // Traçage APRÈS succès : un lien qui n'a pas pu être généré n'est pas un
  // accès, et ne doit pas apparaître comme tel dans l'historique du laveur.
  const { error: traceError } = await admin
    .from('support_access_grants')
    .update({ used_at: new Date().toISOString(), used_by: user.email ?? null })
    .eq('id', grant!.id)

  if (traceError) {
    // On continue — le lien est valide — mais un accès non tracé est un trou
    // dans la promesse faite au laveur : il doit se voir dans les journaux.
    logger.error('support.access.trace_failed', { washerId: washer.id, grantId: grant!.id }, traceError)
  }

  logger.info('support.access.granted', {
    washerId: washer.id, washerName: washer.name, supportEmail: user.email,
  })

  return NextResponse.json({ url: link.properties.action_link, washerName: washer.name })
}
