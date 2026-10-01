'use client'

import { useEffect, useState } from 'react'

// Activation des notifications push, côté navigateur. Extrait de
// `NotificationsToggle` (l'écran du site, inchangé) pour que l'app (PWA) s'en serve aussi,
// sans recopier ni faire diverger la logique — c'est la même autorisation, le même abonnement
// et les mêmes routes (`/api/push/subscribe`).
//
// L'essentiel ici n'est pas l'abonnement lui-même (quelques lignes) mais de savoir dire ce qui
// empêche d'y arriver. Le cas le plus fréquent : sur iPhone, Apple interdit les notifications
// tant que l'application n'a pas été ajoutée à l'écran d'accueil.

export type EtatNotifications =
  | 'chargement'
  | 'non-supporte'      // navigateur trop ancien
  | 'ios-non-installe'  // iPhone : il faut d'abord ajouter à l'écran d'accueil
  | 'refuse'            // l'autorisation a été refusée, seuls les réglages du téléphone peuvent la rendre
  | 'inactif'
  | 'actif'

/** La clé VAPID est transmise en base64url ; l'API du navigateur attend des
 *  octets, dans un ArrayBuffer simple (pas partagé). */
function cleEnOctets(base64: string): ArrayBuffer {
  const normalise = (base64 + '='.repeat((4 - base64.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(normalise)
  const tampon = new ArrayBuffer(brut.length)
  const vue = new Uint8Array(tampon)
  for (let i = 0; i < brut.length; i++) vue[i] = brut.charCodeAt(i)
  return tampon
}

export function useNotificationsPush() {
  const [etat, setEtat] = useState<EtatNotifications>('chargement')
  const [occupe, setOccupe] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const supporte = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
      const estIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const installe = window.matchMedia('(display-mode: standalone)').matches
        || (window.navigator as { standalone?: boolean }).standalone === true

      if (!supporte) { setEtat(estIOS && !installe ? 'ios-non-installe' : 'non-supporte'); return }
      if (estIOS && !installe) { setEtat('ios-non-installe'); return }
      if (Notification.permission === 'denied') { setEtat('refuse'); return }

      const reg = await navigator.serviceWorker.getRegistration()
      const abo = await reg?.pushManager.getSubscription()
      setEtat(abo ? 'actif' : 'inactif')
    })().catch(() => setEtat('non-supporte'))
  }, [])

  async function activer() {
    setOccupe(true); setErreur(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setEtat(permission === 'denied' ? 'refuse' : 'inactif'); return }

      const reg = await navigator.serviceWorker.ready
      const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!cle) { setErreur('Les notifications ne sont pas configurées sur ce site.'); return }

      const abo = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: cleEnOctets(cle),
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(abo.toJSON()),
      })
      if (!res.ok) {
        // L'abonnement local existe mais le serveur ne le connaît pas : on le
        // retire, sinon le laveur croirait les notifications actives.
        await abo.unsubscribe()
        setErreur((await res.json()).error ?? 'Activation impossible.')
        return
      }
      setEtat('actif')
    } catch {
      setErreur('Activation impossible. Vérifiez votre connexion et réessayez.')
    } finally { setOccupe(false) }
  }

  async function desactiver() {
    setOccupe(true); setErreur(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const abo = await reg.pushManager.getSubscription()
      if (abo) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: abo.endpoint }),
        })
        await abo.unsubscribe()
      }
      setEtat('inactif')
    } catch {
      setErreur('Désactivation impossible. Réessayez dans un instant.')
    } finally { setOccupe(false) }
  }

  return { etat, occupe, erreur, activer, desactiver }
}
