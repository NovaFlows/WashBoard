// Parrainage : lectures et écritures en base (client admin). Les règles sont dans lib/parrainage.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { notifierEquipe, notifierLaveur } from '@/lib/push'
import { finEssaiInscription } from '@/lib/plan'
import { sendParrainageRecompense } from '@/lib/email'
import { genererCode, phraseRecompense, recompenseParrain, statutFilleul, type CompteParrainage, type FormeRecompense, type StatutFilleul } from '@/lib/parrainage'

type Admin = SupabaseClient

/** Code du laveur, créé à la première demande (les comptes existants n'en ont pas encore). */
export async function codeDuLaveur(admin: Admin, laveur: { id: string; name: string; code_parrainage?: string | null }): Promise<string | null> {
  if (laveur.code_parrainage) return laveur.code_parrainage
  for (let essai = 0; essai < 5; essai++) {
    const code = genererCode(laveur.name)
    const { data, error } = await admin
      .from('washers')
      .update({ code_parrainage: code })
      .eq('id', laveur.id)
      .is('code_parrainage', null)
      .select('code_parrainage')
      .maybeSingle()
    if (!error && data?.code_parrainage) return data.code_parrainage as string
    if (error && error.code !== '23505') {
      logger.error('parrainage.code.ecriture', { washerId: laveur.id }, error)
      return null
    }
    if (!error) {
      // Aucune ligne modifiée : un autre appel a posé le code entre-temps.
      const { data: relu } = await admin.from('washers').select('code_parrainage').eq('id', laveur.id).maybeSingle()
      if (relu?.code_parrainage) return relu.code_parrainage as string
    }
  }
  logger.error('parrainage.code.collisions', { washerId: laveur.id })
  return null
}

export type Parrain = { id: string; name: string }

/** Parrain correspondant à un code déjà normalisé ; `null` si aucun compte actif ne le porte. */
export async function trouverParrain(admin: Admin, code: string): Promise<Parrain | null | 'erreur'> {
  const { data, error } = await admin
    .from('washers')
    .select('id, name, account_status')
    .eq('code_parrainage', code)
    .maybeSingle()
  if (error) {
    logger.error('parrainage.code.lecture', {}, error)
    return 'erreur'
  }
  if (!data || (data.account_status && data.account_status !== 'active')) return null
  return { id: data.id as string, name: data.name as string }
}

/** Enregistre le lien parrain → filleul juste après l'inscription. Le filleul a déjà reçu son
 *  essai de 28 jours : si l'enregistrement échoue, l'essai revient à la durée normale, pour
 *  qu'aucun bonus n'existe sans parrainage. */
export async function rattacherFilleul(
  admin: Admin,
  args: { filleulId: string; parrainId: string; code: string; ip: string | null },
): Promise<boolean> {
  const { error } = await admin.from('parrainages').insert({
    parrain_id: args.parrainId,
    filleul_id: args.filleulId,
    code_utilise: args.code,
    ip_inscription: args.ip,
  })
  if (!error) return true
  logger.error('parrainage.rattachement', { filleulId: args.filleulId, parrainId: args.parrainId }, error)
  const { error: retour } = await admin
    .from('washers')
    .update({ trial_ends_at: finEssaiInscription() })
    .eq('id', args.filleulId)
  if (retour) logger.error('parrainage.rattachement.retour_essai', { filleulId: args.filleulId }, retour)
  return false
}

/** Prévient le parrain (et l'équipe) qu'un filleul a confirmé son inscription avec son code. */
export async function annoncerInscriptionFilleul(admin: Admin, filleul: { id: string; name: string }): Promise<string | null> {
  const { data, error } = await admin
    .from('parrainages')
    .select('parrain_id, washers!parrainages_parrain_id_fkey(name)')
    .eq('filleul_id', filleul.id)
    .maybeSingle()
  if (error) {
    logger.error('parrainage.annonce.lecture', { filleulId: filleul.id }, error)
    return null
  }
  if (!data) return null
  const parrainNom = (data.washers as unknown as { name?: string } | null)?.name ?? null
  await notifierLaveur(data.parrain_id as string, {
    title: 'Nouveau filleul',
    body: `${filleul.name} s’est inscrit avec ton code. Ton mois offert arrive dès qu’il s’abonne.`,
    url: '/dashboard/parrainage',
    tag: `parrainage-inscrit-${filleul.id}`,
  })
  return parrainNom
}

