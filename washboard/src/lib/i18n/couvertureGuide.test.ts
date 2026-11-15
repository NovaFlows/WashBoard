import { describe, expect, it } from 'vitest'
import { GUIDE } from '@/lib/guide'
import { en } from './dictionnaires/en'
import { es } from './dictionnaires/es'
import { de } from './dictionnaires/de'

// Le guide d'aide vient de lib/guide.ts : chaque titre, résumé, question et RÉPONSE doit avoir sa traduction.
describe('guide traduit', () => {
  it.each([['en', en], ['es', es], ['de', de]] as const)('%s : tout le guide est traduit', (_l, d) => {
    const manquants: string[] = []
    for (const s of GUIDE) {
      for (const texte of [s.title, s.summary, ...s.entries.flatMap(e => [e.question, e.answer])]) {
        if (!d[texte]) manquants.push(texte.slice(0, 80))
      }
    }
    expect(manquants).toEqual([])
  })
})
