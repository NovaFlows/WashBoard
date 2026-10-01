import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { trouverCompteParEmail } from './compteParEmail'

function adminAvec(pages: ({ users: { id: string; email?: string }[] } | { erreur: unknown })[]) {
  const listUsers = vi.fn(async ({ page }: { page: number }) => {
    const p = pages[page - 1] ?? { users: [] }
    return 'erreur' in p ? { data: { users: [] }, error: p.erreur } : { data: { users: p.users }, error: null }
  })
  return { admin: { auth: { admin: { listUsers } } } as unknown as SupabaseClient, listUsers }
}

const pagePleine = (prefixe: string) =>
  Array.from({ length: 200 }, (_, i) => ({ id: `${prefixe}-${i}`, email: `${prefixe}${i}@exemple.fr` }))

describe('trouverCompteParEmail', () => {
  it('trouve le compte sans tenir compte de la casse ni des espaces', async () => {
    const { admin } = adminAvec([{ users: [{ id: 'u-1', email: 'Test@Exemple.fr' }] }])
    expect((await trouverCompteParEmail(admin, '  test@exemple.FR '))?.id).toBe('u-1')
  })

  it('parcourt les pages suivantes', async () => {
    const { admin, listUsers } = adminAvec([{ users: pagePleine('a') }, { users: [{ id: 'u-2', email: 'cible@exemple.fr' }] }])
    expect((await trouverCompteParEmail(admin, 'cible@exemple.fr'))?.id).toBe('u-2')
    expect(listUsers).toHaveBeenCalledTimes(2)
  })

  it('null quand aucun compte ne porte cet email, dernière page atteinte', async () => {
    const { admin, listUsers } = adminAvec([{ users: [{ id: 'u-1' }, { id: 'u-3', email: 'autre@exemple.fr' }] }])
    expect(await trouverCompteParEmail(admin, 'cible@exemple.fr')).toBeNull()
    expect(listUsers).toHaveBeenCalledTimes(1)
  })

  it('lève sur une lecture en échec, jamais « aucun compte »', async () => {
    const { admin } = adminAvec([{ erreur: { message: 'auth indisponible' } }])
    await expect(trouverCompteParEmail(admin, 'cible@exemple.fr')).rejects.toEqual({ message: 'auth indisponible' })
  })

  it('lève si la liste dépasse ce qu’on sait parcourir', async () => {
    const listUsers = vi.fn(async () => ({ data: { users: pagePleine('x') }, error: null }))
    const admin = { auth: { admin: { listUsers } } } as unknown as SupabaseClient
    await expect(trouverCompteParEmail(admin, 'cible@exemple.fr')).rejects.toThrow(/interrompue/)
    expect(listUsers).toHaveBeenCalledTimes(100)
  })
})
