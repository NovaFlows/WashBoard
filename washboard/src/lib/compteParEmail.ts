import type { SupabaseClient, User } from '@supabase/supabase-js'

const PAR_PAGE = 200
const PAGES_MAX = 100

/** Compte d'authentification portant cet email (casse ignorée), ou `null`.
 *
 *  L'API d'administration ne sait pas chercher par email : on parcourt la
 *  liste. Acceptable à quelques dizaines de comptes et sur des routes plafonnées
 *  par IP ; à revoir si le volume change d'ordre de grandeur.
 *
 *  Lève si la lecture échoue ou si la liste dépasse ce qu'on sait parcourir :
 *  un échec pris pour « aucun compte » donnerait une réponse fausse sans que
 *  rien ne le signale. */
export async function trouverCompteParEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const cible = email.trim().toLowerCase()
  for (let page = 1; page <= PAGES_MAX; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAR_PAGE })
    if (error) throw error
    const trouve = data.users.find(u => u.email?.toLowerCase() === cible)
    if (trouve) return trouve
    if (data.users.length < PAR_PAGE) return null
  }
  throw new Error(`Plus de ${PAR_PAGE * PAGES_MAX} comptes : recherche par email interrompue`)
}
