import { describe, it, expect } from 'vitest'
import { lienV2 } from '@/lib/lienV2'
import { GUIDE } from '@/lib/guide'

// Le guide est écrit une fois, avec les adresses du SITE. Lu depuis l'application, chaque lien
// doit mener à l'écran refait — sinon le laveur sort de la PWA au milieu d'une explication
// (Alexandre, 2026-09-27).

describe('lienV2', () => {
  it('traduit les anciens écrans de réglages', () => {
    expect(lienV2('/dashboard/admin')).toBe('/dashboard/parametres/prestations?vue=prestations')
    expect(lienV2('/dashboard/admin#disponibilites')).toBe('/dashboard/parametres/horaires')
    expect(lienV2('/dashboard/parametres#profil')).toBe('/dashboard/parametres/profil')
    expect(lienV2('/dashboard/compta')).toBe('/dashboard/chiffres')
    expect(lienV2('/dashboard/crm')).toBe('/dashboard/chiffres')
  })

  it('laisse passer ce qui n’a pas changé d’adresse', () => {
    for (const inchange of ['/dashboard', '/dashboard/clients', '/dashboard/calendrier', '/dashboard/factures', '/dashboard/abonnement']) {
      expect(lienV2(inchange)).toBe(inchange)
    }
  })

  it('un lien inconnu passe tel quel plutôt que de devenir mort', () => {
    expect(lienV2('/dashboard/quelque-chose-de-neuf')).toBe('/dashboard/quelque-chose-de-neuf')
  })
})

describe('tous les liens du guide, vus depuis l’application', () => {
  const liens = GUIDE.flatMap(s => s.entries)
    .flatMap(e => [...e.answer.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m => m[1]))
    .filter(h => h.startsWith('/dashboard'))

  it('aucun ne laisse le laveur sur un écran de l’ancienne version', () => {
    const anciens = ['/dashboard/admin', '/dashboard/compta', '/dashboard/crm', '/dashboard/parametres#']
    const fautifs = [...new Set(liens.map(lienV2))]
      .filter(h => anciens.some(a => h.startsWith(a)))
    expect(fautifs).toEqual([])
  })

  it('le guide contient bien des liens — sinon ce test ne prouverait rien', () => {
    expect(liens.length).toBeGreaterThan(10)
  })
})
