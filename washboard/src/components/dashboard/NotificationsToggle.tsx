'use client'

import { useEffect, useState } from 'react'

// Activation des notifications push, dans les réglages du laveur.
//
// L'essentiel du travail ici n'est pas l'abonnement lui-même (quelques
// lignes) mais le fait de dire au laveur ce qui l'empêche d'y arriver. Le cas
// le plus fréquent : sur iPhone, Apple interdit les notifications tant que
// l'application n'a pas été ajoutée à l'écran d'accueil. Sans explication, le
// laveur voit un bouton qui ne fait rien.

type Etat =
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

export function NotificationsToggle() {
  const [etat, setEtat] = useState<Etat>('chargement')
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
      setErreur("Activation impossible. Vérifiez votre connexion et réessayez.")
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

  if (etat === 'chargement') return null

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <h3 className="font-bold text-slate-900 dark:text-white mb-1">Notifications</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Soyez prévenu sur votre téléphone dès qu&apos;un client réserve, sans attendre l&apos;email.
      </p>

      {etat === 'ios-non-installe' && (
        <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-3.5">
          Sur iPhone, ajoutez d&apos;abord WashBoard à votre écran d&apos;accueil : bouton
          Partager dans Safari, puis <strong>Sur l&apos;écran d&apos;accueil</strong>. Revenez
          ensuite ici depuis l&apos;icône WashBoard.
        </p>
      )}

      {etat === 'non-supporte' && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Votre navigateur ne gère pas les notifications. Vous continuez à recevoir les
          emails de réservation.
        </p>
      )}

      {etat === 'refuse' && (
        <p className="text-sm text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3.5">
          Les notifications ont été refusées pour ce site. Pour les réactiver, autorisez-les
          dans les réglages de votre navigateur, puis revenez sur cette page.
        </p>
      )}

      {(etat === 'inactif' || etat === 'actif') && (
        <button
          onClick={etat === 'actif' ? desactiver : activer}
          disabled={occupe}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            etat === 'actif'
              ? 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              : 'bg-[#1651E8] text-white hover:bg-[#0F4ACC]'
          }`}
        >
          {occupe ? 'Un instant…' : etat === 'actif' ? 'Désactiver sur cet appareil' : 'Activer les notifications'}
        </button>
      )}

      {etat === 'actif' && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2.5 font-medium">
          Actives sur cet appareil.
        </p>
      )}

      {erreur && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{erreur}</p>}
    </div>
  )
}
