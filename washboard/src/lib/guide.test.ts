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

describe('pertinence du classement', () => {
  it('la section qui porte le sujet passe devant celles qui le mentionnent', () => {
    // Cas réel remonté le 2026-09-17 : « factures » remontait d'abord
    // « Agenda et rendez-vous », qui parle de facture sans être sur le sujet.
    const sections = searchGuide('factures')
    expect(sections.length).toBeGreaterThan(1)
    expect(sections[0].id).toBe('factures')
  })

  it('une question qui porte le mot passe devant une réponse qui le cite', () => {
    const premiere = searchGuide('facture')[0].entries[0]
    expect(normalize(premiere.question)).toContain('factur')
  })

  it('le classement ne change pas ce qui remonte, seulement l’ordre', () => {
    for (const requete of ['facture', 'client', 'avis', 'rappel']) {
      const ids = searchGuide(requete).flatMap(s => s.entries).map(e => e.id)
      expect(new Set(ids).size).toBe(ids.length)
      // Toutes les entrées retenues contiennent bien le mot cherché.
      const mot = normalize(requete)
      for (const id of ids) {
        const entry = allEntries.find(e => e.id === id)!
        const section = GUIDE.find(s => s.entries.some(x => x.id === id))!
        expect(normalize(`${section.title} ${entryText(entry)}`)).toContain(mot.slice(0, -1))
      }
    }
  })

  it('une recherche vide garde l’ordre pédagogique d’origine', () => {
    expect(searchGuide('').map(s => s.id)).toEqual(GUIDE.map(s => s.id))
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
      '/dashboard/clients', '/dashboard/factures',
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
