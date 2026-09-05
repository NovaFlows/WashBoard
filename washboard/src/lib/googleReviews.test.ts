import { describe, it, expect } from 'vitest'
import { isPublicHttpUrl } from './googleReviews'

// Ce champ est rempli librement par le laveur et récupéré par NOTRE serveur :
// il pouvait servir à sonder ce qui n'est pas accessible depuis l'extérieur.

describe('isPublicHttpUrl', () => {
  it('accepte un vrai site', () => {
    expect(isPublicHttpUrl('https://kookiiclean.fr')).toBe(true)
    expect(isPublicHttpUrl('http://exemple.fr/avis')).toBe(true)
  })

  it('refuse la boucle locale', () => {
    expect(isPublicHttpUrl('http://localhost:3000/api/health')).toBe(false)
    expect(isPublicHttpUrl('http://127.0.0.1/')).toBe(false)
    expect(isPublicHttpUrl('http://[::1]/')).toBe(false)
  })

  it('refuse les adresses du réseau interne', () => {
    expect(isPublicHttpUrl('http://10.0.0.5/')).toBe(false)
    expect(isPublicHttpUrl('http://192.168.1.1/')).toBe(false)
    expect(isPublicHttpUrl('http://172.16.0.1/')).toBe(false)
    expect(isPublicHttpUrl('http://172.31.255.1/')).toBe(false)
  })

  it('refuse les métadonnées de l’hébergeur', () => {
    // La cible classique de ce type d'attaque : elles exposent des jetons.
    expect(isPublicHttpUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isPublicHttpUrl('http://metadata.google.internal/')).toBe(false)
  })

  it('laisse passer une plage publique proche d’une plage privée', () => {
    // 172.32 est public : le filtre ne doit pas être trop large.
    expect(isPublicHttpUrl('http://172.32.0.1/')).toBe(true)
    expect(isPublicHttpUrl('http://11.0.0.1/')).toBe(true)
  })

  it('refuse les protocoles qui n’ont rien à faire ici', () => {
    expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isPublicHttpUrl('ftp://exemple.fr/')).toBe(false)
    expect(isPublicHttpUrl('data:text/html,<script>')).toBe(false)
  })

  it('refuse une adresse illisible plutôt que de tenter la requête', () => {
    expect(isPublicHttpUrl('pas une url')).toBe(false)
    expect(isPublicHttpUrl('')).toBe(false)
  })
})
