import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Ce helper est appelé APRÈS une écriture déjà réussie. Son seul contrat :
// vider le bon chemin, et ne jamais faire échouer l'appelant — un cache resté
// chaud cinq minutes est un désagrément, une prestation qui ne s'enregistre pas
// est un bug.

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }))

const { revaliderPageReservation } = await import('./revaliderPageReservation')

beforeEach(() => {
  revalidatePath.mockReset()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { vi.restoreAllMocks() })

describe('revaliderPageReservation', () => {
  it('vide la page du laveur', () => {
    revaliderPageReservation('kookiiclean', 'services.post')
    expect(revalidatePath).toHaveBeenCalledWith('/book/kookiiclean')
  })

  it('ne touche à rien quand le lien est inconnu', () => {
    revaliderPageReservation(null, 'services.post')
    revaliderPageReservation(undefined, 'services.post')
    revaliderPageReservation('', 'services.post')
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('avale l échec plutôt que de faire échouer l écriture qui vient d aboutir', () => {
    // `revalidatePath` lève hors contexte de requête Next.
    revalidatePath.mockImplementation(() => { throw new Error('static generation store missing') })
    expect(() => revaliderPageReservation('kookiiclean', 'services.post')).not.toThrow()
  })
})
