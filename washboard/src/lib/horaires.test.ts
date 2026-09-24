import { describe, it, expect, vi } from 'vitest'
import {
  ERREUR_DATES_MANQUANTES, ERREUR_FIN_AVANT_DEBUT, ERREUR_FIN_DATE_AVANT_DEBUT, FERME, HEURES_CHOIX, JOURS_AFFICHES,
  analyserAjout, congesAVenir, erreurPeriode, erreurPlage, heureCourte, libelleJour, libellePlage, listeJours,
  phraseEchecAjout, plagesDuJour, resumeHoraires, seRecouvrent, seTouchent, trierJours, unSeulALaFois,
  type Plage, type ResultatJour,
} from './horaires'
import { horaireAligne } from './bookingWindow'
import type { Availability } from '@/types'

const plage = (jour: number, debut: string, fin: string): Plage => ({ day_of_week: jour, start_time: debut, end_time: fin })
const semaine = (jours: number[], debut = '08:00', fin = '18:00') => jours.map(j => plage(j, debut, fin))

describe('affichage des heures', () => {
  it('« 08:00 » → « 8h », « 17:30 » → « 17h30 », sans passer par un fuseau', () => {
    expect(heureCourte('08:00')).toBe('8h')
    expect(heureCourte('17:30')).toBe('17h30')
    expect(heureCourte('00:00')).toBe('0h')
    expect(heureCourte('23:30')).toBe('23h30')
  })

  it('lit aussi le format « 08:00:00 » du type time de Postgres', () => {
    expect(heureCourte('08:00:00')).toBe('8h')
    expect(libellePlage(plage(1, '09:00:00', '12:30:00'))).toBe('9h–12h30')
  })

  it('rend tel quel un format illisible plutôt que de le cacher', () => {
    expect(heureCourte('matin')).toBe('matin')
  })
})

describe('l’ordre des jours', () => {
  it('affiche lundi → dimanche, mais la base garde dimanche = 0', () => {
    expect([...JOURS_AFFICHES]).toEqual([1, 2, 3, 4, 5, 6, 0])
  })

  it('trierJours remet dans l’ordre d’affichage et écarte doublons et valeurs hors 0-6', () => {
    expect(trierJours([0, 5, 1, 5, 9])).toEqual([1, 5, 0])
  })
})

describe('HEURES_CHOIX', () => {
  it('va de 00:00 à 23:30 par pas de 30 min : 48 valeurs, toutes acceptées par le serveur', () => {
    expect(HEURES_CHOIX).toHaveLength(48)
    expect(HEURES_CHOIX[0]).toBe('00:00')
    expect(HEURES_CHOIX[1]).toBe('00:30')
    expect(HEURES_CHOIX[47]).toBe('23:30')
    expect(HEURES_CHOIX.every(h => horaireAligne(h))).toBe(true)
  })
})

describe('plagesDuJour / libelleJour', () => {
  const plages = [plage(1, '14:00', '18:00'), plage(1, '08:00', '12:00'), plage(2, '09:00', '12:00')]

  it('trie les plages d’un jour de la plus tôt à la plus tard, sans toucher aux autres jours', () => {
    expect(plagesDuJour(plages, 1).map(libellePlage)).toEqual(['8h–12h', '14h–18h'])
    expect(plagesDuJour(plages, 2)).toHaveLength(1)
  })

  it('reconnaît le jour même quand day_of_week arrive en chaîne', () => {
    expect(plagesDuJour([{ day_of_week: '1' as unknown as number, start_time: '08:00', end_time: '12:00' }], 1)).toHaveLength(1)
  })

  it('sépare les plages par « · »', () => {
    expect(libelleJour(plages, 1)).toBe('8h–12h · 14h–18h')
  })

  it('un jour sans plage se dit « Fermé », jamais « Indisponible » (mot des congés)', () => {
    expect(libelleJour(plages, 3)).toBe('Fermé')
    expect(FERME).not.toMatch(/indisponible/i)
  })

  it('le dimanche est le jour 0', () => {
    expect(libelleJour([plage(0, '10:00', '12:00')], 0)).toBe('10h–12h')
    expect(libelleJour([plage(0, '10:00', '12:00')], 7)).toBe('Fermé')
  })
})

