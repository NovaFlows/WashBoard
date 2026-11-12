import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MESSAGE_LIEU_ADAPTE, afficherMentionLieuAdapte, estAuCentre } from './lieuAdapte'
import MentionLieuAdapte from '@/components/booking/MentionLieuAdapte'

const centreLesDeux = { adresse: '1 rue du Test', domicile: true }
const centreSeul = { adresse: '1 rue du Test', domicile: false }

describe('estAuCentre', () => {
  it('lieu « centre » choisi : oui', () => expect(estAuCentre(centreLesDeux, 'centre')).toBe(true))
  it('centre proposé avec le domicile, lieu pas encore choisi : non', () => expect(estAuCentre(centreLesDeux, null)).toBe(false))
  it('domicile choisi : non', () => expect(estAuCentre(centreLesDeux, 'domicile')).toBe(false))
  it('centre sans domicile : oui dès l’étape prestation', () => expect(estAuCentre(centreSeul, undefined)).toBe(true))
  it('pas de centre : non', () => expect(estAuCentre(null, undefined)).toBe(false))
})

describe('afficherMentionLieuAdapte', () => {
  it('visible si activée et hors centre', () => expect(afficherMentionLieuAdapte({ lieu_adapte: true }, false)).toBe(true))
  it('masquée si désactivée', () => expect(afficherMentionLieuAdapte({ lieu_adapte: false }, false)).toBe(false))
  it('masquée si la colonne est absente', () => expect(afficherMentionLieuAdapte({}, false)).toBe(false))
  it('masquée pour une prestation faite seulement en centre', () => expect(afficherMentionLieuAdapte({ lieu_adapte: true, lieu_restreint: 'centre' }, false)).toBe(false))
  it('visible pour une prestation faite seulement en déplacement', () => expect(afficherMentionLieuAdapte({ lieu_adapte: true, lieu_restreint: 'domicile' }, false)).toBe(true))
  it('masquée au centre auto', () => expect(afficherMentionLieuAdapte({ lieu_adapte: true }, true)).toBe(false))
})

describe('MentionLieuAdapte', () => {
  const rendu = (service: { lieu_adapte?: boolean }, auCentre: boolean) =>
    renderToStaticMarkup(createElement(MentionLieuAdapte, { service, auCentre }))

  it('affiche le texte fixe avec une icône SVG', () => {
    const html = rendu({ lieu_adapte: true }, false)
    expect(html).toContain(MESSAGE_LIEU_ADAPTE)
    expect(html).toContain('<svg')
    expect(html).not.toContain('input')
  })
  it('ne rend rien si désactivée', () => expect(rendu({ lieu_adapte: false }, false)).toBe(''))
  it('ne rend rien au centre auto', () => expect(rendu({ lieu_adapte: true }, true)).toBe(''))
})
