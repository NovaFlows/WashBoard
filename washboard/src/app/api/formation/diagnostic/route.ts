import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formationOuverte } from '@/lib/formationAcces'

// TEMPORAIRE (feat/formation) : dit si le déploiement lit les variables Formation.
// Ne renvoie aucune valeur secrète, seulement des booléens et des longueurs.
export async function GET() {
  const { data: { user } } = await (await createClient()).auth.getUser()
  const liste = (process.env.FORMATION_USER_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return NextResponse.json({
    connecte: !!user,
    idsDefinis: liste.length,
    premierIdLongueur: liste[0]?.length ?? 0,
    monIdDansLaListe: !!user && liste.includes(user.id),
    secretLongueur: (process.env.FORMATION_SECRET ?? '').length,
    ouverte: formationOuverte(user?.id),
    env: process.env.VERCEL_ENV ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
