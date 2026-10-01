import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// Turbopack construit les déploiements (Vercel, `next build`) et abandonne
// silencieusement TOUT le CSS qui suit le premier `:has()` du fichier. Rien ne le
// signale : le build passe, la feuille est servie, elle est simplement amputée. Le
// 2026-10-01 la refonte est partie en production sans ses jetons `--v2-*` — fond gris,
// bordures noires, boutons blancs sur blanc — alors que le build local (webpack) était
// parfait. Ce test remplace une relecture humaine qui ne verrait rien.
describe('globals.css', () => {
  it('n’utilise aucun sélecteur :has()', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf-8')
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(sansCommentaires).not.toContain(':has(')
  })
})