describe('resumeHoraires', () => {
  it('regroupe les jours consécutifs à plages identiques', () => {
    expect(resumeHoraires(semaine([1, 2, 3, 4, 5]))).toBe('Lun–Ven 8h–18h')
  })

  it('« Lun–Ven 8h–18h · Sam 9h–12h »', () => {
    expect(resumeHoraires([...semaine([1, 2, 3, 4, 5]), plage(6, '09:00', '12:00')])).toBe('Lun–Ven 8h–18h · Sam 9h–12h')
  })

  it('un jour fermé interrompt la série, même avec les mêmes horaires de part et d’autre', () => {
    expect(resumeHoraires(semaine([1, 2, 4, 5]))).toBe('Lun–Mar 8h–18h · Jeu–Ven 8h–18h')
  })

  it('le dimanche (0) vient après le samedi dans la série', () => {
    expect(resumeHoraires(semaine([6, 0], '09:00', '12:00'))).toBe('Sam–Dim 9h–12h')
    expect(resumeHoraires(semaine([0, 1], '09:00', '12:00'))).toBe('Lun 9h–12h · Dim 9h–12h')
  })

  it('plusieurs plages par jour, triées, comparées dans leur ensemble', () => {
    const plages = [
      plage(1, '14:00', '18:00'), plage(1, '08:00', '12:00'),
      plage(2, '08:00', '12:00'), plage(2, '14:00', '18:00'),
      plage(3, '08:00', '12:00'),
    ]
    expect(resumeHoraires(plages)).toBe('Lun–Mar 8h–12h, 14h–18h · Mer 8h–12h')
  })

  it('ne dépend pas de l’ordre des lignes en base', () => {
    const plages = semaine([5, 3, 1, 4, 2])
    expect(resumeHoraires(plages)).toBe('Lun–Ven 8h–18h')
  })

  it('compare « 08:00 » et « 08:00:00 » comme identiques', () => {
    expect(resumeHoraires([plage(1, '08:00:00', '18:00:00'), plage(2, '08:00', '18:00')])).toBe('Lun–Mar 8h–18h')
  })

  it('aucune plage : le dit', () => {
    expect(resumeHoraires([])).toBe('Aucun horaire')
  })
})

describe('listeJours', () => {
  it('écrit une liste lisible, dans l’ordre lundi → dimanche', () => {
    expect(listeJours([])).toBe('')
    expect(listeJours([3])).toBe('mercredi')
    expect(listeJours([2, 1])).toBe('lundi et mardi')
    expect(listeJours([0, 3, 1])).toBe('lundi, mercredi et dimanche')
  })
})

describe('erreurPlage', () => {
  it('accepte une plage dont la fin est après le début', () => {
    expect(erreurPlage('08:00', '18:00')).toBeNull()
    expect(erreurPlage('08:00', '08:30')).toBeNull()
  })

  it('refuse une fin égale ou antérieure au début, avec la phrase de l’écran du site', () => {
    expect(erreurPlage('18:00', '08:00')).toBe(ERREUR_FIN_AVANT_DEBUT)
    expect(erreurPlage('08:00', '08:00')).toBe(ERREUR_FIN_AVANT_DEBUT)
    expect(ERREUR_FIN_AVANT_DEBUT).toMatch(/fin doit être après/)
  })

  it('refuse une heure illisible plutôt que de la laisser partir', () => {
    expect(erreurPlage('', '18:00')).toBe(ERREUR_FIN_AVANT_DEBUT)
  })
})

describe('seRecouvrent / seTouchent', () => {
  const b = (d: string, f: string) => ({ start_time: d, end_time: f })

  it('deux plages qui se recouvrent', () => {
    expect(seRecouvrent(b('08:00', '12:00'), b('10:00', '14:00'))).toBe(true)
    expect(seRecouvrent(b('08:00', '18:00'), b('10:00', '12:00'))).toBe(true)
    expect(seRecouvrent(b('10:00', '14:00'), b('08:00', '12:00'))).toBe(true)
  })

  it('deux plages qui se touchent ne se recouvrent pas', () => {
    expect(seRecouvrent(b('08:00', '12:00'), b('12:00', '14:00'))).toBe(false)
    expect(seRecouvrent(b('12:00', '14:00'), b('08:00', '12:00'))).toBe(false)
  })

  it('deux plages séparées ne se recouvrent pas', () => {
    expect(seRecouvrent(b('08:00', '12:00'), b('14:00', '18:00'))).toBe(false)
  })

  it('reconnaît deux plages qui se touchent, dans les deux sens', () => {
    expect(seTouchent(b('08:00', '12:00'), b('12:00', '14:00'))).toBe(true)
    expect(seTouchent(b('12:00', '14:00'), b('08:00', '12:00'))).toBe(true)
    expect(seTouchent(b('08:00', '12:00'), b('12:30', '14:00'))).toBe(false)
    expect(seTouchent(b('08:00', '12:00'), b('10:00', '14:00'))).toBe(false)
  })

  it('une heure illisible n’est ni un recouvrement ni un contact', () => {
    expect(seRecouvrent(b('x', '12:00'), b('08:00', '12:00'))).toBe(false)
    expect(seTouchent(b('x', '12:00'), b('12:00', '14:00'))).toBe(false)
  })
})

