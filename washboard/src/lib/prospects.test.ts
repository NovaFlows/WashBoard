import { describe, it, expect } from 'vitest'
import { appliquerEvenement, estArchive, normaliserInstagram, ongletDe, prospectsARappeler, rappelDu, resumerProspects, validerEvenement, validerSaisie, type Evenement, type Prospect } from './prospects'

const NOW = new Date('2026-11-06T12:00:00Z')

const prospect = (p: Partial<Prospect> = {}): Prospect => ({
  id: 'p1', instagram: 'laveur.exemple', nom: 'Laveur Exemple', ville: null, telephone: null, statut: 'contacte', source: 'instagram',
  message: null, reponse: null, notes: null, contacte_le: '2026-11-05T10:00:00Z', repondu_le: null, relancer_le: null,
  created_at: '2026-11-05T10:00:00Z', updated_at: '2026-11-05T10:00:00Z', ...p,
})

const ev = (v: unknown) => {
  const r = validerEvenement(v, NOW)
  if ('erreur' in r) throw new Error(r.erreur)
  return r.evenement as Evenement
}

describe('normaliserInstagram', () => {
  it('ramène les écritures courantes au nom de compte', () => {
    expect(normaliserInstagram('@Laveur.Exemple')).toBe('laveur.exemple')
    expect(normaliserInstagram('https://www.instagram.com/laveur_exemple/?hl=fr')).toBe('laveur_exemple')
    expect(normaliserInstagram(' laveur.exemple ')).toBe('laveur.exemple')
  })
  it('refuse ce qui n’est pas un compte', () => {
    expect(normaliserInstagram('mon compte')).toBeNull()
    expect(normaliserInstagram('')).toBeNull()
    expect(normaliserInstagram(42)).toBeNull()
  })
})

describe('validerEvenement', () => {
  it('lit un contact, avec la date donnée', () => {
    expect(ev({ type: 'contacte', instagram: '@Laveur.Exemple', nom: 'Laveur', le: '2026-11-06T10:15:00+01:00' })).toMatchObject({ type: 'contacte', instagram: 'laveur.exemple', le: '2026-11-06T09:15:00.000Z' })
  })
  it('date absente ou dans le futur : maintenant', () => {
    expect(ev({ type: 'reponse', instagram: 'a.b' })).toMatchObject({ le: NOW.toISOString() })
    expect(ev({ type: 'reponse', instagram: 'a.b', le: '2027-01-01' })).toMatchObject({ le: NOW.toISOString() })
  })
  it('un ajout sans Instagram passe, sans nom non', () => {
    expect(ev({ type: 'ajout', nom: 'Laveur Exemple', relancer_le: '2026-11-10' })).toMatchObject({ statut: 'en_discussion', instagram: null })
    expect(validerEvenement({ type: 'ajout' })).toHaveProperty('erreur')
    expect(validerEvenement({ type: 'ajout', nom: 'X', relancer_le: '10/11' })).toHaveProperty('erreur')
    expect(validerEvenement({ type: 'supprimer' })).toHaveProperty('erreur')
  })
})

