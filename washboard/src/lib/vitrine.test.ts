import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PAGES_VITRINE, estPageVitrine, cheminInterne, estCheminInterne } from './vitrine'
import { config } from '../proxy'

const RACINE = path.join(__dirname, '../app/vitrine/[langue]')

/** Adresses publiques réelles des pages de app/vitrine/[langue] (groupes `(x)` ignorés). */
function adressesReelles(dossier = RACINE, prefixe = ''): string[] {
  const res: string[] = []
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (!e.isDirectory()) { if (e.name === 'page.tsx') res.push(prefixe || '/'); continue }
    if (e.name.startsWith('[')) continue
    const seg = /^\(.*\)$/.test(e.name) ? '' : '/' + e.name
    res.push(...adressesReelles(path.join(dossier, e.name), prefixe + seg))
  }
  return res
}

describe('site public pré-calculé', () => {
  const reelles = adressesReelles()

  it('chaque page de app/vitrine est servie par l’aiguillage', () => {
    for (const a of reelles) expect(estPageVitrine(a), a).toBe(true)
  })

  it('PAGES_VITRINE ne liste que des pages qui existent', () => {
    for (const a of PAGES_VITRINE) expect(reelles, a).toContain(a)
  })

  it('le matcher du proxy couvre chaque page hors /blog/…', () => {
    const matcher = config.matcher as string[]
    for (const a of PAGES_VITRINE) expect(matcher, a).toContain(a)
    expect(matcher).toContain('/blog/:path*')
    expect(matcher).toContain('/vitrine/:path*')
  })

  it('les images de partage et les autres pages ne sont pas réécrites', () => {
    expect(estPageVitrine('/blog/lavage-auto-sans-eau/opengraph-image')).toBe(false)
    expect(estPageVitrine('/opengraph-image')).toBe(false)
    for (const a of ['/signup', '/login', '/dashboard', '/book/mon-laveur', '/api/health', '/booking', '/blogue']) expect(estPageVitrine(a), a).toBe(false)
  })

  it('adresse interne et accès direct au dossier interne', () => {
    expect(cheminInterne('/', 'fr')).toBe('/vitrine/fr')
    expect(cheminInterne('/blog/x', 'en')).toBe('/vitrine/en/blog/x')
    expect(estCheminInterne('/vitrine')).toBe(true)
    expect(estCheminInterne('/vitrine/fr/blog')).toBe(true)
    expect(estCheminInterne('/vitrines')).toBe(false)
  })
})
