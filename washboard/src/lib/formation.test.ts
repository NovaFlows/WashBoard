import { describe, it, expect } from 'vitest'
import {
  CATALOGUE_DEMO, SESSIONS_DEMO, dureePack, dureeTexte, etatSession, leconDuCatalogue, leconsDuPack,
  packParSlug, partageVente, prixTexte, progressionPack, prochaineLecon, sessionsAVenir, trouverLecon,
} from './formation'

describe('dureeTexte', () => {
  it('écrit la durée comme on la dit', () => {
    expect(dureeTexte(45)).toBe('45 s')
    expect(dureeTexte(780)).toBe('13 min')
    expect(dureeTexte(3600)).toBe('1 h')
    expect(dureeTexte(3900)).toBe('1 h 05')
    expect(dureeTexte(-5)).toBe('0 s')
  })
})

describe('prixTexte', () => {
  it('n’affiche les centimes que s’il y en a', () => {
    expect(prixTexte(4900)).toBe('49 €')
    expect(prixTexte(4990)).toBe('49,90 €')
    expect(prixTexte(0)).toBe('Inclus')
  })
})

describe('partageVente 50/50', () => {
  it('ne perd jamais un centime', () => {
    for (const prix of [0, 1, 99, 4900, 4999, 7901, 12345]) {
      const { partenaire, washboard } = partageVente(prix)
      expect(partenaire + washboard).toBe(prix)
    }
  })
  it('le centime impair va à WashBoard', () => {
    expect(partageVente(4901)).toEqual({ partenaire: 2450, washboard: 2451 })
    expect(partageVente(4900)).toEqual({ partenaire: 2450, washboard: 2450 })
  })
  it('accepte un autre taux, borné entre 0 et 100', () => {
    expect(partageVente(1000, 70)).toEqual({ partenaire: 700, washboard: 300 })
    expect(partageVente(1000, 150)).toEqual({ partenaire: 1000, washboard: 0 })
    expect(partageVente(1000, -10)).toEqual({ partenaire: 0, washboard: 1000 })
  })
})

describe('progression et reprise', () => {
  const pack = CATALOGUE_DEMO[0]
  const lecons = leconsDuPack(pack)
  it('compte les leçons faites, en pourcentage entier', () => {
    expect(progressionPack(pack, new Set())).toBe(0)
    expect(progressionPack(pack, new Set(lecons.map(l => l.id)))).toBe(100)
    expect(progressionPack(pack, new Set([lecons[0].id]))).toBe(Math.round(100 / lecons.length))
  })
  it('« Reprendre » ouvre la première leçon pas faite, dans l’ordre', () => {
    expect(prochaineLecon(pack, new Set())?.id).toBe(lecons[0].id)
    expect(prochaineLecon(pack, new Set([lecons[0].id, lecons[1].id]))?.id).toBe(lecons[2].id)
    expect(prochaineLecon(pack, new Set(lecons.map(l => l.id)))).toBeNull()
  })
  it('un identifiant inconnu ne compte pas', () => {
    expect(progressionPack(pack, new Set(['inconnu']))).toBe(0)
  })
  it('la durée du pack est la somme des leçons', () => {
    expect(dureePack(pack)).toBe(lecons.reduce((n, l) => n + l.dureeSec, 0))
  })
})

describe('catalogue d’exemple', () => {
  it('chaque leçon a un identifiant unique dans tout le catalogue', () => {
    const ids = CATALOGUE_DEMO.flatMap(leconsDuPack).map(l => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('retrouve un pack et une leçon par identifiant', () => {
    expect(packParSlug(CATALOGUE_DEMO, 'interieur-detailing')?.titre).toContain('intérieur')
    expect(packParSlug(CATALOGUE_DEMO, 'nope')).toBeUndefined()
    const trouve = trouverLecon(CATALOGUE_DEMO[0], 'l-2-2')
    expect(trouve?.module.id).toBe('m2')
    expect(trouve?.index).toBe(4)
    expect(leconDuCatalogue(CATALOGUE_DEMO, 'l-4-1')?.pack.slug).toBe('interieur-detailing')
    expect(leconDuCatalogue(CATALOGUE_DEMO, 'zzz')).toBeNull()
  })
})

describe('appels en direct', () => {
  const s = { id: 'x', titre: 'T', animateur: 'A', debutIso: '2026-11-19T19:00:00+01:00', dureeMin: 60, places: 10, inscrits: 3 }
  const avant = (min: number) => new Date(new Date(s.debutIso).getTime() - min * 60_000)
  it('suit le déroulé : à venir, bientôt, en cours, passé', () => {
    expect(etatSession(s, avant(120))).toBe('a_venir')
    expect(etatSession(s, avant(10))).toBe('bientot')
    expect(etatSession(s, avant(-30))).toBe('en_cours')
    expect(etatSession(s, avant(-61))).toBe('passee')
  })
  it('complet seulement avant le début : on peut toujours rejoindre un direct commencé', () => {
    const plein = { ...s, inscrits: 10 }
    expect(etatSession(plein, avant(120))).toBe('complet')
    expect(etatSession(plein, avant(-30))).toBe('en_cours')
  })
  it('liste les appels à venir, du plus proche au plus lointain, sans les passés', () => {
    const liste = sessionsAVenir(SESSIONS_DEMO, new Date('2026-11-20T00:00:00+01:00'))
    expect(liste.map(x => x.id)).toEqual(['s-2', 's-3'])
  })
})
