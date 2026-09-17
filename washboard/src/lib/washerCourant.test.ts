import { describe, it, expect, vi, beforeEach } from 'vitest'

// `redirect` de Next interrompt le rendu en levant : on reproduit ce contrat,
// sinon le test croirait que la fonction continue après une redirection.
const REDIRECTION = 'NEXT_REDIRECT'
const redirect = vi.fn((cible: string) => {
  throw Object.assign(new Error(REDIRECTION), { cible })
})
vi.mock('next/navigation', () => ({ redirect: (cible: string) => redirect(cible) }))

const logError = vi.fn()
vi.mock('./logger', () => ({ logger: { error: (...a: unknown[]) => logError(...a) } }))

import { washerDuUtilisateur } from './washerCourant'

/** Client Supabase réduit à ce que la fonction en utilise, en retenant les
 *  colonnes demandées pour pouvoir les vérifier. */
function clientQuiRepond(reponse: { data: unknown; error: unknown }) {
  const vu = { colonnes: '', table: '', userId: '' }
  const client = {
    from(table: string) {
      vu.table = table
      return {
        select(colonnes: string) {
          vu.colonnes = colonnes
          return {
            eq(_champ: string, valeur: string) {
              vu.userId = valeur
              return { single: async () => reponse }
            },
          }
        },
      }
    },
  }
  // Le client réel porte des dizaines de méthodes dont rien ici ne se sert.
  return { client: client as never, vu }
}

beforeEach(() => {
  redirect.mockClear()
  logError.mockClear()
})

describe('washerDuUtilisateur', () => {
  it('renvoie la fiche du laveur quand la lecture aboutit', async () => {
    const fiche = { id: 'w1', name: 'Kooki Clean' }
    const { client, vu } = clientQuiRepond({ data: fiche, error: null })

    expect(await washerDuUtilisateur(client, 'u1', 'calendrier')).toEqual(fiche)
    expect(vu.table).toBe('washers')
    expect(vu.userId).toBe('u1')
  })

  it('lit toutes les colonnes par défaut, et seulement celles demandées sinon', async () => {
    const { client, vu } = clientQuiRepond({ data: { id: 'w1' }, error: null })
    await washerDuUtilisateur(client, 'u1', 'compta')
    expect(vu.colonnes).toBe('*')

    const restreint = clientQuiRepond({ data: { id: 'w1' }, error: null })
    await washerDuUtilisateur(restreint.client, 'u1', 'compta', 'id, plan')
    expect(restreint.vu.colonnes).toBe('id, plan')
  })

  it('déconnecte quand la fiche a réellement disparu', async () => {
    // PGRST116 = « aucune ligne » : session encore valide, fiche supprimée.
    const { client } = clientQuiRepond({ data: null, error: { code: 'PGRST116' } })

    await expect(washerDuUtilisateur(client, 'u1', 'clients')).rejects.toThrow(REDIRECTION)
    expect(redirect).toHaveBeenCalledWith('/api/auth/logout')
    // Ce n'est pas une panne : rien ne doit partir dans les journaux d'erreur.
    expect(logError).not.toHaveBeenCalled()
  })

  it('déconnecte aussi si la lecture ne rend ni fiche ni erreur', async () => {
    const { client } = clientQuiRepond({ data: null, error: null })
    await expect(washerDuUtilisateur(client, 'u1', 'crm')).rejects.toThrow(REDIRECTION)
    expect(redirect).toHaveBeenCalledWith('/api/auth/logout')
  })

  it('un raté de lecture lève et se trace, sans jamais déconnecter', async () => {
    // Le cœur de ce fichier : avant lui, un simple raté réseau au réveil de
    // l'application installée fermait la session du laveur pour de bon.
    const panne = { code: '57014', message: 'canceling statement due to timeout' }
    const { client } = clientQuiRepond({ data: null, error: panne })

    await expect(washerDuUtilisateur(client, 'u1', 'parametres'))
      .rejects.toThrow('Lecture du profil laveur impossible')

    expect(redirect).not.toHaveBeenCalled()
    expect(logError).toHaveBeenCalledWith(
      'dashboard.washer.read_failed',
      { page: 'parametres', userId: 'u1' },
      panne,
    )
  })
})
