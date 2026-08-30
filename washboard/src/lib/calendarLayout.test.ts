import { describe, it, expect } from 'vitest'
import {
  getWeekStart, buildGrid, layoutDayBookings, isSameDay, dayKey, formatHeure,
  type LayoutBooking,
} from './calendarLayout'

const rdv = (heure: string, minutes = 60, vehicules = 1): LayoutBooking => ({
  scheduled_at: `2026-09-07T${heure}:00:00.000Z`,
  vehicle_count: vehicules,
  services: { duration_minutes: minutes },
  selected_addons: null,
})

describe('getWeekStart', () => {
  it('renvoie le lundi de la semaine, à minuit', () => {
    // 9 septembre 2026 est un mercredi.
    const lundi = getWeekStart(new Date(2026, 8, 9, 15, 30))
    expect(lundi.getDay()).toBe(1)
    expect(lundi.getDate()).toBe(7)
    expect(lundi.getHours()).toBe(0)
    expect(lundi.getMinutes()).toBe(0)
  })

  it('un lundi se renvoie lui-même', () => {
    expect(getWeekStart(new Date(2026, 8, 7, 9, 0)).getDate()).toBe(7)
  })

  it('un dimanche appartient à la semaine qui commence le lundi précédent', () => {
    // Le piège classique : en JS, dimanche vaut 0 et non 7.
    const lundi = getWeekStart(new Date(2026, 8, 13))
    expect(lundi.getDay()).toBe(1)
    expect(lundi.getDate()).toBe(7)
  })

  it('ne modifie pas la date reçue', () => {
    const origine = new Date(2026, 8, 9, 15, 30)
    getWeekStart(origine)
    expect(origine.getDate()).toBe(9)
    expect(origine.getHours()).toBe(15)
  })
})

describe('buildGrid', () => {
  it('renvoie toujours 42 cases pour une hauteur de grille stable', () => {
    for (let mois = 0; mois < 12; mois++) {
      expect(buildGrid(2026, mois)).toHaveLength(42)
    }
  })

  it('commence le mois à la bonne colonne (lundi en premier)', () => {
    // 1er septembre 2026 est un mardi → une case vide avant lui.
    const grille = buildGrid(2026, 8)
    expect(grille[0]).toBeNull()
    expect(grille[1]?.getDate()).toBe(1)
  })

  it('contient tous les jours du mois', () => {
    const grille = buildGrid(2026, 8) // septembre : 30 jours
    expect(grille.filter(Boolean)).toHaveLength(30)
  })

  it('gère février d’une année bissextile', () => {
    expect(buildGrid(2024, 1).filter(Boolean)).toHaveLength(29)
    expect(buildGrid(2026, 1).filter(Boolean)).toHaveLength(28)
  })

  it('gère un mois commençant un dimanche sans décaler la grille', () => {
    // 1er février 2026 est un dimanche → 6 cases vides avant lui.
    const grille = buildGrid(2026, 1)
    expect(grille.slice(0, 6).every(c => c === null)).toBe(true)
    expect(grille[6]?.getDate()).toBe(1)
  })
})