describe('analyserAjout', () => {
  const existantes = [plage(1, '08:00', '12:00'), plage(2, '09:00', '12:00')]

  it('prêt : un jour libre, une plage cohérente', () => {
    const a = analyserAjout([3], '08:00', '18:00', existantes)
    expect(a).toEqual({ erreurHeures: null, conflits: [], contacts: [], pret: true })
  })

  it('aucun jour coché : pas prêt, sans message d’erreur', () => {
    const a = analyserAjout([], '08:00', '18:00', existantes)
    expect(a.pret).toBe(false)
    expect(a.erreurHeures).toBeNull()
    expect(a.conflits).toEqual([])
  })

  it('fin avant début : bloque, et ne cherche pas de conflit sur des heures incohérentes', () => {
    const a = analyserAjout([1], '18:00', '08:00', existantes)
    expect(a.erreurHeures).toBe(ERREUR_FIN_AVANT_DEBUT)
    expect(a.conflits).toEqual([])
    expect(a.pret).toBe(false)
  })

  it('chevauchement sur un seul jour : « Chevauche 8h–12h », bloque', () => {
    const a = analyserAjout([1], '10:00', '14:00', existantes)
    expect(a.conflits).toEqual(['Chevauche 8h–12h'])
    expect(a.pret).toBe(false)
  })

  it('chevauchement avec plusieurs jours cochés : nomme le jour, les autres jours sont libres', () => {
    const a = analyserAjout([1, 3], '10:00', '14:00', existantes)
    expect(a.conflits).toEqual(['Lundi : chevauche 8h–12h'])
    expect(a.pret).toBe(false)
  })

  it('cite toutes les plages recouvertes', () => {
    const a = analyserAjout([1], '07:00', '19:00', [plage(1, '08:00', '12:00'), plage(1, '14:00', '18:00')])
    expect(a.conflits).toEqual(['Chevauche 8h–12h, 14h–18h'])
  })

  it('un jour fermé ne chevauche rien, même si un autre jour a des plages à la même heure', () => {
    expect(analyserAjout([3], '08:00', '12:00', existantes).pret).toBe(true)
  })

  it('plage qui touche une plage existante : prévient sans bloquer', () => {
    const a = analyserAjout([1], '12:00', '14:00', existantes)
    expect(a.pret).toBe(true)
    expect(a.conflits).toEqual([])
    expect(a.contacts).toHaveLength(1)
    expect(a.contacts[0]).toContain('Touche 8h–12h')
    expect(a.contacts[0]).toContain('enjamber 12h')
  })

  it('contact dans l’autre sens : la limite commune est le début de la plage existante', () => {
    const a = analyserAjout([1], '06:00', '08:00', existantes)
    expect(a.pret).toBe(true)
    expect(a.contacts[0]).toContain('enjamber 8h')
  })

  it('contact avec plusieurs jours : nomme le jour', () => {
    const a = analyserAjout([1, 2], '12:00', '14:00', existantes)
    expect(a.contacts).toHaveLength(2)
    expect(a.contacts[0]).toMatch(/^Lundi : touche 8h–12h/)
    expect(a.contacts[1]).toMatch(/^Mardi : touche 9h–12h/)
  })

  it('un recouvrement l’emporte sur un contact : une seule cause affichée pour ce jour', () => {
    const a = analyserAjout([1], '08:00', '18:00', [plage(1, '08:00', '12:00'), plage(1, '18:00', '20:00')])
    expect(a.conflits).toEqual(['Chevauche 8h–12h'])
    expect(a.contacts).toEqual([])
  })
})

