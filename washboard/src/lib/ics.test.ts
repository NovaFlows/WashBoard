import { describe, it, expect } from 'vitest'
import { buildIcs } from './ics'

describe('buildIcs', () => {
  it('produit un VEVENT avec début, fin et résumé corrects', () => {
    const ics = buildIcs({
      uid: 'abc-123@washboard.fr',
      title: 'Lavage Complet — Brillance Mobile',
      location: '12 rue Mercière, 69002 Lyon',
      description: 'Réglez 85€ sur place.',
      start: new Date('2026-10-08T12:00:00.000Z'),
      durationMinutes: 90,
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).toContain('UID:abc-123@washboard.fr')
    expect(ics).toContain('DTSTART:20261008T120000Z')
    // 12h00 + 90 min = 13h30
    expect(ics).toContain('DTEND:20261008T133000Z')
    expect(ics).toContain('SUMMARY:Lavage Complet — Brillance Mobile')
    expect(ics).toContain('LOCATION:12 rue Mercière\\, 69002 Lyon')
    expect(ics).toContain('DESCRIPTION:Réglez 85€ sur place.')
  })

  it('utilise des fins de ligne CRLF, comme l’exige la RFC 5545', () => {
    const ics = buildIcs({
      uid: 'x',
      title: 'Lavage',
      start: new Date('2026-10-08T12:00:00.000Z'),
      durationMinutes: 60,
    })
    const lignes = ics.split('\n')
    // Chaque ligne (sauf la dernière, qui n'est suivie d'aucun retour) se
    // termine par \r : c'est bien \r\n qui sépare les lignes, pas \n seul.
    for (const l of lignes.slice(0, -1)) expect(l.endsWith('\r')).toBe(true)
  })

  it('omet LOCATION et DESCRIPTION quand ils sont absents', () => {
    const ics = buildIcs({
      uid: 'x',
      title: 'Lavage',
      start: new Date('2026-10-08T12:00:00.000Z'),
      durationMinutes: 60,
    })
    expect(ics).not.toContain('LOCATION')
    expect(ics).not.toContain('DESCRIPTION')
  })

  it('échappe les virgules, points-virgules et retours à la ligne du texte libre', () => {
    const ics = buildIcs({
      uid: 'x',
      title: 'Lavage; complet, intérieur',
      description: 'Ligne 1\nLigne 2',
      start: new Date('2026-10-08T12:00:00.000Z'),
      durationMinutes: 30,
    })
    expect(ics).toContain('SUMMARY:Lavage\\; complet\\, intérieur')
    expect(ics).toContain('DESCRIPTION:Ligne 1\\nLigne 2')
  })

  it('ne produit jamais une durée négative même si durationMinutes est négatif', () => {
    const ics = buildIcs({
      uid: 'x',
      title: 'Lavage',
      start: new Date('2026-10-08T12:00:00.000Z'),
      durationMinutes: -30,
    })
    // DTEND ne doit pas être AVANT DTSTART
    expect(ics).toContain('DTEND:20261008T120000Z')
  })
})
