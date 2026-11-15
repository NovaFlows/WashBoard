import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { en } from './dictionnaires/en'
import { es } from './dictionnaires/es'
import { de } from './dictionnaires/de'
import { ARTICLES } from '@/lib/blog'
import { lienPageMetier } from '@/lib/metiers'
import { enArticles } from './dictionnaires/articles/en'
import { esArticles } from './dictionnaires/articles/es'
import { deArticles } from './dictionnaires/articles/de'

// Les articles du blog (src/app/blog/<slug>/page.tsx) se traduisent avec `getTArticle` : dictionnaire de
// l'appli + dictionnaire des articles. Chaque phrase passée à t() doit exister dans l'un des deux.
const DOSSIER = join(process.cwd(), 'src', 'app', 'blog')
const pages = readdirSync(DOSSIER, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => join(DOSSIER, d.name, 'page.tsx'))

function cles(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) out.push(m[1].replace(/\\(.)/g, '$1'))
  return out
}

describe('articles du blog traduits', () => {
  it('les trois langues ont exactement les mêmes phrases', () => {
    const base = Object.keys(enArticles).sort()
    expect(Object.keys(esArticles).sort()).toEqual(base)
    expect(Object.keys(deArticles).sort()).toEqual(base)
  })

  it.each([['en', enArticles], ['es', esArticles], ['de', deArticles]] as const)('%s : traductions non vides, mêmes {variables}', (_l, d) => {
    const vars = (s: string) => new Set(s.match(/\{\w+\}/g) ?? [])
    for (const [cle, valeur] of Object.entries(d)) {
      expect(valeur.trim(), cle).not.toBe('')
      for (const v of vars(valeur)) expect(vars(cle).has(v), `${cle} : ${v} inconnue`).toBe(true)
      for (const v of vars(cle)) expect(vars(valeur).has(v), `${cle} : ${v} omise`).toBe(true)
    }
  })

  it.each([['en', en, enArticles], ['es', es, esArticles], ['de', de, deArticles]] as const)('%s : toutes les phrases des pages ont une traduction', (_l, app, articles) => {
    const manquantes: string[] = []
    for (const page of pages) {
      for (const cle of cles(readFileSync(page, 'utf8'))) {
        if (!/[A-Za-zÀ-ÿ]{2}/.test(cle)) continue
        if (!app[cle] && !articles[cle]) manquantes.push(`${page.split(/[\\/]/).slice(-2, -1)[0]} : ${cle.slice(0, 90)}`)
      }
    }
    expect(manquantes).toEqual([])
  })

  it.each([['en', enArticles], ['es', esArticles], ['de', deArticles]] as const)('%s : le lien vers la page métier est traduit pour chaque thème', (_l, articles) => {
    const manquants = [...new Set(ARTICLES.map(a => lienPageMetier(a.theme).label))].filter(label => !articles[label])
    expect(manquants).toEqual([])
  })
})
