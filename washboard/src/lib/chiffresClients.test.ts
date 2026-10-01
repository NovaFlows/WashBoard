import { describe, it, expect } from 'vitest'
import { reservationsDeLaPeriode, statsClients } from './chiffresClients'
import type { ClientBooking } from './clientProfile'
import type { PeriodeChiffres } from './chiffresPeriode'

const P = (type: PeriodeChiffres['type'], ref: string): PeriodeChiffres => ({ type, ref })
const NOW = new Date('2026-09-24T12:00:00Z')

let n = 0
const b = (over: Partial<ClientBooking> & { email: string; at: string }): ClientBooking => ({
  id: `b${++n}`,
  client_name: over.client_name ?? over.email.split('@')[0],
  client_email: over.email,
  client_phone: '',
  address: '',
  scheduled_at: over.at,
  status: 'done',
  closed_late: false,
  booked_price: 50,
  is_professional: false,
  company_name: null,
  services: { name: 'Lavage', price: 40, duration_minutes: 60 },
  ...over,
})

const BOOKINGS: ClientBooking[] = [
  b({ email: 'julie@x.fr', at: '2026-09-10T08:00:00Z', booked_price: 60 }),
  b({ email: 'julie@x.fr', at: '2026-09-20T08:00:00Z', booked_price: 40 }),
  b({ email: 'garage@x.fr', at: '2026-09-12T08:00:00Z', booked_price: 300, is_professional: true, company_name: 'Garage Renault' }),
  b({ email: 'paul@x.fr', at: '2026-09-15T08:00:00Z', booked_price: null }), // → prix de la prestation : 40
  b({ email: 'nina@x.fr', at: '2026-09-16T08:00:00Z', status: 'cancelled' }),
  b({ email: 'sam@x.fr', at: '2026-09-25T08:00:00Z', status: 'confirmed', booked_price: 70 }), // à venir mais confirmé : compte (définition CRM)
  b({ email: 'julie@x.fr', at: '2026-08-05T08:00:00Z', booked_price: 999 }), // août
  b({ email: 'old@x.fr', at: '2025-03-05T08:00:00Z', booked_price: 999 }),
]

describe('reservationsDeLaPeriode', () => {
  it('ne garde que les rendez-vous de la période (jours de Paris)', () => {
    expect(reservationsDeLaPeriode(BOOKINGS, P('mois', '2026-09-24'))).toHaveLength(6)
    expect(reservationsDeLaPeriode(BOOKINGS, P('mois', '2026-08-24'))).toHaveLength(1)
  })

  it('00 h 30 le 1er septembre à Paris est en septembre', () => {
    const l = [b({ email: 'a@x.fr', at: '2026-08-31T22:30:00Z' })]
    expect(reservationsDeLaPeriode(l, P('mois', '2026-09-10'))).toHaveLength(1)
    expect(reservationsDeLaPeriode(l, P('mois', '2026-08-10'))).toHaveLength(0)
  })
})

describe('statsClients', () => {
  it('septembre, tous : clients actifs, CA (confirmé + terminé) et valeur moyenne', () => {
    const s = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'tous', NOW)
    // julie 100, garage 300, paul 40 (prix de la prestation), sam 70 ; nina annulée : pas active
    expect(s.actifs.map(c => c.email).sort()).toEqual(['garage@x.fr', 'julie@x.fr', 'paul@x.fr', 'sam@x.fr'])
    expect(s.totalCA).toBe(510)
    expect(s.valeurMoyenne).toBe(127.5)
    expect(s.meilleurs.map(c => c.email)).toEqual(['garage@x.fr', 'julie@x.fr', 'sam@x.fr', 'paul@x.fr'])
    expect(s.nbReservations).toBe(6)
  })

  it('la période change les chiffres : août ne compte que julie (999)', () => {
    const s = statsClients(BOOKINGS, P('mois', '2026-08-24'), 'tous', NOW)
    expect(s.actifs).toHaveLength(1)
    expect(s.valeurMoyenne).toBe(999)
  })

  it('pros : uniquement les réservations passées en professionnel', () => {
    const s = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'pros', NOW)
    expect(s.actifs.map(c => c.email)).toEqual(['garage@x.fr'])
    expect(s.totalCA).toBe(300)
    expect(s.valeurMoyenne).toBe(300)
  })

  it('particuliers : le complément des pros', () => {
    const s = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'particuliers', NOW)
    expect(s.actifs.map(c => c.email).sort()).toEqual(['julie@x.fr', 'paul@x.fr', 'sam@x.fr'])
    expect(s.totalCA).toBe(210)
  })

  it('tous = particuliers + pros', () => {
    const t = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'tous', NOW)
    const a = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'particuliers', NOW)
    const p = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'pros', NOW)
    expect(a.totalCA + p.totalCA).toBe(t.totalCA)
    expect(a.actifs.length + p.actifs.length).toBe(t.actifs.length)
  })

  it('la part des pros ignore le filtre (elle n\'aurait pas de sens à 100 %)', () => {
    const tous = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'tous', NOW)
    const pros = statsClients(BOOKINGS, P('mois', '2026-09-24'), 'pros', NOW)
    expect(tous.partCaPro).toBe(59)  // 300 / 510
    expect(tous.partRdvPro).toBe(20) // 1 sur 5 rendez-vous comptés
    expect(pros.partCaPro).toBe(tous.partCaPro)
  })

  it('période sans client : aucun actif, moyenne à 0, sans division par zéro', () => {
    const s = statsClients(BOOKINGS, P('mois', '2024-01-10'), 'tous', NOW)
    expect(s.actifs).toEqual([])
    expect(s.valeurMoyenne).toBe(0)
    expect(s.meilleurs).toEqual([])
    expect(s.partCaPro).toBe(0)
    expect(s.partRdvPro).toBe(0)
  })

  it('aucune réservation du tout', () => {
    const s = statsClients([], P('semaine', '2026-09-24'), 'pros', NOW)
    expect(s.nbReservations).toBe(0)
    expect(s.valeurMoyenne).toBe(0)
  })

  it('le classement est limité à cinq clients', () => {
    const beaucoup = Array.from({ length: 8 }, (_, i) => b({ email: `c${i}@x.fr`, at: '2026-09-10T08:00:00Z', booked_price: 10 + i }))
    expect(statsClients(beaucoup, P('mois', '2026-09-24'), 'tous', NOW).meilleurs).toHaveLength(5)
  })
})
