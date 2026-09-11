// Garde-fou de l'incident du 2026-09-11.
//
// Un laveur a reçu la notification « nouvelle réservation … à 06:00 » pour un
// rendez-vous correctement enregistré à 8 h. La réservation était juste ;
// l'AFFICHAGE était faux. Notifications et e-mails sont calculés sur le
// serveur, qui tourne en UTC, et formataient l'heure sans fuseau.
//
// Ces tests doivent passer quel que soit le fuseau de la machine qui les
// exécute — c'est précisément ce qu'ils vérifient. Pour reproduire la prod :
//   TZ=UTC npx vitest run src/lib/fuseau.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { formatHeure, formatHeureCompacte, FUSEAU } from './dateUtils'

describe('heure d’un rendez-vous', () => {
  it('un rendez-vous de 8 h reste à 8 h, même sur un serveur en UTC', () => {
    // 06:00 UTC = 08:00 à Paris en septembre (heure d'été, UTC+2).
    // C'est l'instant exact de la réservation de l'incident.
    const rdv = new Date('2026-09-10T06:00:00Z')
    expect(formatHeure(rdv)).toBe('08:00')
    expect(formatHeureCompacte(rdv)).toBe('8h')
  })

  it('tient aussi en heure d’hiver, où l’écart n’est que d’une heure', () => {
    // Un correctif qui aurait ajouté « + 2 h » en dur passerait l'été et
    // échouerait en décembre.
    expect(formatHeure(new Date('2026-12-10T07:00:00Z'))).toBe('08:00')
  })

  it('annonce le bon JOUR près de minuit, où l’UTC est encore la veille', () => {
    // 22:30 UTC le mercredi 9 = 0 h 30 le jeudi 10 à Paris.
    const rdv = new Date('2026-09-09T22:30:00Z')
    const jour = rdv.toLocaleDateString('fr-FR', {
      timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long',
    })
    expect(jour).toBe('jeudi 10 septembre')
    expect(formatHeure(rdv)).toBe('00:30')
  })
})

// ── Aucun formatage serveur ne doit dépendre de la machine ──────────────────
//
// Le bug a vécu quatre mois avec des tests verts. Ce test-ci ne vérifie pas
// une valeur : il lit le code serveur et refuse tout formatage de date qui ne
// fixe pas son fuseau. Le prochain oubli échouera ici, pas chez un laveur.

const DOSSIERS_SERVEUR = ['src/app/api', 'src/lib/email']

function fichiersSource(dossier: string): string[] {
  const racine = path.resolve(process.cwd(), dossier)
  const trouves: string[] = []
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) parcourir(p)
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) trouves.push(p)
    }
  }
  parcourir(racine)
  return trouves
}

/** Texte complet de l'appel, parenthèses équilibrées : les options tiennent
 *  parfois sur plusieurs lignes. */
function appel(src: string, ouvrante: number): string {
  let profondeur = 0
  for (let i = ouvrante; i < src.length; i++) {
    if (src[i] === '(') profondeur++
    else if (src[i] === ')' && --profondeur === 0) return src.slice(ouvrante, i + 1)
  }
  return src.slice(ouvrante)
}

describe('formatage des dates côté serveur', () => {
  it('fixe toujours le fuseau, sans jamais le laisser à la machine', () => {
    const fichiers = DOSSIERS_SERVEUR.flatMap(fichiersSource)
    // Sans ce plancher, un chemin faux ferait scanner zéro fichier et le test
    // passerait sans rien vérifier.
    expect(fichiers.length).toBeGreaterThan(5)

    const fautes: string[] = []
    for (const f of fichiers) {
      const src = fs.readFileSync(f, 'utf8')
      const re = /\.toLocale(?:Date|Time)String\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const texte = appel(src, m.index + m[0].length - 1)
        if (!texte.includes('timeZone')) {
          const ligne = src.slice(0, m.index).split('\n').length
          fautes.push(`${path.relative(process.cwd(), f)}:${ligne}`)
        }
      }
    }
    expect(fautes).toEqual([])
  })
})
