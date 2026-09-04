// Service worker de WashBoard.
//
// Règle de prudence numéro un : ce produit affiche un planning et des chiffres
// comptables. Servir une version en cache d'un rendez-vous annulé ou d'un
// chiffre d'affaires périmé serait pire que ne rien afficher du tout. Donc :
//
//   • les appels de données (/api/…)  → jamais de cache, réseau uniquement
//   • les pages                       → réseau d'abord, cache seulement si hors ligne
//   • les fichiers fixes (icônes…)    → cache d'abord, ils ne changent pas
//
// Le numéro de version force le renouvellement du cache à chaque déploiement.
// v2 : purge les caches de la v1, qui pouvaient contenir des pages de tableau
// de bord mises en cache avant qu'on ne les en exclue.
const VERSION = 'washboard-v2'
const HORS_LIGNE = '/hors-ligne'

const FICHIERS_FIXES = [
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/LogoWashBoard.png',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FICHIERS_FIXES))
      // Un fichier manquant ne doit pas empêcher l'installation entière.
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(noms => Promise.all(noms.filter(n => n !== VERSION).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Données, authentification, paiement : toujours le réseau, jamais le cache.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  // Fichiers fixes : le cache d'abord, c'est instantané et ils ne bougent pas.
  if (FICHIERS_FIXES.includes(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(enCache => enCache || fetch(request).then(reponse => {
        if (reponse.ok) {
          const copie = reponse.clone()
          caches.open(VERSION).then(c => c.put(request, copie))
        }
        return reponse
      }))
    )
    return
  }

  // Pages : le réseau fait foi. Le cache ne sert que si le réseau a échoué,
  // c'est-à-dire hors ligne — jamais pour « aller plus vite ».
  if (request.mode === 'navigate') {
    // Les pages du tableau de bord ne sont JAMAIS mises en cache. Elles
    // contiennent le planning, les clients et la comptabilité d'un laveur :
    // une copie sur l'appareil survivrait à sa déconnexion, et pourrait lui
    // réafficher un état périmé sans qu'il sache d'où il sort. Hors ligne, il
    // voit l'écran dédié plutôt qu'un planning d'hier.
    const prive = url.pathname.startsWith('/dashboard')

    event.respondWith(
      fetch(request)
        .then(reponse => {
          if (reponse.ok && !prive) {
            const copie = reponse.clone()
            caches.open(VERSION).then(c => c.put(request, copie)).catch(() => {})
          }
          return reponse
        })
        .catch(() => (prive
          ? caches.match(HORS_LIGNE)
          : caches.match(request).then(enCache => enCache || caches.match(HORS_LIGNE))))
    )
  }
})

// ─── Notifications ────────────────────────────────────────────────────────
// Reçues même quand l'application est fermée.

self.addEventListener('push', event => {
  let donnees = { title: 'WashBoard', body: 'Nouvelle activité sur votre compte.' }
  try {
    if (event.data) donnees = { ...donnees, ...event.data.json() }
  } catch {
    // Charge utile illisible : on affiche quand même quelque chose plutôt que
    // de laisser le laveur sans information.
  }

  event.waitUntil(
    self.registration.showNotification(donnees.title, {
      body: donnees.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Un `tag` identique remplace la notification précédente au lieu d'en
      // empiler dix si plusieurs réservations tombent d'affilée.
      tag: donnees.tag || 'washboard',
      data: { url: donnees.url || '/dashboard', bookingId: donnees.bookingId },
      lang: 'fr',
      // Répondre sans ouvrir l'application : un appui long (Android) déroule
      // la notification et affiche ces deux boutons.
      //
      // ⚠️ Sur iPhone, ils n'apparaîtront pas : WebKit ignore les actions
      // personnalisées et n'affiche que son propre « Afficher ». La
      // notification y reste simplement cliquable. On les déclare quand même,
      // iOS les ignore sans rien casser.
      actions: donnees.bookingId ? [
        { action: 'confirmer', title: 'Confirmer' },
        { action: 'refuser',   title: 'Refuser' },
      ] : undefined,
    })
  )
})

/** Change le statut d'une réservation depuis un bouton de la notification.
 *
 *  `credentials: 'include'` est indispensable : sans les cookies de session,
 *  l'API répondrait 401 et le laveur croirait avoir confirmé un rendez-vous
 *  qui serait resté en attente. */
async function changerStatut(bookingId, statut, libelle) {
  try {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: statut }),
    })
    if (!res.ok) throw new Error(String(res.status))

    await self.registration.showNotification(libelle, {
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `retour-${bookingId}`,
      lang: 'fr',
    })
  } catch {
    // Échec (hors ligne, session expirée) : on le dit au lieu de laisser
    // croire que c'est fait, et on ouvre l'application pour reprendre à la
    // main.
    await self.registration.showNotification('Action impossible', {
      body: 'Ouvrez WashBoard pour répondre à cette réservation.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `retour-${bookingId}`,
      data: { url: '/dashboard/calendrier' },
      lang: 'fr',
    })
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const bookingId = event.notification.data?.bookingId

  // Boutons « Confirmer » / « Refuser » : on répond sans ouvrir l'application.
  if (event.action === 'confirmer' && bookingId) {
    event.waitUntil(changerStatut(bookingId, 'confirmed', 'Rendez-vous confirmé'))
    return
  }
  if (event.action === 'refuser' && bookingId) {
    event.waitUntil(changerStatut(bookingId, 'cancelled', 'Rendez-vous refusé'))
    return
  }

  const cible = event.notification.data?.url || '/dashboard'

  // Si WashBoard est déjà ouvert, on y navigue plutôt que d'ouvrir un
  // deuxième onglet.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(fenetres => {
      for (const f of fenetres) {
        if (f.url.includes(self.location.origin) && 'focus' in f) {
          f.navigate(cible)
          return f.focus()
        }
      }
      return self.clients.openWindow(cible)
    })
  )
})
