# Règles du Jeu — WashBoard

## 0. Référence Gstack

**Chemin local :** `h:\Desktop\Automatisation\SaaS\WashBoard\gstack\`

En cas de doute sur une décision d'architecture, un pattern de code, une structure de fichiers
ou une configuration — **ne pas tout lire gstack**. À la place :

1. Identifier la catégorie du doute (auth, routing, DB schema, API design, tests, etc.)
2. Aller directement dans le fichier de gstack le plus probable (voir table ci-dessous)
3. Lire uniquement ce fichier ou cette section
4. Appliquer ce pattern au projet WashBoard

Ne jamais parcourir gstack en entier. Cibler, lire, appliquer.

### Points d'entrée ciblés dans gstack

| Doute sur... | Fichier à lire en premier |
|---|---|
| Architecture globale | `gstack/ARCHITECTURE.md` |
| Design / principes produit | `gstack/DESIGN.md` |
| Philosophie / éthique du code | `gstack/ETHOS.md` |
| Config Claude / agents | `gstack/CLAUDE.md` |
| Contribution / workflow git | `gstack/CONTRIBUTING.md` |
| Stack navigateur / CDP | `gstack/BROWSER.md` |
| Skills / automatisations | `gstack/SKILL.md` |
| Supabase provisioning | `gstack/bin/gstack-gbrain-supabase-provision` |
| MCP / intégrations | `gstack/bin/gstack-gbrain-mcp-verify` |

---

## 1. Philosophie Générale

- **MVP strict** : si une feature n'est pas dans la V1 décidée, elle n'existe pas encore
- **Produit d'abord, perfection ensuite** : un truc qui marche vaut mieux qu'un truc parfait qui n'existe pas
- **Pas de feature pour le fun** : chaque ligne de code doit servir un utilisateur réel
- **Simple > Élégant** : une solution lisible et directe bat une abstraction sophistiquée
- **Pas de dette cachée** : si on prend un raccourci, on le note explicitement

---

## 2. Avant de Coder — Analyse

Avant toute implémentation, poser ces questions :

1. **Qui l'utilise ?** (laveur ou client final ?)
2. **Quel problème ça résout exactement ?**
3. **Est-ce que c'est dans la V1 décidée ?** Si non → refuser ou noter pour V2
4. **Quelle est la surface d'erreur ?** (qu'est-ce qui peut mal tourner ?)
5. **Comment on teste que ça marche ?** (définir le critère de succès avant de coder)

---

## 3. Structure du Projet Next.js

```
src/
  app/
    (public)/          # Pages sans auth (réservation client)
    (dashboard)/       # Pages avec auth (back-office laveur)
    api/               # Route handlers Next.js
  components/
    ui/                # Composants génériques (boutons, inputs, etc.)
    booking/           # Composants page de réservation
    dashboard/         # Composants back-office
  lib/
    supabase/          # Client Supabase + helpers
    maps/              # Helpers Google Maps
    email/             # Helpers Resend
    stripe/            # Helpers Stripe
  types/               # Types TypeScript globaux
  utils/               # Fonctions utilitaires pures
```

---

## 4. Base de Données — Règles Supabase

- **Toujours utiliser RLS** (Row Level Security) — jamais désactiver en prod
- **Nommer les tables au pluriel** : `bookings`, `washers`, `services`, `zones`
- **Toujours inclure** : `id uuid DEFAULT gen_random_uuid()`, `created_at`, `updated_at`
- **Pas de logique métier dans les migrations** — les migrations ne font que structurer
- **Foreign keys explicites** avec `ON DELETE` clairement défini
- **Indexes** sur toutes les colonnes utilisées dans les WHERE fréquents
- Tester les policies RLS avant de déployer une nouvelle table

### Schema V1 minimum

```sql
washers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  zone_config jsonb,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL,
  duration_minutes int NOT NULL,
  vehicle_types text[]
)

availabilities (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE,
  day_of_week int NOT NULL,  -- 0=lundi, 6=dimanche
  start_time time NOT NULL,
  end_time time NOT NULL
)

