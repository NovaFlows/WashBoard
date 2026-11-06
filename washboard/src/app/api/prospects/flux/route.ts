import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { tableAbsente } from '@/lib/suiviAppels'
import { appliquerEvenement, validerEvenement, type Evenement, type Prospect } from '@/lib/prospects'
import { COLONNES_PROSPECT } from '@/lib/prospectsDonnees'

// Entrée des agents dans la zone Prospects (2026-11-06) :
//   - l'agent prospection : « contacte » après chaque message Instagram envoyé,
//     « reponse » quand il voit qu'un prospect a répondu ;
//   - l'agent suivi client : « ajout » d'un prospect qu'Alexandre a eu au téléphone.
//
// Authentification : « Authorization: Bearer <PROSPECTION_JETON> ». Ce jeton ne sait
// QUE ajouter ou compléter des prospects — ni lire, ni supprimer, ni toucher aux
// laveurs. C'est volontaire : la clé service_role n'est jamais confiée à une tâche
// qui tourne sans surveillance.
//
// Corps : un événement, ou { evenements: [...] } (100 au plus, pour rattraper un retard).

const MAX_PAR_ENVOI = 100

function autorise(request: Request): boolean {
  const jeton = process.env.PROSPECTION_JETON
  if (!jeton || jeton.length < 32) return false
  const recu = Buffer.from(request.headers.get('authorization') ?? '')
  const attendu = Buffer.from(`Bearer ${jeton}`)
  return recu.length === attendu.length && timingSafeEqual(recu, attendu)
}

type Admin = ReturnType<typeof createAdminClient>

async function traiter(admin: Admin, ev: Evenement): Promise<{ ok: true; effet: string } | { ok: false; erreur: string; table?: true }> {
  let existant: Prospect | null = null
  if (ev.instagram) {
    const { data, error } = await admin.from('prospects').select(COLONNES_PROSPECT).eq('instagram', ev.instagram).maybeSingle()
    if (error) return tableAbsente(error) ? { ok: false, erreur: 'table absente', table: true } : { ok: false, erreur: 'lecture impossible' }
    existant = data as Prospect | null
  }
  const effet = appliquerEvenement(existant, ev)
  if ('rien' in effet) return { ok: true, effet: effet.rien }
  const { error } = 'creer' in effet
    ? await admin.from('prospects').insert(effet.creer)
    : await admin.from('prospects').update({ ...effet.modifier, updated_at: new Date().toISOString() }).eq('id', existant!.id)
  if (error) {
    if (tableAbsente(error)) return { ok: false, erreur: 'table absente', table: true }
    // Deux passages simultanés sur le même compte : le second retombe sur le premier.
    if ((error as { code?: string }).code === '23505') return { ok: true, effet: 'déjà créé' }
    logger.error('prospects.flux.write_failed', { type: ev.type }, error)
    return { ok: false, erreur: 'écriture impossible' }
  }
  return { ok: true, effet: 'creer' in effet ? 'créé' : 'mis à jour' }
}

export async function POST(request: Request) {
  if (!autorise(request)) {
    logger.warn('prospects.flux.denied', {})
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const corps = await request.json().catch(() => null)
  const bruts: unknown[] = Array.isArray(corps?.evenements) ? corps.evenements : corps ? [corps] : []
  if (bruts.length === 0) return NextResponse.json({ error: 'Aucun événement' }, { status: 400 })
  if (bruts.length > MAX_PAR_ENVOI) return NextResponse.json({ error: `${MAX_PAR_ENVOI} événements au plus par envoi` }, { status: 400 })

  const admin = createAdminClient()
  const now = new Date()
  const resultats = []
  for (const brut of bruts) {
    const v = validerEvenement(brut, now)
    if ('erreur' in v) { resultats.push({ ok: false, erreur: v.erreur }); continue }
    const r = await traiter(admin, v.evenement)
    if (!r.ok && r.table) return NextResponse.json({ error: 'La zone Prospects n’est pas encore activée en base.' }, { status: 503 })
    resultats.push(r.ok ? { ok: true, instagram: v.evenement.instagram, effet: r.effet } : { ok: false, instagram: v.evenement.instagram, erreur: r.erreur })
  }
  logger.info('prospects.flux', { recus: bruts.length, refuses: resultats.filter(r => !r.ok).length })
  return NextResponse.json({ resultats })
}
