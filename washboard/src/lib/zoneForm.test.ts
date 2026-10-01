import { describe, it, expect } from 'vitest'
import {
  chercherDepartements, formulaireDepuisZone, lireRayon, nomDepartement, normaliser,
  phraseRayon, resumeDepartements, resumeZone, routePlusLongue, validerZone,
  ERREUR_ADRESSE, ERREUR_DEPARTEMENTS, ERREUR_RAYON, RAYON_DEFAUT, ZONE_SANS_LIMITE,
  type FormulaireZone,
} from './zoneForm'
import type { ZoneConfig } from '@/types'

const form = (p: Partial<FormulaireZone> = {}): FormulaireZone => ({
  limiter: true, mode: 'crow', adresse: '12 rue de la Paix, 75002 Paris', rayon: '20', departements: [], ...p,
})

describe('normaliser', () => {
  it('ignore les accents, la casse et la ponctuation', () => {
    expect(normaliser('Hérault')).toBe('herault')
    expect(normaliser('CÔTE-D’OR')).toBe('cote d or')
    expect(normaliser('  Seine-et-Marne ')).toBe('seine et marne')
  })
})

describe('chercherDepartements', () => {
  it('trouve « herault » sans accent — le v1 ne le trouvait pas', () => {
    expect(chercherDepartements('herault').map(d => d.code)).toEqual(['34'])
  })

  it('trouve par numéro, en préfixe seulement', () => {
    expect(chercherDepartements('89').map(d => d.name)).toEqual(['Yonne'])
    // « 9 » ne doit pas ramener 19, 29, 39… : un numéro se cherche par son début.
    expect(chercherDepartements('9').every(d => d.code.startsWith('9'))).toBe(true)
  })

  it('trouve un morceau de nom au milieu', () => {
    expect(chercherDepartements('marne').map(d => d.code)).toContain('51')
    expect(chercherDepartements('marne').map(d => d.code)).toContain('77')
  })

  it('une recherche vide rend la liste entière', () => {
    expect(chercherDepartements('  ').length).toBeGreaterThan(95)
  })

  it('une recherche sans résultat rend une liste vide', () => {
    expect(chercherDepartements('zzzz')).toEqual([])
  })
})

describe('nomDepartement et resumeDepartements', () => {
  it('rend le nom, ou le code si le département est inconnu', () => {
    expect(nomDepartement('89')).toBe('Yonne')
    expect(nomDepartement('XX')).toBe('XX')
  })

  it('résume selon le nombre', () => {
    expect(resumeDepartements([])).toBe('')
    expect(resumeDepartements(['89'])).toBe('Yonne')
    expect(resumeDepartements(['89', '58'])).toBe('Yonne et Nièvre')
    expect(resumeDepartements(['89', '58', '21'])).toBe('Yonne, Nièvre et 1 autre')
    expect(resumeDepartements(['89', '58', '21', '45'])).toBe('Yonne, Nièvre et 2 autres')
  })
})

describe('lireRayon', () => {
  it('accepte un entier dans les bornes', () => {
    expect(lireRayon('20')).toBe(20)
    expect(lireRayon(' 150 ')).toBe(150)
    expect(lireRayon('5')).toBe(5)
  })

  it('refuse hors bornes, vide, décimal ou texte', () => {
    for (const saisie of ['4', '151', '', '  ', '20.5', '20,5', 'vingt', '-10']) {
      expect(lireRayon(saisie)).toBeNull()
    }
  })
})

describe('phraseRayon', () => {
  it('dit la distance et le point de départ', () => {
    expect(phraseRayon('crow', '20', '12 rue de la Paix')).toBe('Jusqu’à 20 km en ligne droite autour de 12 rue de la Paix.')
    expect(phraseRayon('road', '30', '12 rue de la Paix')).toBe('Jusqu’à 30 km par les routes autour de 12 rue de la Paix.')
  })

  it('sans adresse, reste une phrase complète', () => {
    expect(phraseRayon('crow', '20', '   ')).toBe('Jusqu’à 20 km en ligne droite autour de votre point de départ.')
  })

  it('rien à dire sans rayon valide, ni en mode départements', () => {
    expect(phraseRayon('crow', '', 'Paris')).toBeNull()
    expect(phraseRayon('departments', '20', 'Paris')).toBeNull()
  })

  it('la route n’est plus longue qu’en ligne droite', () => {
    expect(routePlusLongue('crow')).toBe(true)
    expect(routePlusLongue('road')).toBe(false)
  })
})

