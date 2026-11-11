import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTrustedOrigin } from '@/lib/appOrigin'
import { rateLimit } from '@/lib/rateLimit'
import { formationOuverte } from '@/lib/formationAcces'
import { CATALOGUE_DEMO, leconDuCatalogue } from '@/lib/formation'
import { POLITIQUE_PROTECTION, signerJetonLecture, texteFiligrane } from '@/lib/formationProtection'

// Autorise la lecture d'UNE leçon (branche feat/formation, 2026-11-10). Le lecteur appelle cette
// route à l'ouverture d'une leçon puis toutes les `renouvellementSec` secondes : il reçoit un
// jeton court, lié à ce laveur et à cette leçon, et le texte du filigrane à afficher dessus.
//
// COQUILLE : il n'y a pas encore de fournisseur vidéo, donc `source` reste `null` et le lecteur
// montre une vidéo de démonstration. Quand il y en aura un (voir docs/FORMATION.md), c'est ICI
// qu'on lui demande une URL signée de quelques minutes, jamais dans le navigateur. Les achats ne
// sont pas encore branchés non plus : tout laveur autorisé voit tout, sauf `apercuGratuit` qui
// n'a pas encore de sens à distinguer.

export async function POST(req: NextRequest) {
  if (!isTrustedOrigin(req.headers.get('origin')) || !req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Requête refusée' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  // 404 et non 403 : tant que l'onglet est fermé, la route n'existe pas pour ce compte.
  if (!formationOuverte(user.id)) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const secret = process.env.FORMATION_SECRET
  if (!secret || secret.length < 24) {
    return NextResponse.json({ error: 'Service momentanément indisponible.' }, { status: 503 })
  }

  // Un lecteur normal redemande un jeton toutes les 90 s : 60 par heure laissent la marge d'un
  // rechargement ou deux, pas celle d'un script qui aspire le catalogue.
  const limite = rateLimit(`formation-lecture:${user.id}`, 60, 60 * 60 * 1000)
  if (!limite.ok) return NextResponse.json({ error: 'Trop de demandes.', retryAfter: limite.retryAfter }, { status: 429 })

  const corps = await req.json().catch(() => null) as { leconId?: unknown } | null
  if (typeof corps?.leconId !== 'string') return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 })

  const trouvee = leconDuCatalogue(CATALOGUE_DEMO, corps.leconId)
  if (!trouvee) return NextResponse.json({ error: 'Leçon introuvable.' }, { status: 404 })

  const maintenant = new Date()
  const jeton = signerJetonLecture({ userId: user.id, leconId: trouvee.lecon.id, secret, maintenant })
  return NextResponse.json({
    jeton,
    expireDans: POLITIQUE_PROTECTION.dureeJetonSec,
    renouvellement: POLITIQUE_PROTECTION.renouvellementSec,
    filigrane: texteFiligrane({ email: user.email ?? 'laveur', userId: user.id, maintenant }),
    source: null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