export type ResultatRecompense =
  | { statut: 'sans_parrain' | 'deja_recompense' }
  | { statut: 'echec' }
  | { statut: 'recompense'; parrainId: string; parrainNom: string; forme: FormeRecompense }

const COLONNES_PARRAIN = 'id, name, user_id, account_status, plan, grandfathered, subscription_status, trial_ends_at, subscription_ends_at, pro_offert_jusqu_au'

/** Donne au parrain son mois quand le filleul devient abonné. Une seule fois par filleul :
 *  la ligne de parrainage est verrouillée (`recompense_le`) avant d'écrire quoi que ce soit,
 *  et déverrouillée si l'écriture chez le parrain échoue, pour être rattrapée plus tard. */
export async function recompenserParrain(
  admin: Admin,
  filleul: { id: string; name: string },
  origine: 'equipe' | 'rattrapage' | 'stripe',
  now: Date = new Date(),
): Promise<ResultatRecompense> {
  const { data: verrou, error: errVerrou } = await admin
    .from('parrainages')
    .update({ recompense_le: now.toISOString(), filleul_abonne_le: now.toISOString() })
    .eq('filleul_id', filleul.id)
    .is('recompense_le', null)
    .select('id, parrain_id')
    .maybeSingle()
  if (errVerrou) {
    logger.error('parrainage.recompense.verrou', { filleulId: filleul.id }, errVerrou)
    return { statut: 'echec' }
  }
  if (!verrou) {
    const { data: existe } = await admin.from('parrainages').select('id').eq('filleul_id', filleul.id).maybeSingle()
    return { statut: existe ? 'deja_recompense' : 'sans_parrain' }
  }

  const deverrouiller = async () => {
    const { error } = await admin.from('parrainages').update({ recompense_le: null, filleul_abonne_le: null }).eq('id', verrou.id)
    if (error) logger.error('parrainage.recompense.deverrou', { parrainageId: verrou.id }, error)
  }

  const { data: parrain, error: errParrain } = await admin
    .from('washers').select(COLONNES_PARRAIN).eq('id', verrou.parrain_id).maybeSingle()
  if (errParrain) {
    logger.error('parrainage.recompense.parrain_lecture', { parrainageId: verrou.id }, errParrain)
    await deverrouiller()
    return { statut: 'echec' }
  }

  const compte = (parrain ?? null) as (CompteParrainage & { id: string; name: string; user_id?: string | null; account_status?: string | null }) | null
  const actif = !!compte && (!compte.account_status || compte.account_status === 'active')
  const recompense = actif ? recompenseParrain(compte!, now) : { forme: 'aucune' as const, colonnes: {} }

  if (Object.keys(recompense.colonnes).length > 0) {
    const { error } = await admin.from('washers').update(recompense.colonnes).eq('id', compte!.id)
    if (error) {
      logger.error('parrainage.recompense.ecriture', { parrainageId: verrou.id, parrainId: compte!.id }, error)
      await deverrouiller()
      return { statut: 'echec' }
    }
  }

  const { error: errTrace } = await admin.from('parrainages').update({
    recompense_forme: recompense.forme,
    recompense_detail: { origine, ...recompense.colonnes },
  }).eq('id', verrou.id)
  if (errTrace) logger.error('parrainage.recompense.trace', { parrainageId: verrou.id }, errTrace)

  const parrainNom = compte?.name ?? 'Parrain supprimé'
  logger.info('parrainage.recompense', { parrainageId: verrou.id, forme: recompense.forme, origine })

  if (actif && recompense.forme !== 'aucune') {
    await notifierLaveur(compte!.id, {
      title: 'Ton mois est offert',
      body: `${filleul.name} est devenu client grâce à toi. Ton mois offert est appliqué.`,
      url: '/dashboard/parrainage',
      tag: `parrainage-recompense-${filleul.id}`,
    })
    await envoyerEmailRecompense(admin, compte!, filleul.name, phraseRecompense(recompense))
  }
  await notifierEquipe({
    title: 'Parrainage récompensé',
    body: [
      `Filleul : ${filleul.name}`,
      `Parrain : ${parrainNom}`,
      LIBELLE_FORME[recompense.forme],
    ].join('\n'),
    url: '/dashboard/support/parrainages',
    tag: `parrainage-${verrou.id}`,
  })

  return { statut: 'recompense', parrainId: verrou.parrain_id as string, parrainNom, forme: recompense.forme }
}