bookings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  washer_id uuid REFERENCES washers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id),
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text NOT NULL,
  address text NOT NULL,
  lat numeric,
  lng numeric,
  scheduled_at timestamptz NOT NULL,
  status text DEFAULT 'pending',  -- pending | confirmed | cancelled | done
  created_at timestamptz DEFAULT now()
)
```

---

## 5. API Design — Règles Route Handlers

- **REST** pour les opérations CRUD simples
- **Toujours valider** les inputs avec Zod avant tout traitement
- **Toujours retourner** un objet `{ data, error }` cohérent
- **Codes HTTP corrects** : 200, 201, 400, 401, 403, 404, 500
- **Pas de logique métier dans les route handlers** — déléguer à des fonctions `lib/`
- **Rate limiting** sur les routes publiques (page de réservation)

```typescript
// Pattern standard route handler
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = BookingSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error }, { status: 400 })

  const { data, error } = await createBooking(parsed.data)
  if (error) return Response.json({ error }, { status: 500 })

  return Response.json({ data }, { status: 201 })
}
```

---

## 6. Auth — Règles Supabase Auth

- **Laveurs seulement** ont un compte — les clients réservent sans compte
- Session gérée côté serveur via `createServerClient` (cookies)
- Middleware Next.js protège toutes les routes `/dashboard/**`
- Ne jamais exposer la `service_role` key côté client
- Email de confirmation activé pour l'onboarding laveur

---

## 7. Multi-Tenancy

WashBoard est multi-tenant (un laveur = un tenant).

- **Chaque query DB doit filtrer par `washer_id`** — jamais de query globale sans filtre tenant
- La policy RLS garantit l'isolation, mais le code doit aussi le faire explicitement
- Le slug du laveur (`/book/kookiclean`) est l'identifiant public du tenant
- Pas de données cross-tenants, jamais

---

## 8. Tests — Stratégie

### Priorités de test (dans l'ordre)
1. **Flows critiques** : réservation complète, confirmation email, création compte laveur
2. **Logique de groupement par zone** : algorithme central du produit
3. **API routes** : validation inputs, codes retour, comportement erreur
4. **Composants UI** : uniquement les composants complexes avec état métier

### Types de tests
- **Unit** : fonctions pures dans `utils/` et `lib/` → Jest
- **Integration** : API routes + Supabase → DB Supabase de test dédiée
- **E2E** : flows critiques → Playwright (réservation de bout en bout, onboarding laveur)

### Règles tests
- Pas de mock de la base de données — utiliser une vraie DB Supabase de test
- Chaque bug corrigé → écrire le test qui l'aurait détecté
- Un test qui passe tout le temps sans rien vérifier est pire qu'aucun test
- Les tests E2E tournent sur chaque PR avant merge

---

## 9. Validation — Avant de Dire "C'est Done"

Une feature est **done** quand toutes ces cases sont cochées :

- [ ] Le flow golden path fonctionne de bout en bout
- [ ] Les cas d'erreur sont gérés (input invalide, réseau, champ manquant)
- [ ] Ça marche sur mobile (priorité pour la page de réservation)
- [ ] Les emails s'envoient et arrivent correctement
- [ ] Les RLS policies bloquent ce qu'elles doivent bloquer
- [ ] Pas de `console.error` en prod
- [ ] TypeScript compile sans erreur (`tsc --noEmit`)
- [ ] Pas de régression sur les flows existants

---

## 10. Sécurité SaaS

- **Variables d'environnement** : jamais de secret dans le code, toujours `.env.local` / Vercel env
- **CORS** : restreindre aux domaines WashBoard uniquement
- **Input sanitization** : Zod sur tous les inputs venant de l'extérieur
- **SQL injection** : impossible avec Supabase client (paramétré), vigilant sur les RPC custom
- **Rate limiting** : routes publiques (booking) limitées par IP
- **HTTPS uniquement** en prod (Vercel gère automatiquement)
- **Pas de données sensibles dans les logs** (email, téléphone, adresse)
- **Stripe webhooks** : toujours vérifier la signature avant de traiter

---

## 11. Performance

- **Images** : utiliser `next/image` systématiquement
- **Fonts** : `next/font` uniquement
- **Pas de `useEffect` pour fetcher des données** — Server Components ou React Query
- **Loading states** sur toutes les actions async visibles par l'utilisateur
- **Optimistic updates** pour les actions fréquentes (changement statut réservation)
- **Target** : < 2s Time To Interactive sur la page de réservation mobile 4G
- **Pas de dépendances inutiles** : vérifier le bundle size avant d'ajouter un package

---

## 12. UX SaaS — Principes

- **Onboarding laveur** : guidé, étape par étape, jamais d'écran vide au démarrage
- **Page de réservation client** : max 3 clics pour réserver, zéro friction, zéro compte à créer
- **Feedback immédiat** : chaque action a un état de chargement visible + confirmation claire
- **Erreurs lisibles** : pas de "Something went wrong" — expliquer ce qui s'est passé et quoi faire
- **Mobile first** : la page de réservation est majoritairement utilisée sur téléphone
- **Emails transactionnels** : clairs, avec le récapitulatif complet, et un CTA si besoin d'action

---

## 13. Déploiement

- **Branche `main`** = production (Vercel auto-deploy)
- **Branche `dev`** = staging (Vercel preview deploy)
- Jamais de migration DB non testée directement en prod
- **Ordre de déploiement** : migration DB d'abord → code ensuite (jamais l'inverse)
- **Rollback plan** : toujours savoir comment annuler une migration avant de la lancer
- Variables d'environnement vérifiées dans Vercel avant chaque nouveau déploiement prod

---

## 14. Décisions Produit — Gouvernance

- **Hors V1 = backlog** : noter l'idée dans un fichier `backlog.md`, ne pas coder
- **Doute sur une feature** → tester l'hypothèse avec Kooki Clean avant de coder
- **Toute décision d'architecture notable** → mise à jour de `CLAUDE.md` ou de ce fichier
- **Changement de stack** → discussion explicite avant toute implémentation
- **Pas de refactoring sans raison** : on refactorise quand c'est un blocage, pas par esthétique

---

## 15. Workflow de Développement

Pour chaque nouvelle feature ou fix :

1. **Analyser** (section 2) avant d'écrire la moindre ligne
2. **Chercher dans gstack** si doute sur le pattern (section 0)
3. **Coder** le minimum viable qui satisfait le besoin
4. **Tester manuellement** le golden path + cas d'erreur
5. **Valider** avec la checklist section 9
6. **Commiter** avec un message clair (quoi + pourquoi)

---

## 16. Contexte Projet Rapide

| Clé | Valeur |
|-----|--------|
| Nom | WashBoard |
| Pitch | "Tu laves des voitures. On gère le reste." |
| Modèle | SaaS B2B, 49€/mois/laveur |
| Objectif an 1 | 10 000€ CA (~17 clients) |
| Bêta testeur cible | Kooki Clean |
| Premier livrable | Page de réservation publique |
| Stack | Next.js + Supabase + Vercel + Stripe + Resend |
| Ce qu'on ne fait PAS en V1 | Paiement en ligne, multi-employés, photos, tournée complexe |