describe('phraseEchecAjout', () => {
  const ok = (jour: number): ResultatJour => ({ jour, ok: true, plage: { id: `a-${jour}`, washer_id: 'w', day_of_week: jour, start_time: '08:00', end_time: '18:00' } as Availability })
  const ko = (jour: number, message = 'Enregistrement impossible. Réessayez dans un instant.'): ResultatJour => ({ jour, ok: false, message })

  it('rien à dire quand tout a réussi : un succès ne s’annonce pas comme une erreur', () => {
    expect(phraseEchecAjout([ok(1), ok(2)])).toBeNull()
    expect(phraseEchecAjout([])).toBeNull()
  })

  it('dit quels jours ont été créés et lesquels ont échoué', () => {
    expect(phraseEchecAjout([ok(1), ok(2), ko(3), ko(4)])).toBe(
      'Ajouté : lundi et mardi. Pas ajouté : mercredi et jeudi. Enregistrement impossible. Réessayez dans un instant.',
    )
  })

  it('rien de créé : ne parle que des échecs', () => {
    expect(phraseEchecAjout([ko(1)])).toBe('Pas ajouté : lundi. Enregistrement impossible. Réessayez dans un instant.')
  })

  it('un seul échec parmi cinq : il est nommé, jamais noyé', () => {
    const phrase = phraseEchecAjout([ok(1), ok(2), ok(3), ko(4), ok(5)])
    expect(phrase).toContain('Ajouté : lundi, mardi, mercredi et vendredi.')
    expect(phrase).toContain('Pas ajouté : jeudi.')
  })

  it('reprend chaque message distinct une seule fois', () => {
    const phrase = phraseEchecAjout([ko(1, 'A.'), ko(2, 'A.'), ko(3, 'B.')])
    expect(phrase).toBe('Pas ajouté : lundi, mardi et mercredi. A. B.')
  })
})

describe('congesAVenir', () => {
  const c = (start: string, end: string) => ({ start_date: start, end_date: end })

  it('garde ce qui est en cours ou à venir, le plus proche d’abord', () => {
    const liste = [c('2026-10-10', '2026-10-12'), c('2026-09-01', '2026-09-10'), c('2026-09-20', '2026-09-30'), c('2026-09-24', '2026-09-24')]
    expect(congesAVenir(liste, '2026-09-24').map(x => x.start_date)).toEqual(['2026-09-20', '2026-09-24', '2026-10-10'])
  })

  it('une période qui se termine aujourd’hui est encore en cours', () => {
    expect(congesAVenir([c('2026-09-20', '2026-09-24')], '2026-09-24')).toHaveLength(1)
    expect(congesAVenir([c('2026-09-20', '2026-09-23')], '2026-09-24')).toHaveLength(0)
  })
})

describe('erreurPeriode', () => {
  it('un jour, ou plusieurs, du début à la fin', () => {
    expect(erreurPeriode('2026-09-24', '2026-09-24')).toBeNull()
    expect(erreurPeriode('2026-09-24', '2026-10-02')).toBeNull()
  })

  it('fin avant début : dit pourquoi le bouton est grisé (le hook, lui, ne montrerait rien)', () => {
    expect(erreurPeriode('2026-09-24', '2026-09-20')).toBe(ERREUR_FIN_DATE_AVANT_DEBUT)
  })

  it('une date effacée est signalée', () => {
    expect(erreurPeriode('', '2026-09-20')).toBe(ERREUR_DATES_MANQUANTES)
    expect(erreurPeriode('2026-09-20', '')).toBe(ERREUR_DATES_MANQUANTES)
  })
})

describe('unSeulALaFois', () => {
  it('un second appel pendant le premier est ignoré : l’action ne part qu’une fois', async () => {
    let liberer: (v: string) => void = () => {}
    const action = vi.fn(() => new Promise<string>(resolve => { liberer = resolve }))
    const garde = unSeulALaFois(action)

    const premier = garde()
    const second = garde()
    expect(await second).toBeNull()
    expect(action).toHaveBeenCalledTimes(1)

    liberer('fait')
    expect(await premier).toBe('fait')
  })

  it('une fois terminée, l’action peut repartir', async () => {
    const action = vi.fn(async (n: number) => n * 2)
    const garde = unSeulALaFois(action)
    expect(await garde(1)).toBe(2)
    expect(await garde(2)).toBe(4)
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('libère le verrou même si l’action lève : un échec ne bloque pas définitivement', async () => {
    const action = vi.fn().mockRejectedValueOnce(new Error('boum')).mockResolvedValueOnce('ok')
    const garde = unSeulALaFois(action)
    await expect(garde()).rejects.toThrow('boum')
    expect(await garde()).toBe('ok')
  })
})
