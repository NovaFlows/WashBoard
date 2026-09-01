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
const VERSION = 'washboard-v1'
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
    event.respondWith(
      fetch(request)
        .then(reponse => {
          if (reponse.ok) {
            const copie = reponse.clone()
            caches.open(VERSION).then(c => c.put(request, copie))
          }
          return reponse
        })
        .catch(() => caches.match(request).then(enCache => enCache || caches.match(HORS_LIGNE)))
    )
  }
})
