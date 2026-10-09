// Garde-fou de l'audit `cyber` du 2026-10-02.
//
// Le rôle `authenticated` lisait et écrivait toutes les colonnes de ses propres
// réservations. Un laveur connecté n'avait qu'à interroger Supabase lui-même
// (son jeton + la clé publique, visibles dans son navigateur) pour lire en
// clair ce que `masquerVerrouillees` cache, ou écrire `saisie_par_laveur` pour
// déverrouiller une réservation hors quota.
//
// Le correctif retire à `authenticated` tout droit direct sur `bookings` : le
// serveur la lit par l'admin, filtre `washer_id` explicite. Mais le client de
// session du serveur et le laveur en direct, c'est le MÊME rôle — une seule
// lecture oubliée sur la session et l'écran concerné tombe en panne, ou pire,
// `seuilsVerrouillage` échoue et ne masque plus rien. Ce test lit le code et
// refuse ce retour en arrière.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const DOSSIERS = ['src/app', 'src/lib', 'src/components']

function fichiersSource(dossier: string): string[] {
  const racine = path.resolve(process.cwd(), dossier)
  const trouves: string[] = []
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) parcourir(p)
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) trouves.push(p)
    }
  }
  parcourir(racine)
  return trouves
}

const fichiers = DOSSIERS.flatMap(fichiersSource).map(p => ({
  p: path.relative(process.cwd(), p),
  src: fs.readFileSync(p, 'utf8'),
}))

const FROM_BOOKINGS = /\.from\(\s*['"]bookings['"]\s*\)/g

/** Les noms qui désignent, dans ce fichier, un client lié à la session. */
function clientsDeSession(src: string): Set<string> {
  const noms = new Set<string>()
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*await\s+create(?:Session)?Client\(\)/g)) noms.add(m[1])
  // `requireWasher()` rend la session sous le nom `supabase`.
  if (/const\s*\{[^}]*\bsupabase\b[^}]*\}\s*=\s*\w+\.ctx/.test(src)) noms.add('supabase')
  return noms
}

/** Ce sur quoi `.from('bookings')` est appelé : `admin`, `supabase`, `createAdminClient`… */
function receveur(src: string, index: number): string | null {
  const avant = src.slice(0, index).trimEnd()
  return avant.match(/([A-Za-z_$][\w$]*)(?:\(\))?$/)?.[1] ?? null
}

describe('accès à `bookings`', () => {
  it('le scan voit bien le code', () => {
    // Sans ce plancher, un chemin faux ferait scanner zéro fichier et le test
    // passerait sans rien vérifier.
    expect(fichiers.filter(f => f.src.match(FROM_BOOKINGS)).length).toBeGreaterThan(15)
  })

  it('jamais depuis le navigateur', () => {
    const fautifs = fichiers
      .filter(f => f.src.includes('@/lib/supabase/client'))
      .filter(f => /['"]bookings['"]/.test(f.src))
      .map(f => f.p)
    expect(fautifs).toEqual([])
  })

  it('jamais par le client de session côté serveur', () => {
    const fautifs: string[] = []
    for (const { p, src } of fichiers) {
      const session = clientsDeSession(src)
      if (session.size === 0) continue
      for (const m of src.matchAll(FROM_BOOKINGS)) {
        const r = receveur(src, m.index!)
        if (r && session.has(r)) fautifs.push(`${p} (${r})`)
      }
    }
    expect(fautifs).toEqual([])
  })

  it('les seuils de verrouillage ne se calculent jamais sur la session', () => {
    // Le mélange le plus dangereux : réservations lues par l'admin, seuils par
    // la session. La lecture des seuils échoue, ne masque rien, et tout part en
    // clair — sans qu'aucun écran ne casse.
    const fautifs: string[] = []
    for (const { p, src } of fichiers) {
      const session = clientsDeSession(src)
      for (const m of src.matchAll(/(?:seuilsVerrouillage|compterReservationsDeLaPeriode)\(\s*(\w+)/g)) {
        if (session.has(m[1])) fautifs.push(`${p} (${m[1]})`)
      }
    }
    expect(fautifs).toEqual([])
  })
})
