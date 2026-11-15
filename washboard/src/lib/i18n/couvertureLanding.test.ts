import { describe, expect, it } from 'vitest'
import { FAQ_ITEMS } from '@/lib/faq'
import { besoinsHead, besoinsRows } from '@/lib/comparatifAuto'
import { PLAN_CARDS, LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, freeMonthsLabel } from '@/lib/plan'
import { COLONNES, ET_AUSSI } from '@/components/landing/vitrine/ToutEnUn'
import { en } from './dictionnaires/en'
import { es } from './dictionnaires/es'
import { de } from './dictionnaires/de'

// Les textes de la landing viennent de `lib/` (FAQ, comparatif, offres) et sont composés avec les prix
// et les noms d'offres du moment : la clé de traduction est le français FINAL. Si une offre ou un prix
// change, la clé change et la traduction tombe en repli français SANS erreur — ce test le rend visible.
const SANS_LETTRES = /^[^A-Za-zÀ-ÿ]*[A-Za-zÀ-ÿ]?[^A-Za-zÀ-ÿ]*$/

const textes = [
  ...FAQ_ITEMS.flatMap(i => [i.q, i.a]),
  ...besoinsHead, ...besoinsRows.flat(),
  ...PLAN_CARDS.flatMap(c => [c.tagline, ...c.features]), LIBELLE_CONTACT, LIBELLE_RDV_BUSINESS, freeMonthsLabel(),
  ...COLONNES.flatMap(c => [c.titre, c.sous, ...c.items.flatMap(i => [i.titre, i.texte])]), ...ET_AUSSI,
].filter(t => !SANS_LETTRES.test(t))

describe('couverture des traductions de la landing', () => {
  for (const [nom, dico] of [['en', en], ['es', es], ['de', de]] as const) {
    it(`${nom} : tout le contenu venu de lib/ est traduit`, () => {
      const manquants = [...new Set(textes)].filter(t => !dico[t]?.trim())
      expect(manquants).toEqual([])
    })
  }
})