describe('layoutDayBookings', () => {
  it('ne renvoie rien pour une journée vide', () => {
    expect(layoutDayBookings([])).toEqual([])
  })

  it('un rendez-vous seul occupe toute la largeur', () => {
    const [placé] = layoutDayBookings([rdv('08')])
    expect(placé.col).toBe(0)
    expect(placé.totalCols).toBe(1)
  })

  it('deux rendez-vous qui ne se chevauchent pas restent en colonne unique', () => {
    const placés = layoutDayBookings([rdv('08', 60), rdv('10', 60)])
    expect(placés.map(p => p.col)).toEqual([0, 0])
    expect(placés.map(p => p.totalCols)).toEqual([1, 1])
  })

  it('deux rendez-vous simultanés se partagent la largeur', () => {
    const placés = layoutDayBookings([rdv('08', 120), rdv('09', 60)])
    expect(placés.map(p => p.col).sort()).toEqual([0, 1])
    expect(placés.every(p => p.totalCols === 2)).toBe(true)
  })

  it('un chevauchement du matin ne rétrécit pas les rendez-vous de l’après-midi', () => {
    // Le calcul se fait sur les rendez-vous réellement simultanés : sinon
    // celui de 14h serait affiché sur une demi-largeur pour rien.
    const placés = layoutDayBookings([rdv('08', 120), rdv('09', 60), rdv('14', 60)])
    const aprèsMidi = placés.find(p => p.scheduled_at.includes('T14'))
    expect(aprèsMidi?.totalCols).toBe(1)
  })

  it('réutilise une colonne libérée plutôt que d’en ouvrir une nouvelle', () => {
    const placés = layoutDayBookings([rdv('08', 60), rdv('08', 60), rdv('09', 60)])
    // Les deux premiers occupent les colonnes 0 et 1 ; le troisième commence
    // quand ils sont finis et doit retomber en colonne 0.
    expect(placés.find(p => p.scheduled_at.includes('T09'))?.col).toBe(0)
  })

  it('tient compte du nombre de véhicules dans la durée occupée', () => {
    // 60 min × 2 véhicules = 120 min : le second rendez-vous chevauche donc
    // le premier alors qu'il commencerait après si on ignorait le compte.
    const placés = layoutDayBookings([rdv('08', 60, 2), rdv('09', 60, 1)])
    expect(placés.every(p => p.totalCols === 2)).toBe(true)
  })

  it('tient compte de la durée des options', () => {
    const avecOption: LayoutBooking = {
      scheduled_at: '2026-09-07T08:00:00.000Z',
      vehicle_count: 1,
      services: { duration_minutes: 60 },
      selected_addons: [{ duration_minutes: 60 }],
    }
    const placés = layoutDayBookings([avecOption, rdv('09', 30)])
    expect(placés.every(p => p.totalCols === 2)).toBe(true)
  })

  it('trie les rendez-vous par heure de début quelle que soit l’entrée', () => {
    const placés = layoutDayBookings([rdv('14'), rdv('08'), rdv('11')])
    expect(placés.map(p => p.scheduled_at.slice(11, 13))).toEqual(['08', '11', '14'])
  })

  it('sans service, retombe sur une durée d’une heure', () => {
    const sansService: LayoutBooking = { scheduled_at: '2026-09-07T08:00:00.000Z' }
    const placés = layoutDayBookings([sansService, rdv('09', 60)])
    // 8h + 1h par défaut se termine à 9h pile : pas de chevauchement.
    expect(placés.every(p => p.totalCols === 1)).toBe(true)
  })

  it('trois rendez-vous simultanés donnent trois colonnes', () => {
    const placés = layoutDayBookings([rdv('08', 180), rdv('08', 180), rdv('08', 180)])
    expect(placés.map(p => p.col).sort()).toEqual([0, 1, 2])
    expect(placés.every(p => p.totalCols === 3)).toBe(true)
  })
})

describe('isSameDay', () => {
  it('reconnaît deux moments du même jour', () => {
    expect(isSameDay(new Date(2026, 8, 7, 8), new Date(2026, 8, 7, 23))).toBe(true)
  })
  it('distingue deux jours consécutifs', () => {
    expect(isSameDay(new Date(2026, 8, 7), new Date(2026, 8, 8))).toBe(false)
  })
  it('distingue le même quantième dans deux mois différents', () => {
    expect(isSameDay(new Date(2026, 8, 7), new Date(2026, 9, 7))).toBe(false)
  })
  it('distingue le même jour dans deux années différentes', () => {
    expect(isSameDay(new Date(2025, 8, 7), new Date(2026, 8, 7))).toBe(false)
  })
})

describe('dayKey', () => {
  it('produit la même clé pour deux heures du même jour', () => {
    expect(dayKey(new Date(2026, 8, 7, 3))).toBe(dayKey(new Date(2026, 8, 7, 22)))
  })
  it('produit des clés différentes pour des jours différents', () => {
    expect(dayKey(new Date(2026, 8, 7))).not.toBe(dayKey(new Date(2026, 8, 8)))
  })
})

describe('formatHeure', () => {
  it('affiche l’heure sur deux chiffres', () => {
    expect(formatHeure(new Date(2026, 8, 7, 9, 5))).toBe('09:05')
  })
  it('utilise le format 24 h', () => {
    expect(formatHeure(new Date(2026, 8, 7, 14, 30))).toBe('14:30')
  })
})
