import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  annoncerApresRetour, confirmerEnvoi, fermerConfirmation, lireConfirmation, ATTENTE_RETOUR_MAX_MS,
} from './confirmationEnvoi'

// Faux `document` : seul ce que le module lit (état de visibilité + écouteurs).
function fauxDocument() {
  const ecouteurs = new Set<() => void>()
  const doc = {
    visibilityState: 'visible' as 'visible' | 'hidden',
    addEventListener: (_: string, f: () => void) => { ecouteurs.add(f) },
    removeEventListener: (_: string, f: () => void) => { ecouteurs.delete(f) },
    changer(etat: 'visible' | 'hidden') { doc.visibilityState = etat; [...ecouteurs].forEach(f => f()) },
    nb: () => ecouteurs.size,
  }
  return doc
}

describe('confirmationEnvoi', () => {
  let doc: ReturnType<typeof fauxDocument>
  beforeEach(() => {
    vi.useFakeTimers()
    doc = fauxDocument()
    vi.stubGlobal('document', doc)
    fermerConfirmation()
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('affiche puis ferme une confirmation directe', () => {
    confirmerEnvoi({ titre: 'SMS envoyé', detail: 'À vous' })
    expect(lireConfirmation()).toMatchObject({ titre: 'SMS envoyé', detail: 'À vous' })
    fermerConfirmation()
    expect(lireConfirmation()).toBeNull()
  })

  it('n’affiche rien au tap : seulement au retour dans l’app', () => {
    annoncerApresRetour({ titre: 'Message envoyé' })
    expect(lireConfirmation()).toBeNull()
    doc.changer('hidden')
    vi.advanceTimersByTime(1000)
    expect(lireConfirmation()).toBeNull()
    doc.changer('visible')
    expect(lireConfirmation()).toBeNull()
    vi.advanceTimersByTime(400)
    expect(lireConfirmation()?.titre).toBe('Message envoyé')
    expect(doc.nb()).toBe(0)
  })

  it('ignore un retour sans départ, et abandonne après le délai maximal', () => {
    annoncerApresRetour({ titre: 'A' })
    doc.changer('visible')
    vi.advanceTimersByTime(1000)
    expect(lireConfirmation()).toBeNull()
    vi.advanceTimersByTime(ATTENTE_RETOUR_MAX_MS)
    expect(doc.nb()).toBe(0)
    doc.changer('hidden'); doc.changer('visible'); vi.advanceTimersByTime(1000)
    expect(lireConfirmation()).toBeNull()
  })

  it('un nouveau tap remplace l’attente précédente', () => {
    annoncerApresRetour({ titre: 'Premier' })
    annoncerApresRetour({ titre: 'Second' })
    expect(doc.nb()).toBe(1)
    doc.changer('hidden'); doc.changer('visible'); vi.advanceTimersByTime(400)
    expect(lireConfirmation()?.titre).toBe('Second')
  })
})
