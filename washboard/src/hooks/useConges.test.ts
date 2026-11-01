import { describe, it, expect } from 'vitest'
import { avisRendezVousTouches, corpsBlocage, rendezVousTouches, type AjoutConge } from './useConges'
import { ERREUR_FIN_AVANT_DEBUT, ERREUR_JOUR_MANQUANT, MOTIFS_BLOCAGE, erreurBlocage, plageBloquee } from '@/lib/horaires'

const plage: AjoutConge = { start: '2026-11-09', end: '2026-11-09', label: 'Autre activité', team_members_off: 1, journee: false, debut: '08:00', fin: '12:00' }

describe('feuille « Bloquer une période »', () => {
  it('« Autre activité » proposé en premier', () => {
    expect(MOTIFS_BLOCAGE[0]).toBe('Autre activité')
  })

  it('une plage horaire ne couvre qu un jour, même si « Au » traînait d avant', () => {
    expect(corpsBlocage({ ...plage, end: '2026-11-15' })).toEqual({
      start_date: '2026-11-09', end_date: '2026-11-09', label: 'Autre activité', team_members_off: 1,
      start_time: '08:00', end_time: '12:00',
    })
  })

  it('toute la journée : la période, sans heures', () => {
    const corps = corpsBlocage({ ...plage, journee: true, end: '2026-11-15' })
    expect(corps).toMatchObject({ start_date: '2026-11-09', end_date: '2026-11-15' })
    expect(corps).not.toHaveProperty('start_time')
  })

  it('contrôles avant l envoi', () => {
    expect(erreurBlocage(plage)).toBeNull()
    expect(erreurBlocage({ ...plage, start: '' })).toBe(ERREUR_JOUR_MANQUANT)
    expect(erreurBlocage({ ...plage, debut: '12:00', fin: '08:00' })).toBe(ERREUR_FIN_AVANT_DEBUT)
    // Toute la journée : les heures ne comptent plus
    expect(erreurBlocage({ ...plage, journee: true, debut: '12:00', fin: '08:00' })).toBeNull()
  })

  it('libellé de la plage, rien pour une journée entière', () => {
    expect(plageBloquee({ start_time: '08:00:00', end_time: '12:30:00' })).toBe('8h–12h30')
    expect(plageBloquee({ start_time: null, end_time: null })).toBeNull()
    expect(plageBloquee({})).toBeNull()
  })
})

describe('rendez-vous déjà pris sur la plage', () => {
  // Heure locale de l'appareil, comme l'agenda.
  const rdv = (jour: string, heure: string, duree = 60, status = 'confirmed') => ({
    scheduled_at: new Date(`${jour}T${heure}:00`).toISOString(),
    status,
    services: { duration_minutes: duree },
    selected_addons: [],
    vehicle_count: 1,
  }) as unknown as Parameters<typeof rendezVousTouches>[1][number]

  it('compte ceux qui chevauchent la plage, pas les autres', () => {
    const agenda = [
      rdv('2026-11-09', '09:00'),
      rdv('2026-11-09', '07:30'),          // 7h30-8h30 : déborde sur 8h
      rdv('2026-11-09', '12:00'),          // commence à la fin : libre
      rdv('2026-11-09', '07:00'),          // 7h-8h : fini à temps
      rdv('2026-11-10', '09:00'),          // un autre jour
      rdv('2026-11-09', '10:00', 60, 'cancelled'),
    ]
    expect(rendezVousTouches(plage, agenda)).toBe(2)
  })

  it('toute la journée : tous ceux de la période', () => {
    const agenda = [rdv('2026-11-09', '17:00'), rdv('2026-11-10', '09:00'), rdv('2026-11-12', '09:00')]
    expect(rendezVousTouches({ ...plage, journee: true, end: '2026-11-10' }, agenda)).toBe(2)
  })

  it('le message prévient sans bloquer', () => {
    expect(avisRendezVousTouches(0, false)).toBeNull()
    expect(avisRendezVousTouches(1, false)).toBe('Tu as déjà 1 rendez-vous sur cette plage. Il reste maintenu.')
    expect(avisRendezVousTouches(2, true)).toBe('Tu as déjà 2 rendez-vous sur ces jours. Ils restent maintenus.')
  })
})
