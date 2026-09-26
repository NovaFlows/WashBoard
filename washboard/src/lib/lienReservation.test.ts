import { afterEach, describe, expect, it, vi } from 'vitest'
import { PHRASE_SLUG_INVALIDE, enregistrerSlug, normaliserSlug } from './lienReservation'

describe('normaliserSlug', () => {
  it('accepte un lien correct', () => {
    expect(normaliserSlug('kooki-clean')).toEqual({ ok: true, valeur: 'kooki-clean' })
    expect(normaliserSlug('abc')).toEqual({ ok: true, valeur: 'abc' })
    expect(normaliserSlug('a'.repeat(40))).toEqual({ ok: true, valeur: 'a'.repeat(40) })
  })

  it('met en minuscules, retire les espaces autour et remplace ceux du milieu par des tirets', () => {
    expect(normaliserSlug('  Ma Société  ').ok).toBe(false) // l'accent reste refusé
    expect(normaliserSlug('  Ma Belle Auto ')).toEqual({ ok: true, valeur: 'ma-belle-auto' })
  })

  it('refuse trop court, trop long, accents, caractères spéciaux et tirets aux bords', () => {
    for (const mauvais of ['', 'ab', 'a'.repeat(41), 'société', 'ma_marque', 'ma.marque', '-abc', 'abc-', 'a/b']) {
      expect(normaliserSlug(mauvais)).toEqual({ ok: false, message: PHRASE_SLUG_INVALIDE })
    }
  })
})

describe('enregistrerSlug', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('envoie le seul champ slug à /api/washer', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const r = await enregistrerSlug('nouveau-lien')
    expect(r).toEqual({ ok: true, data: null })
    expect(fetchMock).toHaveBeenCalledWith('/api/washer', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ slug: 'nouveau-lien' }),
    }))
  })

  it('rend la phrase du serveur quand le lien est déjà pris', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Ce lien est déjà utilisé. Choisissez-en un autre.' }), { status: 409 }),
    ))
    const r = await enregistrerSlug('deja-pris')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toContain('déjà utilisé')
  })
})