describe('appliquerEvenement', () => {
  it('un contact inconnu crée un prospect « Contacté »', () => {
    const e = appliquerEvenement(null, ev({ type: 'contacte', instagram: 'laveur.exemple', nom: 'Laveur Exemple', message: 'Salut !', le: '2026-11-06T09:00:00Z' }))
    expect(e).toMatchObject({ creer: { statut: 'contacte', nom: 'Laveur Exemple', message: 'Salut !', contacte_le: '2026-11-06T09:00:00.000Z' } })
  })
  it('un contact déjà connu ne change pas l’étape', () => {
    expect(appliquerEvenement(prospect({ statut: 'interesse' }), ev({ type: 'contacte', instagram: 'laveur.exemple' }))).toEqual({ rien: 'déjà connu' })
  })
  it('une réponse fait passer à « À trier », un « non » qui revient aussi', () => {
    expect(appliquerEvenement(prospect(), ev({ type: 'reponse', instagram: 'laveur.exemple', reponse: 'Oui ça m’intéresse' }))).toMatchObject({ modifier: { statut: 'a_repondu', reponse: 'Oui ça m’intéresse' } })
    expect(appliquerEvenement(prospect({ statut: 'pas_interesse' }), ev({ type: 'reponse', instagram: 'laveur.exemple' }))).toMatchObject({ modifier: { statut: 'a_repondu' } })
  })
  it('une réponse ne fait pas reculer un prospect déjà trié', () => {
    const e = appliquerEvenement(prospect({ statut: 'en_discussion' }), ev({ type: 'reponse', instagram: 'laveur.exemple', reponse: 'Rappelle-moi' }))
    expect(e).toMatchObject({ modifier: { reponse: 'Rappelle-moi' } })
    expect((e as { modifier: object }).modifier).not.toHaveProperty('statut')
  })
  it('« vu » fait passer un contacté à « A vu », sans faire reculer les autres', () => {
    expect(appliquerEvenement(prospect(), ev({ type: 'vu', instagram: 'laveur.exemple' }))).toEqual({ modifier: { statut: 'a_vu' } })
    expect(appliquerEvenement(prospect({ statut: 'a_repondu' }), ev({ type: 'vu', instagram: 'laveur.exemple' }))).toHaveProperty('rien')
    expect(appliquerEvenement(prospect({ statut: 'a_vu' }), ev({ type: 'reponse', instagram: 'laveur.exemple', reponse: 'Ok' }))).toMatchObject({ modifier: { statut: 'a_repondu' } })
    expect(ongletDe(prospect({ statut: 'a_vu' }), NOW)).toBe('vu')
  })
  it('la même réponse vue deux fois ne change rien', () => {
    const p = prospect({ statut: 'a_repondu', reponse: 'Oui', repondu_le: '2026-11-06T11:00:00.000Z' })
    expect(appliquerEvenement(p, ev({ type: 'reponse', instagram: 'laveur.exemple', reponse: 'Oui', le: '2026-11-06T10:00:00Z' }))).toHaveProperty('rien')
  })
  it('un ajout complète sans écraser ce qui a été saisi', () => {
    const e = appliquerEvenement(prospect({ telephone: '06 00 00 00 00', notes: 'Vu au salon' }), ev({ type: 'ajout', nom: 'Laveur Exemple', telephone: '07 11 11 11 11', notes: 'Rappeler lundi', relancer_le: '2026-11-09' }))
    expect(e).toEqual({ modifier: { statut: 'en_discussion', relancer_le: '2026-11-09', notes: 'Vu au salon\nRappeler lundi' } })
  })
})

describe('validerSaisie', () => {
  it('création : un nom, « En discussion » par défaut', () => {
    expect(validerSaisie({ nom: 'Laveur Exemple', instagram: '@X.Y' }, true)).toEqual({ champs: { nom: 'Laveur Exemple', instagram: 'x.y', statut: 'en_discussion' } })
    expect(validerSaisie({}, true)).toHaveProperty('erreur')
  })
  it('modification : seulement les champs envoyés', () => {
    expect(validerSaisie({ statut: 'pas_interesse' }, false)).toEqual({ champs: { statut: 'pas_interesse' } })
    expect(validerSaisie({ relancer_le: '' }, false)).toEqual({ champs: { relancer_le: null } })
    expect(validerSaisie({ statut: 'perdu' }, false)).toHaveProperty('erreur')
  })
})

describe('rangement', () => {
  it('archive un message sans réponse après 30 jours', () => {
    expect(estArchive(prospect({ contacte_le: '2026-10-01T10:00:00Z' }), NOW)).toBe(true)
    expect(estArchive(prospect(), NOW)).toBe(false)
    expect(ongletDe(prospect({ contacte_le: '2026-10-01T10:00:00Z' }), NOW)).toBe('archives')
    expect(ongletDe(prospect({ statut: 'pas_interesse', contacte_le: '2026-10-01T10:00:00Z' }), NOW)).toBe('non')
  })
  it('compte les réponses à trier et les rappels dus', () => {
    const liste = [
      prospect({ statut: 'a_repondu' }),
      prospect({ statut: 'a_vu' }),
      prospect({ statut: 'en_discussion', relancer_le: '2026-11-05' }),
      prospect({ statut: 'interesse', relancer_le: '2026-11-06' }),
      prospect({ statut: 'en_discussion', relancer_le: '2026-11-08' }),
    ]
    expect(rappelDu(liste[2], NOW)).toBe(true)
    expect(resumerProspects(liste, NOW)).toEqual({ total: 5, aTrier: 1, aRappeler: 2 })
  })
})

