import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportMember } from '@/lib/supportAccess'
import { logger } from '@/lib/logger'
import type { DonneesLaveur, WasherFiche } from '@/lib/ficheLaveur'

// Lectures de l'espace équipe (fiches laveurs). Service-role : l'équipe voit
// tous les comptes, ce que la RLS refuse — d'où la garde `exigerEquipe` en
// tête de chaque page, AVANT toute lecture.

type Admin = ReturnType<typeof createAdminClient>

/** Session de l'équipe, sinon redirection — muette, comme la page Support :
 *  un laveur qui devinerait l'adresse ne doit pas savoir qu'elle existe. */
export async function exigerEquipe() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isSupportMember(user.id, process.env.SUPPORT_ADMIN_USER_IDS)) {
    logger.warn('equipe.page.denied', { userId: user.id })
    redirect('/dashboard')
  }
  // Fiche laveur du compte de l'équipe, pour la coque du tableau de bord
  // (lecture directe : voir le commentaire de la page Support).
  const { data: washer } = await supabase.from('washers').select('*').eq('user_id', user.id).maybeSingle()
  return { user, washer }
}

const COLONNES_WASHER = 'id, user_id, name, slug, phone, created_at, plan, grandfathered, subscription_status, trial_ends_at, subscription_ends_at, cancels_at, zone_config, base_address, logo_url, google_review_url, website_url, sms_sender, sms_sender_statut, pwa_installee_le, derniere_connexion_le, onboarding_complete_at, acquisition_source, profil_activite, facture_nom_legal, telephone_verifie_le, is_preview'

/** Lit toutes les pages d'une requête : PostgREST plafonne à 1 000 lignes,
 *  et les visites de tous les laveurs dépassent vite ce plafond. */
async function toutLire<T>(requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>, table: string): Promise<T[]> {
  const lignes: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await requete(de, de + 999)
    if (error) {
      // Une fiche incomplète affichée comme « 0 réservation » mentirait :
      // on remonte l'erreur pour que la page échoue franchement.
      logger.error('equipe.fiche.read_failed', { table }, error)
      throw error
    }
    lignes.push(...(data ?? []))
    if (!data || data.length < 1000) return lignes
  }
}

async function lireLiees(admin: Admin, ids: string[], depuis: string | null) {
  const [prestations, horaires, reservations, evenements, abonnements] = await Promise.all([
    toutLire<{ washer_id: string; name: string; price: number | null; en_veille: boolean | null }>((de, a) =>
      admin.from('services').select('washer_id, name, price, en_veille').in('washer_id', ids).order('created_at').range(de, a), 'services'),
    toutLire<{ washer_id: string; day_of_week: number }>((de, a) =>
      admin.from('availabilities').select('washer_id, day_of_week').in('washer_id', ids).range(de, a), 'availabilities'),
    toutLire<DonneesLaveur['reservations'][number] & { washer_id: string }>((de, a) =>
      admin.from('bookings').select('washer_id, status, created_at, scheduled_at, booked_price, saisie_par_laveur, review_sms_sent_at').in('washer_id', ids).range(de, a), 'bookings'),
    toutLire<DonneesLaveur['evenements'][number] & { washer_id: string }>((de, a) => {
      let q = admin.from('booking_funnel_events').select('washer_id, session_id, step, referrer_host, created_at').in('washer_id', ids)
      if (depuis) q = q.gte('created_at', depuis)
      return q.order('created_at').range(de, a)
    }, 'booking_funnel_events'),
    toutLire<{ washer_id: string }>((de, a) =>
      admin.from('push_subscriptions').select('washer_id').in('washer_id', ids).range(de, a), 'push_subscriptions'),
  ])
  return { prestations, horaires, reservations, evenements, abonnements }
}

function assembler(w: WasherFiche, liees: Awaited<ReturnType<typeof lireLiees>>, utilisateur: { email?: string | null; last_sign_in_at?: string | null } | undefined): DonneesLaveur {
  const de = <T extends { washer_id: string }>(l: T[]) => l.filter(x => x.washer_id === w.id)
  return {
    washer: w,
    email: utilisateur?.email ?? null,
    derniereConnexionAuth: utilisateur?.last_sign_in_at ?? null,
    prestations: de(liees.prestations),
    joursOuverts: de(liees.horaires).map(h => h.day_of_week),
    reservations: de(liees.reservations),
    evenements: de(liees.evenements),
    appareilsNotifies: de(liees.abonnements).length,
  }
}

/** Tout ce qu'il faut pour la fiche d'un laveur ; `null` s'il n'existe pas. */
export async function chargerFicheLaveur(washerId: string): Promise<DonneesLaveur | null> {
  const admin = createAdminClient()
  const { data: w, error } = await admin.from('washers').select(COLONNES_WASHER).eq('id', washerId).maybeSingle()
  if (error) {
    logger.error('equipe.fiche.washer_read_failed', { washerId }, error)
    throw error
  }
  if (!w) return null
  const washer = w as unknown as WasherFiche
  const [liees, utilisateur] = await Promise.all([
    lireLiees(admin, [washer.id], null),
    washer.user_id ? admin.auth.admin.getUserById(washer.user_id).then(r => r.data.user ?? undefined) : undefined,
  ])
  return assembler(washer, liees, utilisateur)
}

/** Tous les laveurs, pour la liste. Les visites ne sont lues que sur 30 jours :
 *  c'est tout ce que la liste affiche, et c'est de loin la table la plus lourde. */
export async function chargerTousLesLaveurs(): Promise<DonneesLaveur[]> {
  const admin = createAdminClient()
  const washers = await toutLire<WasherFiche>((de, a) =>
    admin.from('washers').select(COLONNES_WASHER).order('created_at', { ascending: false }).range(de, a) as unknown as PromiseLike<{ data: WasherFiche[] | null; error: unknown }>, 'washers')
  const reels = washers.filter(w => !w.is_preview)
  if (!reels.length) return []
  const depuis = new Date(Date.now() - 30 * 864e5).toISOString()

  const utilisateurs = new Map<string, { email?: string | null; last_sign_in_at?: string | null }>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      logger.error('equipe.liste.users_read_failed', {}, error)
      throw error
    }
    for (const u of data.users) utilisateurs.set(u.id, u)
    if (data.users.length < 200) break
  }

  const liees = await lireLiees(admin, reels.map(w => w.id), depuis)
  return reels.map(w => assembler(w, liees, w.user_id ? utilisateurs.get(w.user_id) : undefined))
}
