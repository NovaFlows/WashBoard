import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { errorResponse } from '@/lib/apiError'
import { logger } from '@/lib/logger'

// Réglages écrits à la main sur un client — table `clients`, SQL donné dans la conversation du
// 2026-09-28 (proposition de Yanis : « ne plus contacter », discutée avec Alexandre).
//
// La ligne naît au premier écrit (upsert sur `washer_id, cle`) : pas de ligne pour un client
// qu'on n'a jamais touché, son absence vaut « rien de particulier » — même principe que les
// documents (voir `lib/clientProfile.ts`).
//
// Client RLS-scopé, pas le client admin : rien ici n'a besoin de sortir du garde-fou
// « ce laveur ne touche que ses propres lignes », contrairement à la numérotation des
// documents (verrou en base, hors de portée du navigateur).
//
// Rattacher à une entreprise (2026-09-28, fiche entreprise) est le seul cas qui écrit une
// colonne pointant vers UNE AUTRE table (`entreprise_id` → `entreprises`) : la RLS de `clients`
// vérifie que la LIGNE appartient à ce laveur, jamais que l'entreprise visée lui appartient
// aussi — sans la vérification ci-dessous, PATCH accepterait n'importe quel identifiant
// d'entreprise, y compris celui d'un autre laveur.

/** `cle` vient de `cleClient` : un email en minuscules, ou `tel:` + des chiffres. Rejeter le
 *  reste évite d'écrire une ligne pour une clé qui ne correspondra jamais à aucun client. */
function cleValide(cle: string): boolean {
  return /^[^\s]+@[^\s]+\.[^\s]+$/.test(cle) || /^tel:\d{6,}$/.test(cle)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ cle: string }> }) {
  const { cle: cleBrute } = await params
  const cle = decodeURIComponent(cleBrute)
  if (!cleValide(cle)) return NextResponse.json({ error: 'Client introuvable' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: washer, error: errWasher } = await supabase
    .from('washers').select('id').eq('user_id', user.id).single()
  if (errWasher || !washer) {
    logger.error('clients.patch.washer_read_failed', {}, errWasher)
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  const corps = await req.json().catch(() => ({})) as {
    nePlusContacter?: unknown
    entrepriseId?: unknown
    role?: unknown
  }

  // Rattacher (ou détacher, `entrepriseId: null`) : géré séparément du reste, la ligne peut ne
  // porter QUE ce champ (un contact sans avis sur les messages automatiques).
  if ('entrepriseId' in corps) {
    if (corps.entrepriseId !== null && typeof corps.entrepriseId !== 'string') {
      return NextResponse.json({ error: 'Entreprise invalide' }, { status: 400 })
    }
    const role = typeof corps.role === 'string' ? corps.role.trim().slice(0, 200) || null : null

    if (corps.entrepriseId !== null) {
      // Voir l'en-tête du fichier : sans cette vérification, n'importe quel identifiant
      // d'entreprise — y compris celui d'un autre laveur — serait accepté.
      const { data: entreprise, error: errEntreprise } = await supabase
        .from('entreprises').select('id').eq('id', corps.entrepriseId).eq('washer_id', washer.id).maybeSingle()
      if (errEntreprise) {
        logger.error('clients.patch.entreprise_read_failed', { washerId: washer.id }, errEntreprise)
        return NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 503 })
      }
      if (!entreprise) return NextResponse.json({ error: 'Entreprise introuvable' }, { status: 404 })
    }

    const { error } = await supabase
      .from('clients')
      .upsert(
        { washer_id: washer.id, cle, entreprise_id: corps.entrepriseId, role_entreprise: role, maj_le: new Date().toISOString() },
        { onConflict: 'washer_id,cle' },
      )
    if (error) return errorResponse('clients.patch.entreprise.db', error)
    logger.info('clients.rattachement', { washerId: washer.id, entrepriseId: corps.entrepriseId })
    return NextResponse.json({ cle, entrepriseId: corps.entrepriseId, role })
  }

  if (typeof corps.nePlusContacter !== 'boolean') {
    return NextResponse.json({ error: 'nePlusContacter doit être vrai ou faux' }, { status: 400 })
  }

  const { error } = await supabase
    .from('clients')
    .upsert(
      { washer_id: washer.id, cle, ne_plus_contacter: corps.nePlusContacter, maj_le: new Date().toISOString() },
      { onConflict: 'washer_id,cle' },
    )
  if (error) return errorResponse('clients.patch.db', error)

  logger.info('clients.reglage', { washerId: washer.id, nePlusContacter: corps.nePlusContacter })
  return NextResponse.json({ cle, nePlusContacter: corps.nePlusContacter })
}
