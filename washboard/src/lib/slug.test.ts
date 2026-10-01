import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSlug, slugValide, slugLibre, PHRASE_SLUG_INVALIDE } from './slug'

describe('generateSlug', () => {
  it('met en minuscules et remplace les espaces par des tirets', () => {
    expect(generateSlug('Kooki Clean')).toBe('kooki-clean')
  })

  it('retire les accents au lieu de les refuser', () => {
    expect(generateSlug('Éclat Auto Façade')).toBe('eclat-auto-facade')
  })

  it('fusionne les caractères spéciaux en un seul tiret et nettoie les bords', () => {
    expect(generateSlug('  --Lavage & Co. !!  ')).toBe('lavage-co')
    expect(generateSlug("L'Atelier/du_Lavage")).toBe('l-atelier-du-lavage')
  })

  it('coupe à 40 caractères', () => {
    expect(generateSlug('a'.repeat(60))).toHaveLength(40)
  })

  it('rend une chaîne vide quand rien n’est utilisable', () => {
    expect(generateSlug('!!!')).toBe('')
  })

  it('laisse un lien déjà valide tel quel', () => {
    expect(generateSlug('kookiclean-1f09')).toBe('kookiclean-1f09')
  })
})

describe('slugValide', () => {
  it('accepte 3 à 40 caractères en minuscules, chiffres et tirets intérieurs', () => {
    for (const bon of ['abc', 'kooki-clean', 'kooki--clean', 'a1b', 'a'.repeat(40)]) {
      expect(slugValide(bon), bon).toBe(true)
    }
  })

  it('refuse le reste', () => {
    for (const mauvais of ['', 'ab', 'a'.repeat(41), '-abc', 'abc-', 'Abc', 'société', 'a_b', 'a b', 'a/b']) {
      expect(slugValide(mauvais), mauvais).toBe(false)
    }
  })

  it('donne une phrase lisible à afficher', () => {
    expect(PHRASE_SLUG_INVALIDE).toMatch(/3 à 40 caractères/)
  })
})

describe('slugLibre', () => {
  function base(reponse: { data: unknown; error: unknown }) {
    const appels: unknown[][] = []
    const b: Record<string, unknown> = {}
    Object.assign(b, {
      select: (...a: unknown[]) => { appels.push(['select', ...a]); return b },
      eq: (...a: unknown[]) => { appels.push(['eq', ...a]); return b },
      maybeSingle: async () => reponse,
    })
    const db = { from: (t: string) => { appels.push(['from', t]); return b } } as unknown as SupabaseClient
    return { db, appels }
  }

  it('libre quand personne ne porte ce lien', async () => {
    const { db, appels } = base({ data: null, error: null })
    expect(await slugLibre(db, 'kooki-clean', 'u-1')).toEqual({ ok: true, libre: true })
    expect(appels).toContainEqual(['from', 'washers'])
    expect(appels).toContainEqual(['eq', 'slug', 'kooki-clean'])
  })

  it('libre quand le lien appartient déjà au laveur', async () => {
    const { db } = base({ data: { id: 'w-1', user_id: 'u-1' }, error: null })
    expect(await slugLibre(db, 'kooki-clean', 'u-1')).toEqual({ ok: true, libre: true })
  })

  it('pris par un autre laveur', async () => {
    const { db } = base({ data: { id: 'w-2', user_id: 'u-2' }, error: null })
    expect(await slugLibre(db, 'kooki-clean', 'u-1')).toEqual({ ok: true, libre: false })
  })

  it('pris par une fiche sans compte (aperçu prospect, fiche historique)', async () => {
    const { db } = base({ data: { id: 'apercu', user_id: null }, error: null })
    expect(await slugLibre(db, 'urhus-auto', 'u-1')).toEqual({ ok: true, libre: false })
  })

  it('une lecture ratée est rendue comme une erreur, jamais comme « libre »', async () => {
    const panne = { message: 'base indisponible' }
    const { db } = base({ data: null, error: panne })
    expect(await slugLibre(db, 'kooki-clean', 'u-1')).toEqual({ ok: false, erreur: panne })
  })
})