describe('formulaireDepuisZone', () => {
  it('zone absente ou éteinte : ligne droite, 20 km, rien de rempli', () => {
    for (const zone of [null, { enabled: false } as ZoneConfig]) {
      expect(formulaireDepuisZone(zone)).toEqual({
        limiter: false, mode: 'crow', adresse: '', rayon: String(RAYON_DEFAUT), departements: [],
      })
    }
  })

  it('reprend une zone par rayon', () => {
    expect(formulaireDepuisZone({ enabled: true, type: 'road', center_address: 'Lyon', radius_km: 35 })).toEqual({
      limiter: true, mode: 'road', adresse: 'Lyon', rayon: '35', departements: [],
    })
  })

  it('reprend une zone par départements', () => {
    expect(formulaireDepuisZone({ enabled: true, type: 'departments', departments: ['89', '58'] })).toEqual({
      limiter: true, mode: 'departments', adresse: '', rayon: '20', departements: ['89', '58'],
    })
  })
})

describe('validerZone', () => {
  it('éteindre efface la configuration, comme le v1', () => {
    expect(validerZone(form({ limiter: false, departements: ['89'] }))).toEqual({
      ok: true, config: { enabled: false },
    })
  })

  it('rayon : adresse et rayon partent ensemble, jamais de coordonnées', () => {
    expect(validerZone(form({ mode: 'crow', adresse: '  Paris  ', rayon: '30' }))).toEqual({
      ok: true, config: { enabled: true, type: 'crow', center_address: 'Paris', radius_km: 30 },
    })
  })

  it('refuse une adresse vide', () => {
    expect(validerZone(form({ adresse: '   ' }))).toEqual({ ok: false, champ: 'adresse', message: ERREUR_ADRESSE })
  })

  it('refuse un rayon hors bornes', () => {
    expect(validerZone(form({ rayon: '400' }))).toEqual({ ok: false, champ: 'rayon', message: ERREUR_RAYON })
  })

  it('refuse une zone « départements » vide — le v1 l’acceptait et bloquait tout le monde', () => {
    expect(validerZone(form({ mode: 'departments', departements: [] }))).toEqual({
      ok: false, champ: 'departements', message: ERREUR_DEPARTEMENTS,
    })
  })

  it('accepte une zone par départements', () => {
    expect(validerZone(form({ mode: 'departments', departements: ['89', '58'] }))).toEqual({
      ok: true, config: { enabled: true, type: 'departments', departments: ['89', '58'] },
    })
  })
})

describe('resumeZone', () => {
  it('sans zone : une option, pas un manque', () => {
    expect(resumeZone(null)).toEqual({ texte: ZONE_SANS_LIMITE })
    expect(resumeZone({ enabled: false })).toEqual({ texte: ZONE_SANS_LIMITE })
  })

  it('zone active par rayon', () => {
    expect(resumeZone({ enabled: true, type: 'crow', center_address: '12 rue de la Paix', radius_km: 20 })).toEqual({
      texte: '20 km en ligne droite autour de 12 rue de la Paix',
    })
    expect(resumeZone({ enabled: true, type: 'road', center_address: 'Lyon', radius_km: 15 })).toEqual({
      texte: '15 km par les routes autour de Lyon',
    })
  })

  it('zone active par départements', () => {
    expect(resumeZone({ enabled: true, type: 'departments', departments: ['89', '58', '21', '45'] })).toEqual({
      texte: 'Yonne, Nièvre et 2 autres',
    })
  })

  it('adresse manquante : ambre, la limite ne s’applique pas', () => {
    expect(resumeZone({ enabled: true, type: 'crow', center_address: '  ', radius_km: 20 })).toEqual({
      texte: 'Adresse manquante : la limite n’est pas appliquée', ton: 'ambre',
    })
  })

  it('aucun département : rouge, personne ne peut réserver', () => {
    expect(resumeZone({ enabled: true, type: 'departments', departments: [] })).toEqual({
      texte: 'Aucun département : personne ne peut réserver', ton: 'rouge',
    })
  })
})
