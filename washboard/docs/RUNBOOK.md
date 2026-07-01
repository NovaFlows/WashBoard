# WashBoard — Runbook d'incident

> Le document à ouvrir **quand quelque chose casse en prod**. Objectif : diagnostiquer
> vite, sans deviner.

## 0. Vue d'ensemble

| Brique | Où | Ce qui casse en général |
|--------|-----|-------------------------|
| App (Next.js) | Vercel | build cassé, erreur runtime, timeout |
| Base + Auth | Supabase | RLS, quota, colonne manquante, projet en pause |
| Paiement | Stripe | webhook en échec, clé/price ID, mode test vs live |
| Emails | Resend | domaine non vérifié, quota |
| Zones/distances | Google Maps | quota, clé |

## 1. « Un utilisateur a une erreur » → la retrouver

Chaque erreur API non gérée renvoie au client un **`errorId`** (UUID) dans le JSON de réponse.
Les erreurs de rendu React affichent un **`digest`** (généré par Next).

1. **Demander le code** à l'utilisateur (`errorId` ou `Code : …`).
2. **Vercel → Project → Logs** (ou `Observability`), coller le code dans la recherche.
3. On tombe sur la ligne de log structurée JSON correspondante :
   ```json
   {"ts":"…","level":"error","event":"bookings.insert.db","context":{"errorId":"…","washerId":"…"},"error":{"name":"…","message":"…","stack":"…"}}
   ```
4. Le champ `event` dit **où** (ex. `stripe.webhook.checkout_completed.db`), `error.message`/`stack` disent **quoi**.

### Format des logs
Tous les logs applicatifs sont du JSON une ligne (via `src/lib/logger.ts`) :
`ts`, `level` (`debug|info|warn|error`), `event` (namespacé, ex. `stripe.checkout.session_created`),
`context` (données non sensibles), `error` (si présent).
On peut donc filtrer par `event:` ou `level:error` dans Vercel.

## 2. Santé de l'app (monitoring)

- **Endpoint** : `GET /api/health` → `200 {status:"ok"}` si la base répond, `503 {status:"degraded"}` sinon.
- **À brancher** sur un moniteur externe (UptimeRobot / Better Stack / cron-job.org) qui ping
  `https://www.washboard.fr/api/health` toutes les 1–5 min et alerte sur 503 ou timeout.

## 3. Incidents fréquents & première action

### Stripe — un abonnement/résiliation ne se reflète pas
1. **Stripe → Développeurs → Webhooks → endpoint → Événements** : l'événement est-il **envoyé** (2xx) ou **en échec** ?
   - **308/redirect** → l'URL du webhook doit être `https://www.washboard.fr/...` (avec `www`).
   - **500** → erreur DB côté app : chercher `event:stripe.webhook.*` dans les logs Vercel (l'errorId est loggé). Le 500 **fait rejouer** Stripe automatiquement.
   - **Non listé** → l'événement n'est pas abonné (ajouter `customer.subscription.updated`, etc.).
2. **Colonnes DB** attendues sur `washers` : `stripe_customer_id`, `stripe_subscription_id`, `cancels_at`.
3. Le webhook logge un `info` par succès (`stripe.webhook.checkout_completed`, …) → utile pour confirmer la réception.

### Base de données (Supabase)
- **Page publique vide / 404 confirmation / PDF** → souvent la **RLS** : une lecture publique passe par le client
  anonyme qui n'a pas le droit. Les lectures publiques de `bookings` doivent utiliser le **service-role** ciblé sur l'id.
- **Projet Supabase en pause** (offre gratuite, inactivité) → `/api/health` renvoie 503. Le réactiver dans le dashboard.

### Déploiement Vercel
- Le build échoue → **il bloque la mise en ligne** (Build Command = `npm run test:coverage && npm run lint && npm run build`
  côté CI GitHub ; Vercel exécute test+lint+build). Lire les logs de build Vercel.
- **Piège vécu** : du code commité **non poussé** → Vercel déploie l'ancien. Toujours `git push` puis vérifier le commit déployé.

## 4. Filet de sécurité anti-régression

- **CI GitHub Actions** (`.github/workflows/ci.yml`) à chaque push/PR : `typecheck` → `lint` → `test:coverage` → `build`.
- **Seuils de couverture** (`vitest.config.ts`) sur la couche métier `src/lib` : statements 90 / branches 85 /
  functions 90 / lines 90. Sous le seuil → **CI rouge** (empêche une chute de couverture de passer inaperçue).
- **Tests** : `npm run test` (rapide) · `npm run test:coverage` (avec rapport + seuils, HTML dans `coverage/`).

## 5. Commandes utiles

```bash
npm run test            # tests unitaires
npm run test:coverage   # + couverture (échoue sous les seuils) ; rapport coverage/index.html
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build           # build de prod
```

## 6. Convention de logs (pour les devs)

- Toujours passer par `logger` (`src/lib/logger.ts`), jamais `console.*` directement dans le code métier.
- `event` en **namespace.point** (ex. `bookings.email.washer_failed`).
- Ne **jamais** logger de secret (clé, token) ni de données perso inutiles ; préférer des ids.
- Dans une route API, lever une `AppError` (statut + message public) ou envelopper avec `withErrorHandling`
  (`src/lib/apiError.ts`) → l'erreur devient traçable (errorId) automatiquement.