describe('cas limites', () => {
  it('saisie : Instagram vidé, Instagram ou date invalides', () => {
    expect(validerSaisie({ instagram: '' }, false)).toEqual({ champs: { instagram: null } })
    expect(validerSaisie({ instagram: 'mon compte' }, false)).toEqual({ erreur: 'Compte Instagram invalide.' })
    expect(validerSaisie({ relancer_le: 'demain' }, false)).toEqual({ erreur: 'Date de rappel invalide.' })
  })
  it('événement refusé : sans Instagram, Instagram ou étape invalides, type inconnu', () => {
    expect(validerEvenement({ type: 'contacte' }, NOW)).toHaveProperty('erreur')
    expect(validerEvenement({ type: 'ajout', nom: 'X', instagram: 'mon compte' }, NOW)).toEqual({ erreur: 'instagram invalide' })
    expect(validerEvenement({ type: 'ajout', nom: 'X', statut: 'perdu' }, NOW)).toEqual({ erreur: 'statut inconnu' })
    expect(validerEvenement({ type: 'supprime' }, NOW)).toHaveProperty('erreur')
  })
  it('un contact complète une fiche créée par une réponse', () => {
    const p = prospect({ nom: 'laveur.exemple', contacte_le: null, statut: 'a_repondu' })
    const e = appliquerEvenement(p, ev({ type: 'contacte', instagram: 'laveur.exemple', nom: 'Laveur Exemple', message: 'Salut !', ville: 'Lyon', le: '2026-11-06T09:00:00Z' }))
    expect(e).toEqual({ modifier: { contacte_le: '2026-11-06T09:00:00.000Z', message: 'Salut !', ville: 'Lyon', nom: 'Laveur Exemple' } })
  })
  it('un « vu » ou une réponse d’un inconnu crée la fiche à trier', () => {
    expect(appliquerEvenement(null, ev({ type: 'vu', instagram: 'laveur.exemple' }))).toMatchObject({ creer: { statut: 'a_vu', nom: 'laveur.exemple' } })
    expect(appliquerEvenement(null, ev({ type: 'reponse', instagram: 'laveur.exemple', reponse: 'Oui' }))).toMatchObject({ creer: { statut: 'a_repondu', reponse: 'Oui' } })
  })
  it('un ajout remplit téléphone, ville et vrai nom s’ils manquaient', () => {
    const e = appliquerEvenement(prospect({ nom: 'laveur.exemple' }), ev({ type: 'ajout', nom: 'Laveur Exemple', telephone: '07 11 11 11 11', ville: 'Lyon' }))
    expect(e).toEqual({ modifier: { statut: 'en_discussion', telephone: '07 11 11 11 11', ville: 'Lyon', nom: 'Laveur Exemple' } })
  })
  it('range chaque étape dans son onglet', () => {
    expect(['a_repondu', 'en_discussion', 'interesse', 'inscrit'].map(s => ongletDe(prospect({ statut: s as Prospect['statut'] }), NOW)))
      .toEqual(['trier', 'discussion', 'interesses', 'inscrits'])
    expect(estArchive(prospect({ statut: 'interesse', contacte_le: '2026-10-01T10:00:00Z' }), NOW)).toBe(false)
  })
})

describe('prospectsARappeler', () => {
  it('garde les rappels prévus en discussion ou intéressés, le plus ancien d’abord, avec la première ligne des notes', () => {
    const liste = [
      prospect({ id: 'a', statut: 'en_discussion', relancer_le: '2026-11-09', notes: 'Rappeler après 18h\nA un associé' }),
      prospect({ id: 'b', statut: 'interesse', relancer_le: '2026-11-04' }),
      prospect({ id: 'c', statut: 'pas_interesse', relancer_le: '2026-11-04' }),
      prospect({ id: 'd', statut: 'en_discussion' }),
    ]
    expect(prospectsARappeler(liste).map(p => [p.id, p.le, p.motif])).toEqual([['b', '2026-11-04', null], ['a', '2026-11-09', 'Rappeler après 18h']])
  })
})