export const LIBELLE_FORME: Record<FormeRecompense, string> = {
  abonnement: 'Prochain paiement repoussé d’un mois',
  abonnement_a_la_main: 'Abonné sans date de fin : prochain paiement à reporter à la main',
  essai: 'Essai prolongé d’un mois',
  pro_offert: 'Un mois de Pro offert',
  aucune: 'Rien d’automatique (client historique ou compte fermé)',
}

export type FilleulVu = { nom: string; statut: StatutFilleul; inscritLe: string; recompenseLe: string | null }

/** Ce que le parrain voit de ses filleuls : nom commercial et statut, rien d'autre. */
export async function filleulsDuParrain(admin: Admin, parrainId: string, now: Date = new Date()): Promise<FilleulVu[] | null> {
  const { data, error } = await admin
    .from('parrainages')
    .select('cree_le, recompense_le, recompense_forme, washers!parrainages_filleul_id_fkey(name, subscription_status, trial_ends_at)')
    .eq('parrain_id', parrainId)
    .order('cree_le', { ascending: false })
  if (error) {
    logger.error('parrainage.filleuls.lecture', { parrainId }, error)
    return null
  }
  return (data ?? []).map(l => {
    const f = (l.washers as unknown as { name: string; subscription_status: string | null; trial_ends_at: string | null } | null)
    return {
      nom: f?.name ?? 'Compte supprimé',
      statut: f ? statutFilleul(f, now) : 'essai_termine',
      inscritLe: l.cree_le as string,
      recompenseLe: l.recompense_forme && l.recompense_forme !== 'aucune' ? (l.recompense_le as string | null) : null,
    }
  })
}

async function envoyerEmailRecompense(admin: Admin, parrain: { id: string; name: string; user_id?: string | null }, filleulNom: string, phrase: string) {
  if (!parrain.user_id) return
  try {
    const { data, error } = await admin.auth.admin.getUserById(parrain.user_id)
    const email = data?.user?.email
    if (error || !email) {
      logger.warn('parrainage.email.adresse', { parrainId: parrain.id }, error ?? 'sans email')
      return
    }
    await sendParrainageRecompense({ to: email, washerName: parrain.name, filleulName: filleulNom, phrase })
  } catch (e) {
    logger.error('parrainage.email.envoi', { parrainId: parrain.id }, e)
  }
}

/** Rattrapage quotidien (api/cron/send-trial-reminders) : filleuls abonnés dont le parrain
 *  n'a pas encore reçu son mois. */
export async function rattraperRecompenses(admin: Admin): Promise<{ recompenses: number; echecs: number } | { erreur: true }> {
  const { data, error } = await admin
    .from('parrainages')
    .select('filleul_id, filleul:washers!parrainages_filleul_id_fkey!inner(name, subscription_status)')
    .is('recompense_le', null)
    .in('filleul.subscription_status', ['active', 'past_due'])
    .limit(50)
  if (error) {
    logger.error('parrainage.rattrapage.lecture', {}, error)
    return { erreur: true }
  }
  let recompenses = 0, echecs = 0
  for (const l of data ?? []) {
    const nom = (l.filleul as unknown as { name?: string } | null)?.name ?? 'Filleul'
    const r = await recompenserParrain(admin, { id: l.filleul_id as string, name: nom }, 'rattrapage')
    if (r.statut === 'recompense') recompenses++
    else if (r.statut === 'echec') echecs++
  }
  if (recompenses || echecs) logger.info('parrainage.rattrapage', { recompenses, echecs })
  return { recompenses, echecs }
}
