import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupportMember } from '@/lib/supportAccess'

// Dit à l'interface si le compte connecté fait partie de l'équipe support,
// pour afficher (ou non) l'entrée de menu interne « Support » — voir
// `useEstEquipeSupport`. Ordre identique à `support/access/route.ts` :
// authentification d'abord, appartenance ensuite.
//
// Appelée sur chaque page du dashboard : aucun accès base au-delà de la
// session déjà résolue par `createClient`, la liste des adresses vit dans une
// variable d'environnement (voir `isSupportMember`).
//
// `membre: false` avec un 200 pour un laveur connecté qui n'est pas de
// l'équipe : ce n'est pas une erreur, c'est la réponse normale à « ai-je le
// droit ? ». Seul un visiteur non connecté reçoit un 401. La réponse ne
// révèle jamais rien d'autre (ni la liste des adresses, ni leur nombre).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const membre = isSupportMember(user.email, process.env.SUPPORT_ADMIN_EMAILS)
  // `compte` et `listeConfiguree` : diagnostic TEMPORAIRE (2026-09-26), affiché par
  // `DiagnosticPwa` au bas de « Plus » — quand l'accès équipe n'apparaît pas, dit si c'est
  // l'adresse du compte ou la variable du déploiement. Rien de sensible : l'adresse est celle
  // de la personne qui demande, et la liste elle-même n'est jamais révélée.
  return NextResponse.json({ membre, compte: user.email ?? null, listeConfiguree: !!process.env.SUPPORT_ADMIN_EMAILS })
}
