import { describe, it, expect } from 'vitest'
import { GUIDE, searchGuide, normalize, entryText } from './guide'

const allEntries = GUIDE.flatMap(s => s.entries)
const countEntries = (sections: typeof GUIDE) =>
  sections.reduce((n, s) => n + s.entries.length, 0)

describe('normalize', () => {
  it('ignore accents et casse', () => {
    expect(normalize('Congés')).toBe('conges')
    expect(normalize('CHIFFRE D’AFFAIRES')).toContain('affaires')
  })
})

describe('searchGuide', () => {
  it('renvoie tout le guide quand la recherche est vide', () => {
    expect(countEntries(searchGuide(''))).toBe(allEntries.length)
    expect(countEntries(searchGuide('   '))).toBe(allEntries.length)
  })

  it('trouve une entrée malgré les accents manquants', () => {
    const found = searchGuide('conges').flatMap(s => s.entries)
    expect(found.map(e => e.id)).toContain('conges')
  })

  it('cherche aussi dans les mots-clés, pas seulement le texte visible', () => {
    // « vacances » n'apparaît que dans les keywords de l'entrée congés.
    const found = searchGuide('vacances').flatMap(s => s.entries)
    expect(found.map(e => e.id)).toContain('conges')
  })

  it('exige tous les mots saisis, pas au moins un', () => {
    const large = countEntries(searchGuide('avis'))
    const precis = countEntries(searchGuide('avis google'))
    expect(precis).toBeGreaterThan(0)
    expect(precis).toBeLessThanOrEqual(large)
    // Deux mots sans rapport commun ne doivent rien remonter.
    expect(countEntries(searchGuide('conges comptabilite'))).toBe(0)
  })

  it('ne renvoie aucune section vide', () => {
    for (const section of searchGuide('tarif')) {
      expect(section.entries.length).toBeGreaterThan(0)
    }
  })

  it('renvoie zéro résultat sur une requête absurde', () => {
    expect(countEntries(searchGuide('xyzzy'))).toBe(0)
  })
})

describe('intégrité du contenu', () => {
  it('les identifiants sont uniques', () => {
    const ids = allEntries.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    const sectionIds = GUIDE.map(s => s.id)
    expect(new Set(sectionIds).size).toBe(sectionIds.length)
  })

  it('tous les liens internes pointent vers une page du dashboard connue', () => {
    // Un lien mort dans le guide envoie l'utilisateur sur un 404 : on verrouille
    // la liste des destinations valides.
    const PAGES = [
      '/dashboard', '/dashboard/crm', '/dashboard/calendrier', '/dashboard/compta',
      '/dashboard/admin', '/dashboard/parametres', '/dashboard/abonnement', '/dashboard/guide',
    ]
    const liens = allEntries.flatMap(e => [...e.answer.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m => m[1]))
    expect(liens.length).toBeGreaterThan(0)
    for (const href of liens) expect(PAGES).toContain(href)
  })

  it('aucun lien mal formé ne reste en texte brut', () => {
    for (const entry of allEntries) {
      expect(entry.answer).not.toMatch(/\]\(\s*\)/)
      expect(entry.answer).not.toMatch(/\[[^\]]*$/)
    }
  })

  it('entryText aplatit les liens pour la recherche', () => {
    const avecLien = allEntries.find(e => e.answer.includes(']('))!
    expect(entryText(avecLien)).not.toContain('](')
  })
})

describe('tolérance au pluriel', () => {
  it('trouve « congé » même en tapant « congés »', () => {
    const ids = searchGuide('congés').flatMap(s => s.entries).map(e => e.id)
    expect(ids).toContain('conges')
  })
  it('trouve « tarif » en tapant « tarifs »', () => {
    expect(searchGuide('tarifs').flatMap(s => s.entries).length).toBeGreaterThan(0)
  })
  it('ne tronque pas les mots trop courts', () => {
    // « as » ne doit pas devenir « a » et tout faire matcher.
    expect(searchGuide('as xyzzy').flatMap(s => s.entries).length).toBe(0)
  })
})
