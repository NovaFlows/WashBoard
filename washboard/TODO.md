# WASHBOARD — TODO

> **Bloc-notes du projet (long terme).**
> Convention :
> - `[ ]` = à faire · `[x]` = fait (ajouter la date `AAAA-MM-JJ`)
> - Quand une tâche est terminée → la cocher + dater (la laisser dans la liste ou
>   la déplacer en bas dans « ✅ Fait »).
> - Toute nouvelle tâche découverte → l'ajouter dans la bonne section.
>
> Dernière mise à jour : 2026-08-26 (blog SEO, centre d'aide, fiche client, hero + nav ;
> et plus tôt : plan Business retiré, forfaits annuels, mode test des crons, 2 bugs prod)

---

## 🔴 Priorité haute

- [x] 2026-08-27 — **Bug de sécurité/facturation corrigé : la page de réservation
      publique ne voyait jamais les RDV existants du laveur (RLS).** Trouvé par
      Alexandre en testant une réservation sur téléphone (créneau optimisé absent,
      ET un créneau physiquement impossible juste après un RDV existant restait
      réservable). Cause : `/api/slots/smart` et `lib/travelFee.ts` (mode "RDV
      précédent") lisaient `bookings` via le client anonyme du visiteur, qui n'a
      aucun droit RLS sur cette table (seule la création y est publique — voir
      `schema.sql`). Résultat en silence pour tout vrai client : ni créneaux
      optimisés, ni contrainte de trajet, **ni le bon frais de déplacement au
      moment où la réservation est réellement enregistrée** (`api/bookings` POST) —
      pas juste l'estimation affichée. Le bug était invisible aux tests d'Alexandre
      car son navigateur PC reste connecté à son propre compte laveur (RLS le
      laisse voir ses propres RDV). Corrigé : ces lectures passent maintenant par
      le client admin (service_role) déjà utilisé ailleurs pour ce même besoin.
      ~~⚠️ À vérifier : si **Kookii Clean** (vraie cliente) utilise le mode "RDV
      précédent"...~~ **Classé sans suite le 2026-08-28** : Alexandre a tranché
      que l'éventuelle mauvaise facturation historique (avant le correctif) n'est
      pas un sujet à creuser. Le correctif lui-même reste en place et vérifié —
      seule l'investigation rétroactive est abandonnée. Ne plus faire remonter ce
      point dans les rapports d'équipe.

- [ ] **La routine cloud "réunion d'équipe quotidienne" n'a pas les droits d'écriture
      sur le dépôt GitHub.** Constaté le 2026-08-27 : sa première tentative de
      `git push` a renvoyé un 403 (`Claude doesn't have GitHub access to
      NovaFlows/WashBoard for your organization` — lecture OK, écriture refusée).
      Le rapport du jour est resté local dans la session cloud jusqu'à ce qu'un autre
      push (celui de l'agent `dev`, voir ligne suivante) l'embarque par accident.
      Sans correction, la routine ne pourra plus publier son rapport tous les matins.
      À corriger via https://github.com/apps/claude/installations/select_target ou
      claude.ai/customize/connectors (droits d'écriture de l'app Claude GitHub sur
      NovaFlows/WashBoard).

- [x] 2026-08-27 — **Migration SQL de l'entonnoir de réservation appliquée** (table
      `booking_funnel_events`, `washboard/supabase/migrations/003_booking_funnel_events.sql`).
      Collée à la main dans l'éditeur SQL de Supabase par Alexandre. Confirmé
      fonctionnel : la page CRM affiche des données réelles (visiteurs, conversion,
      répartition appareil/source, timing des visites) sur le compte Kooki Clean.
      ⚠️ Rappel qui reste valable : le fichier avait été créé par l'agent `dev`
      sous forme de migration, ce qui contredit la convention du projet (SQL donné
      inline dans le chat, jamais de fichier de migration) — à rappeler à `dev`/`cyber`
      pour la prochaine fois.

- [ ] **Mettre à jour Next.js (16.2.6 → 16.3.3+) : 9 vulnérabilités connues, dont une
      haute.** Trouvé par l'agent cyber le 2026-08-27 via `npm audit --omit=dev`. La plus
      grave : divulgation non authentifiée d'endpoints Server Function (corrigée en
      16.3.3). 3 modérées, 6 hautes au total, la plupart via la chaîne de dépendances de
      Next.js (postcss, sharp, nanoid, brace-expansion).
      ⚠️ Précision 2026-08-27 : `AGENTS.md` prévient que ce Next.js a des API différentes
      de nos données d'entraînement (version 2026, post-cutoff) — vérifié que le paquet
      vient bien du registre npm standard (`"next": "16.2.6"`, pas de fork/patch local),
      donc pas de risque de patch maison écrasé par la montée de version.
      ⚠️ **Évaluation refaite le 2026-08-28** : la 1ère évaluation (2026-08-27) avait été
      faite dans le bac à sable temporaire d'une session cloud, jamais poussée — perdue
      avec ce bac à sable avant que `cyber` ait pu la revoir. Reprise sur la branche
      `chore/eval-nextjs-16.3.3`, **poussée cette fois** sur origin. `npm install
      next@16.3.3` seul (sans `--force`) suffit à corriger les 4 vulnérabilités liées à
      Next.js (next, postcss, sharp, nanoid) : 9 → 5 vulnérabilités, aucune restante liée
      à Next.js (brace-expansion, tmp, protobufjs, uuid via exceljs — dépendances d'outils
      annexes, pas exposées aux visiteurs). `tsc`, lint (25 warnings inchangés, 0 erreur),
      `vitest run` (277/277) et `next build` (63 pages) tous verts, aucune régression
      observée. `AGENTS.md` auto-régénéré par `next dev` (comportement connu), reverté
      avant le commit. Serveur de dev lancé (port 3003) pour test manuel par Alexandre.
      **Reste à faire avant de merger sur master** : test manuel du golden path (page de
      réservation publique) par Alexandre + go final de l'agent `cyber`.

- [x] 2026-08-26 — **Branche `feat/refonte-hero-et-forfaits` poussée puis mergée sur master.**
      Yanis avait corrigé le bug des congés de son côté en parallèle : les deux correctifs
      ont été conservés (voir la section « Priorité haute » plus bas). Le mode test des
      crons est donc disponible en prod.

- [x] 2026-08-26 — **Relance par SMS validée** (smsSent: 1) apres ajout de BREVO_API_KEY
      en local. Les deux canaux, avis et relance, sont verifies de bout en bout.

- [x] 2026-08-26 — Réservation de test `dbd2b4f2` supprimée chez Kooki Clean. Kookii Clean
      (le vrai client) vérifié intact : 41 réservations.

- [ ] **[PLANIFIÉ DÉBUT SEPTEMBRE 2026] Remplir les placeholders légaux** dès que l'entité
      est créée (micro-entreprise ou autre) : fichiers `src/app/(legal)/mentions-legales/page.tsx`,
      `cgv/page.tsx`, `confidentialite/page.tsx`. Remplacer `[NOM LÉGAL]`,
      `[FORME JURIDIQUE]`, `[SIRET]`, `[ADRESSE COMPLÈTE]`.

- [ ] **[PLANIFIÉ DÉBUT SEPTEMBRE 2026] Passage de Stripe en live** (voir la mémoire
      `project-stripe-activation.md` pour la procédure complète). Deux points à ne pas
      oublier ce jour-là :
  - [ ] **Les forfaits annuels n'existent pas côté Stripe.** L'engagement annuel ajouté le
        2026-08-26 (2 mois offerts) ne concerne que le paiement manuel PayPal/virement :
        `STRIPE_PRICE_IDS` associe **un seul prix par plan**, sans notion de cycle, et
        `POST /api/stripe/checkout` ne reçoit pas le cycle choisi. Il faudra créer les prix
        annuels dans Stripe, étendre `STRIPE_PRICE_IDS` en `Record<Plan, Record<BillingCycle,
        string>>`, et transmettre le cycle depuis le `BillingToggle`. Sans ça, un client qui
        choisit l'annuel serait facturé au mois.
  - [ ] Supprimer `STRIPE_PRICE_ID_BUSINESS` de Vercel : le plan Business a été retiré le
        2026-08-26, la variable ne sert plus.

- [x] 2026-08-26 — **Plan Business supprimé + forfaits annuels** (remplace l'entrée du
      2026-07-01 ci-dessous, devenue caduque) :
      offre réduite à Essentiel (49€) et Pro (69€), le **multi-laveurs bascule dans Pro**.
      Engagement annuel = **2 mois offerts** (490€/an → 40,83€/mois ; 690€/an → 57,50€/mois),
      **présélectionné** via un `BillingToggle` partagé landing + page Abonnement.
      Montants PayPal/virement adaptés au cycle. Le quota SMS illimité des grandfathered
      passait par le plan Business → conservé explicitement (`GRANDFATHERED_SMS_QUOTA`).
      Mécanisme `comingSoon` retiré (plus aucune offre ne l'utilisait).
  - [x] 2026-07-01 — ~~Plans Pro (69€) & Business (99€) « en cours de développement »~~ :
        descriptif centralisé dans `lib/plan.ts` (`PLAN_CARDS`), partagé Abonnement + landing.
        Toujours valable **sauf** la partie Business et le flag `comingSoon`.

- [x] 2026-06-29 — **Anti-spam sur `POST /api/bookings`** (réservation publique) :
      honeypot (champ piège) + rate-limit par IP (8/10min, en mémoire) + plafond
      par laveur/jour (60/j). Rate-limit testé (9ᵉ requête → 429).
  - [x] 2026-08-26 — **FIX BUG PROD : le honeypot mangeait de vraies réservations.**
        Le champ piège s'appelait `name="website"` : Chrome et les gestionnaires de mots
        de passe le remplissent automatiquement en **ignorant `autocomplete="off"`**.
        La route renvoie alors un **faux `201` sans rien insérer** (pour ne pas révéler le
        piège au bot) → le client voyait un écran de confirmation pour une réservation
        inexistante, sans email ni la moindre trace. Reproduit puis corrigé : nom neutre
        (`wb-confirm-c7f3`) + `data-lpignore` / `data-1p-ignore` / `data-form-type`,
        et `logger.warn` au déclenchement pour rendre le rejet observable.
        ⚠️ Combien de vraies réservations perdues avant ça ? Invérifiable (aucune trace).
  - [ ] Amélioration future : rate-limit cross-instances (Upstash/Redis ou table)
        car la mémoire serverless n'est pas partagée entre instances.

- [x] 2026-06-30 — **FIX BUG PROD : double-réservation** (un client réservait un créneau
      déjà occupé). Diagnostic **vérifié empiriquement** (clé anon + clé service-role) :
      **VRAIE CAUSE = RLS**. La page publique `/book` lit les RDV existants avec le client
      **anonyme**, or la table `bookings` n'autorise la lecture qu'au propriétaire →
      `permission denied` → liste vide → **aucun créneau occupé n'était filtré** côté client.
      (Le calendrier du laveur, lui, est authentifié → voit ses RDV → bloque bien.)
      Corrigé sur 2 fronts :
      - **Page `/book`** : lecture des RDV occupés + indispos via le **service-role**
        (données NON personnelles : horaire + durée), pour que le filtre client fonctionne.
      - **Serveur `/api/bookings`** : barrière de sécurité (recompte conflits + capacité,
        409) — sauf le laveur (manuel = peut forcer). Logique pure testée
        (`countConflicts`, `effectiveTeamSize`) + test sur les **timestamps réels** du bug.
      - (Théorie initiale « embed services en tableau » écartée : l'embed est bien un objet.)
    - [x] 2026-08-26 — **FIX BUG PROD : les congés du laveur étaient ignorés côté public.**
        Un laveur pose 2 jours de congé → les clients pouvaient quand même réserver dessus
        (signalé par un vrai client). Cause : **`GRANT SELECT` manquant sur
        `unavailabilities` pour `service_role`** (42501). Les deux lectures passent par le
        service-role et faisaient `unavs ?? []` → l'erreur devenait « aucun congé » :
        la page `/book` n'excluait pas les créneaux d'absence, **et** le garde-fou serveur
        de `POST /api/bookings` calculait une capacité à effectif plein, donc ne bloquait pas.
        Les deux défenses tombaient ensemble, en silence. Le laveur, lui, voyait bien ses
        congés dans son calendrier (client authentifié → RLS normales), d'où l'invisibilité.
        - Correctifs : `GRANT SELECT ON public.unavailabilities TO service_role;` (passé en prod),
          erreur de lecture désormais tracée des deux côtés + **503** à la création plutôt
          qu'une réservation posée à l'aveugle.
        - Message du 409 corrigé : « le prestataire est absent ce jour-là » quand la capacité
          est nulle, au lieu de « ce créneau vient d'être réservé » — sinon le client
          réessayait tous les horaires du même jour sans jamais comprendre.
        - Dégâts constatés : **4 réservations** acceptées pendant des congés
          (Kookii Clean ×3, ysclean ×1). Les 2 à venir étaient des tests → sans impact client.
        - **3ᵉ occurrence du même motif** (avec le bug RLS du 30/06 et le honeypot) :
          lecture/rejet silencieux → valeur par défaut permissive → garde-fou désactivé
          sans le moindre signal. Piste de fond : auditer les `?? []` et `catch` muets.
- [x] 2026-07-02 — **Audit lectures publiques RLS** : trouvé 2 bugs → `/confirmation/[id]`
        et `/api/bookings/[id]/pdf` lisaient `bookings` avec le client **anon** → 404 sous
        RLS pour le client public. Passés en **service-role** ciblé sur l'UUID (jeton d'accès).
  - [x] 2026-06-30 — **Batterie de tests calendrier** (lib/slots) : génération de créneaux,
        chevauchement, conflits, capacité (absences), temps de trajet (faisabilité),
        durée × véhicules, cas limites (back-to-back, bornes, repro du bug prod). 66 tests au total.

- [x] 2026-06-29 — **Remplacer TOUS les emojis/icônes "template IA" par des icônes sobres**
      (lucide-react). Passage projet entier fait :
  - [x] `admin/AdminTabs.tsx` : onglets → Palette / SprayCan / Calendar
  - [x] `booking/StepService.tsx` : Particulier/Pro → User / Building2
  - [x] `dashboard/ParametresForm.tsx` : cartes → User/Star/Mail/Lock/Link2/Palette + zone danger → Hourglass/PauseCircle/AlertTriangle
  - [x] `dashboard/CrmDashboard.tsx` : KPIs, empty state, filtres, avatar pro → lucide
  - [x] `admin/IdentiteForm.tsx` : toggle thème ☀️🌙 → Sun / Moon
  - [x] `⚠` inline (CalendrierDashboard, DashboardShell, DisponibilitesManager) → retirés
  - [x] DashboardShell (nav), AbonnementPanel, LandingPage : vérifiés, déjà propres
  - Note : laissés volontairement → emails (⭐ marketing), titres Google Calendar
    (🚗 ✅, utiles au laveur dans son agenda), close-buttons ✕/✓ (glyphes monochromes).
  - [x] 2026-06-30 — `pdf/BookingPDF.tsx` : c'était juste un ★ typographique
        (« ★ Créneau optimisé »), pas un emoji couleur → conservé, OK.

## 🛡️ Prod-grade (observabilité + non-régression)

- [x] 2026-07-02 — **Socle prod mis en place** (commit 9342092) :
  - `lib/logger.ts` : logs structurés JSON (filtrables Vercel par event/level).
  - `lib/apiError.ts` : `AppError` + `withErrorHandling` + `errorResponse` →
    chaque erreur API renvoie un `errorId` traçable (loggé serveur).
  - Routes critiques enveloppées : stripe/webhook, stripe/checkout, bookings.
  - Error boundaries React : `global-error.tsx` + `(dashboard)/error.tsx` (affichent le `digest`).
  - `GET /api/health` : ping Supabase (200/503) pour moniteur uptime.
  - Seuils de couverture (`vitest.config`) + CI `test:coverage` → anti-régression.
  - `docs/RUNBOOK.md` : procédure d'incident.

### 📡 Outils externes de monitoring / analytics (feuille de route)

> Chaque outil couvre un besoin **différent** — ce ne sont pas des concurrents.
> Uptime = « est-ce en ligne ? » · Error tracking = « quel bug, alerte-moi » ·
> Analytics = « que font les utilisateurs ? ». On les ajoute au fur et à mesure
> que le besoin devient réel — inutile de tout mettre avant d'avoir des users.

- [x] 2026-07-02 — **UptimeRobot** branché (uptime) : moniteur sur
      `https://www.washboard.fr/api/health` + alerte → on est prévenu si le site tombe.
      - Décision : **UptimeRobot préféré à Better Stack** à ce stade (solo, pré-lancement)
        — même besoin d'uptime, zéro friction, sans payer les features d'équipe.
      - [ ] Optionnel : créer la Status Page UptimeRobot (favori = point vert/rouge)
            + app mobile pour les push.

- [ ] **[PRIORITÉ 2 — avant/juste après le lancement] Error tracking (Sentry OU PostHog)** :
      alertes automatiques + stack traces agrégées quand un bug survient en prod
      (au lieu de grep manuel dans Vercel). Aujourd'hui couvert « à la main » par
      `errorId` + logs Vercel + RUNBOOK, mais pas d'alerte proactive.
      - Nécessite : compte + DSN/clé, puis intégration (⚠ le plugin `@sentry/nextjs`
        patche next.config/turbopack → tester le build avec soin, ce Next est
        modifié — cf. AGENTS.md ; prévoir une intégration « dormante » activée par
        variable d'env).
      - Choix à trancher : **Sentry** (spécialiste erreurs, le plus mûr) vs
        **PostHog error tracking** (si on prend PostHog pour l'analytics, ça évite
        un 2ᵉ outil).

- [ ] **[PRIORITÉ 3 — quand il y a de vrais utilisateurs] PostHog** (analytics produit) :
      événements, funnels, rétention, session replay, feature flags. Sur WashBoard :
      taux de complétion de l'inscription laveur, points d'abandon dans le tunnel de
      réservation, conversion essai → abonnement. Sert à **optimiser le produit**,
      pas à la fiabilité. Intégration : clé publique côté client (activée par env),
      penser RGPD (bandeau/consentement — déjà mentionné dans la politique de conf.).

- [ ] **[PLUS TARD — équipe / beaucoup d'users] Better Stack** : à envisager le jour où
      on veut une **page de statut publique** (`status.washboard.fr`), de la **gestion
      d'astreinte** (on-call, escalade) ou de l'**agrégation de logs** au-delà de Vercel.
      Migration triviale depuis UptimeRobot (changer l'URL de ping). Pas avant.

## 🟠 Robustesse / dette technique

- [x] 2026-08-26 — Cle Maps renommee cote code (voir plus bas). Reste le renommage Vercel.

- [x] 2026-08-26 — **Audit des lectures qui échouent en silence.** Motif commun aux trois
      bugs de prod du jour : une lecture échoue, la valeur de repli est permissive, le
      garde-fou saute sans aucun signal. Règle retenue : sur une donnée qui sert à
      *interdire* quelque chose, un échec doit refuser ou au minimum se voir. Corrigés :
  - `api/bookings` : l'échec de récupération de l'email du laveur était muet — il ne
    recevait alors **aucune notification** de sa réservation. Tracé.
  - `booking/page.tsx` : un échec de chargement des créneaux occupés faisait paraître
    **toutes les heures libres** (même motif que la double-réservation du 30/06).
    Tracé, et le visiteur est prévenu au lieu de se voir proposer des horaires pris.
  - `zone/check` : le repli « on laisse passer » est **conservé** — refuser un client
    légitime parce que Google est tombé serait pire que d'accepter une adresse hors
    zone — mais il est désormais tracé.
  - `travelFee` : repli à 0 € tracé. Pendant la panne de facturation Google, les frais
    de déplacement tombaient silencieusement à zéro sur chaque réservation.
  - `slots/smart` et le géocodage de `washer` : pannes tracées.
  - Laissés tels quels, à raison : `supabase/server.ts` (motif Next standard pour les
    cookies), `googleReviews` (décoratif), `purge-accounts` (nettoyage best-effort),
    `AddressAutocomplete` (la vraie cause est maintenant tracée côté serveur).
  - [ ] Reste ~100 lectures Supabase dont l'`error` n'est pas récupéré. La plupart sont
        des écrans du dashboard où un échec donne une liste vide : gênant, pas dangereux.
        À traiter au fil de l'eau, en priorisant tout ce qui **conditionne une
        autorisation**.

- [x] 2026-08-26 — **Clé Maps renommée et centralisée.** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
      devient `GOOGLE_MAPS_API_KEY`, lue à un seul endroit (`lib/googleMaps.ts`) au lieu de
      six. Le helper lit le nouveau nom **avec repli sur l'ancien**, pour que le déploiement
      ne casse rien tant que Vercel n'est pas à jour.
  - [ ] **Renommer la variable dans Vercel**, puis supprimer le repli sur l'ancien nom.

- [x] 2026-08-26 — **Les routes `api/places/*` remontent les erreurs Google.** Le helper
      `fetchGoogleMaps` distingue une absence de résultat (`ZERO_RESULTS`, normal) d'une
      panne (`REQUEST_DENIED`, `OVER_QUERY_LIMIT`…) et trace la seconde. 9 tests, dont un
      qui rejoue exactement le `REQUEST_DENIED` de la facturation désactivée.

- [x] 2026-08-26 — **Session tokens Places.** L'autocomplétion et la requête de détail
      partagent un jeton par saisie : Google facture la session entière comme une unité au
      lieu de chaque frappe. Le jeton naît à la première frappe et meurt avec la requête
      de détail.

- [x] 2026-08-26 — **`BREVO_API_KEY` documentée dans `.env.example`** : la fonctionnalité
      SMS existait sans que la variable soit listée.

- [x] 2026-08-26 — **Relance par SMS validée** (`smsSent: 1`), dernier point ouvert du test
      des crons. Les deux canaux, avis et relance, sont désormais vérifiés de bout en bout.

- [~] **Code mort / legacy** — vérifié avant suppression :
  - [x] 2026-06-29 — `src/lib/scrapeReviews.ts` supprimé (aucun import, vrai code mort)
  - [x] 2026-06-30 — DÉCISION : on **garde** le flux « Réserver un appel »
        (`booking/page.tsx` + `api/booking/*` + `googleCalendar.ts`). Pas du code mort.
- [~] **Dette eslint pré-existante** (sans changer le comportement) :
  - [x] 2026-06-29 — Apostrophes non échappées (`react/no-unescaped-entities`) :
        IdentiteForm, ParametresForm, AbonnementPanel → corrigées
  - [x] 2026-06-29 — `Date.now()` pendant le render (DashboardShell) → capture via useState
  - [x] 2026-06-30 — DÉCISION : on **assume** les 7× `setState` dans `useEffect`
        (ThemeProvider, ThemeToggle, LandingPage, ComptaDashboard, StepSlot ×3).
        Patterns légitimes (fetch on mount, sync DOM), ne bloquent pas le build,
        existaient déjà avant. Won't-fix.
- [x] 2026-06-30 — **Base de tests + CI** posées :
  - Vitest configuré (`npm run test`), 20 tests sur la logique critique :
    `lib/plan.ts` (gating €), `lib/rateLimit.ts` (anti-spam), `lib/travelFee.ts`
    (helper pur `pickTravelFee` extrait + testé).
  - CI GitHub Actions (`.github/workflows/ci.yml`) : typecheck + lint + test + build
    à chaque push/PR.
  - Règle `react-hooks/set-state-in-effect` passée en `warn` (assumée).
  - [x] 2026-06-30 — Logique métier extraite en libs pures + testée :
        `lib/pricing.ts` (prix par type, remise « créneau optimisé », durée effective)
        et `lib/slots.ts` (génération de créneaux, chevauchement, fenêtres optimisées,
        faisabilité). StepService / StepSlot / API bookings recâblés dessus.
        44 tests au total.
  - [x] 2026-06-30 — **FIX BUG PROD** : « à partir de 30€ » au lieu de 120€. Cause :
        surcharge de prix « orpheline » (type désélectionné dont la surcharge restait
        dans le JSON) tirait le minimum vers le bas. Corrigé : le calcul ne regarde
        plus que les types réellement proposés ; et désélectionner un type supprime
        sa surcharge. Test de non-régression ajouté.
- [x] 2026-06-29 — **`.env.example`** documentant les 11 variables d'env (sans valeurs)
      + exception `.gitignore` pour le rendre traçable.

## 🟡 Roadmap produit

- [x] 2026-08-26 — **Blog SEO** : section `/blog` + 4 articles formant un cluster
      (trouver des clients, tarifs, se lancer, organiser ses tournées). Index des articles
      centralisé dans `lib/blog.ts`, dont le sitemap est dérivé — publier un article suffit
      à le référencer. Métadonnées complètes + données structurées Article schema.org.
  - [x] 2026-08-26 — **Sitemap soumis** dans la Search Console (propriete www) :
        « Operation effectuee », 7 URL decouvertes.
  - [x] 2026-08-26 — **FIX SEO : canonical et sitemap etaient en non-www** alors que le
        serveur redirige washboard.fr vers www en 308. Google recevait des signaux
        contradictoires et chaque URL du sitemap coutait une redirection. metadataBase,
        openGraph, robots.txt, SITE_URL et les liens des emails passes en www.
  - [x] 2026-08-27 — **Donnees structurees sur la page d accueil** (Organization +
        SoftwareApplication, prix derives de PLAN_CARDS). Valide par le Rich Results
        Test de Google : « 2 elements valides detectes », la ou il n y avait rien avant.
        Pas d aggregateRating : inventer des avis fait sanctionner.
  - [ ] Dans une semaine : regarder **Performances** (requetes reelles) pour choisir les
        prochains articles, et **Pages > Non indexees** pour reperer un probleme technique.
  - [ ] Publier régulièrement : un article isolé ne construit pas d'autorité. Sujets
        candidats : matériel de départ, lavage sans eau, clients professionnels.
  - [ ] Relire les fourchettes de prix de l'article tarifs avec l'expérience terrain
        d'Alexandre — ce sont des ordres de grandeur, pas des chiffres sourcés.

- [x] 2026-08-26 — **Centre d'aide dans l'espace connecté** (`/dashboard/guide`) :
      barre de recherche (accents, casse et pluriel tolérés, tous les mots doivent
      correspondre), 5 sections, 16 réponses, liens internes en bleu vers la bonne page.
      Contenu et recherche dans `lib/guide.ts`, hors du composant. 14 tests, dont un qui
      verrouille la validité de tous les liens internes.
  - [ ] Relire le contenu : il a été écrit d'après les intitulés lus dans le code, pas
        en manipulant l'interface. À confronter à la réalité écran par écran.

- [x] 2026-08-26 — **Fiche client dans le CRM** : clic sur la pastille (initiale) →
      coordonnées, adresses, nombre de lavages, CA, panier moyen, historique complet,
      alerte si le client n'est pas revenu depuis 90 jours. Aucune requête supplémentaire,
      agrégation pure dans `lib/clientProfile.ts` (11 tests). Regroupement sur l'email et
      non le nom ; les annulations ne comptent ni dans le CA ni comme visite.
  - [ ] Vérifier les chiffres sur un vrai client : c'est là qu'une erreur d'agrégation
        se verrait.

- [x] 2026-07-02 — **Stripe** : abonnement automatisé (checkout + portail + webhook),
      essai avec facturation différée, résiliation programmée, bandeaux d'état.
      Audit sécurité/fiabilité fait : blocage comingSoon + grandfathered côté serveur,
      garde-fou double-abonnement, webhook 500 sur erreur DB (retries), reset cancels_at,
      trial_end < 48h géré. Logique pure extraite dans `lib/subscription.ts` (+ tests).
  - [x] 2026-07-03 — Mineurs restants (non-code) : `NEXT_PUBLIC_APP_URL` = www en prod ;
        adaptive pricing Stripe désactivé (clients voyaient VND).
- [x] 2026-08-26 — **Phase 3 — Avis par SMS** (plan Pro) : Brevo intégré, `sendSms()`,
      quota mensuel + blocage. **Validé en prod** : SMS d'avis reçu le 2026-08-26 à 01h.
      Reste la relance par SMS à vérifier (voir « Priorité haute »).
- [x] 2026-08-26 — **Mode test des crons** : `?test=1&washer=<id>` sur `send-reviews` et
      `send-followups` court-circuite les délais (relances lues en **minutes** au lieu de
      jours, avis déclenchés sans attendre l'heure programmée). Le paramètre `washer` est
      **obligatoire** → sans lui la route renvoie 400, pour ne jamais arroser tous les
      clients par accident. Auth + client admin factorisés dans `lib/cronRequest.ts`
      (dupliqués dans 3 routes auparavant), 7 tests.
- [x] 2026-08-26 — **Les crons signalent enfin leurs échecs.** Une panne du fournisseur
      (clé manquante, quota dépassé) était avalée par le `catch` : le job répondait
      `{"ok":true,"smsSent":0}` et l'arrêt des envois passait **totalement inaperçu**.
      Découvert en testant (`BREVO_API_KEY manquant` en local). Compteur `failed` renvoyé
      + `ok:false` au premier échec → visible directement dans cron-job.org.
- [ ] **Photos avant/après** : feature premium évidente pour laveurs/detailers.
- [x] 2026-07-02 — **QA #1** : vérifier le 404 `/book` d'un vrai compte (données/slug, pas du code).
- [x] 2026-06-30 — **QA #3** : vérifié manuellement → le clic sur une carte prestation
      fonctionne. C'était bien un **artefact Playwright** (clic synthétique), pas un bug.
  - [x] 2026-07-02 — `data-testid` ajoutés : `service-card`, `category-tab`,
        `vehicle-increment`/`decrement`/`count`, `service-continue`.

## 🏗️ Infra & environnements (quand il y aura de vrais clients)

> Aujourd'hui : dev (localhost) + prod suffisent. Vercel fournit déjà des Preview
> Deployments gratuits (URL auto par branche) = recette à la demande. PAS besoin
> d'environnement de recette/staging dédié à ce stade.

- [ ] **PRIORITÉ — Séparer la base de données dev / prod.** Aujourd'hui le local et
      la prod partagent le **même projet Supabase** → tester en local mute les vraies
      données, et une manip SQL touche directement la prod. À faire dès qu'il y a des
      utilisateurs réels : projet Supabase dédié au dev (ou Supabase Branching), avec
      des variables d'env distinctes local/prod.
- [ ] **Workflow branches + Preview (optionnel)** : pour les features risquées, créer
      une branche → Vercel génère une URL de preview → valider → merger sur master.
      Évite de pousser direct en prod sur du code chaud. (Pas obligatoire en solo.)
- [x] 2026-06-30 — **Le déploiement est bloqué par les tests** : Build Command Vercel
      = `npm run test && npm run lint && npm run build` (un échec bloque la mise en ligne).
- [ ] **Environnement de recette/staging dédié** : seulement quand il y aura une
      équipe / un testeur, ou des migrations risquées. Inutile avant.

## 🟢 Polish / UX

- [x] 2026-08-26 — **Refonte du hero** (inspiration peekly.app) : ciel étoilé en CSS
      (dark uniquement) + bande de nuages en **vraie photo générée**, la même dans les deux
      thèmes. Les tentatives en dégradés CSS purs étaient vouées à l'échec — inspection du
      DOM de Peekly : leurs nuages sont une photo, pas du CSS.
      Masque SVG à bord ondulé (un fondu droit se voyait), fondu vers le bas uniquement.
      Jonction nav/hero **sans démarcation, vérifiée au pixel** (écart max 1/255 en clair,
      0/255 en sombre, contre 21/255 avant) : dégradé passé en vertical (le diagonal faisait
      varier la ligne du haut), halo aqua masqué en haut, bordure de nav retirée.
      Bande « Ce que tu fais encore à la main » forcée en blanc dans les deux thèmes.

- [x] 2026-06-29 — **Page d'accueil dashboard** : vérifiée — déjà une vraie page
      (3 cartes stats En attente/Confirmés/Terminés + liste complète des RDV). Rien à faire.
      Amélioration possible plus tard : « RDV du jour » mis en avant, raccourcis rapides.
- [~] **Accessibilité** : passe au-delà du `<h1>` déjà ajouté (focus, aria, contrastes).
  - [x] 2026-07-02 — `aria-label` sur boutons icône-seule (+/- véhicules, fermer menu),
        `aria-hidden` sur les icônes décoratives, `aria-live` sur le compteur véhicules.
  - [ ] Reste : focus-visible cohérent, contrastes, navigation clavier complète.

- [x] 2026-08-26 — **Hero : le ciel devient le fond**, photo en `cover` sur toute la hauteur
      avec un voile teinté par-dessus pour le contraste du texte (au lieu d'une bande de
      nuages en bas, qui ressemblait à un dessin et mordait sur le texte).
- [x] 2026-08-26 — **FIX : la nav ne restait pas visible au scroll.** Elle était bien en
      `position: sticky`, mais le conteneur parent portait `overflow-x-hidden` — un overflow
      autre que `visible` fait de l'élément un conteneur de défilement, et le sticky se cale
      dessus. `overflow-x-clip` coupe sans créer ce conteneur. Débordement horizontal
      revérifié nul en 1400px comme en 390px.
- [x] 2026-08-26 — **La nav devient opaque passé le hero** (blanche en clair, fond de page
      en sombre) avec un filet : sans lui, une nav blanche sur contenu blanc serait
      indistinguable. Détection par IntersectionObserver, pas par écouteur de scroll.
- [x] 2026-07-02 — **États de chargement** harmonisés : composant partagé
      `ui/Spinner.tsx`, 8 spinners SVG dupliqués factorisés (auth, AbonnementPanel,
      StepContact, CrmDashboard).

---

## ✅ Fait

- [x] 2026-07-01 — **Modèle de véhicule par le client** : à la réservation, un champ
      texte libre optionnel par véhicule (ex. « Peugeot 208 grise »). Stocké dans
      `vehicles_detail.models` (JSONB, pas de SQL). Affiché côté laveur (liste RDV +
      calendrier), sur la confirmation client et le PDF.
- [x] 2026-07-01 — **Badge de plan dans le dashboard** : visible dans le header sur toutes
      les pages (Essentiel/Pro/Business, ou « Accès complet » si grandfathered), cliquable
      → page Abonnement.
- [x] 2026-07-01 — **Choix du slug** : le laveur édite son lien `/book/...` depuis
      Paramètres → Page client. Validation serveur (format + unicité), saisie filtrée.

- [x] 2026-06-29 — Slogan rotatif du hero (3 phrases animées)
- [x] 2026-06-29 — Page 404 personnalisée (`not-found.tsx`)
- [x] 2026-06-29 — Plafond serveur du nombre de laveurs (#16)
- [x] 2026-06-29 — Fix badge dev « Issue » (thème via cookie, plus de `<script>` React)
- [x] 2026-06-29 — Désactivation / suppression de compte (RGPD) + purge 30j (cron)
- [x] 2026-06-29 — Validation des formulaires + messages d'erreur stylés (rapport QA tour 3)
- [x] 2026-06-29 — Catégories de prestations personnalisables (+ types dynamiques)
- [x] 2026-06-29 — **Offres tarifaires** : 3 plans (Essentiel/Pro/Business) + gating + grandfathering
- [x] 2026-06-29 — **Suivi client** : demande d'avis Google par email (déclenchement sur « terminé » + délai + cron)

---

## 📌 SQL / config en attente (à exécuter en prod si pas déjà fait)

> Base locale = base de prod (même projet Supabase) au 2026-06-29.

- [x] 2026-08-26 — **Audit complet des droits `service_role`, sur TOUTES les tables.**
      Le point « vérifier que tout le SQL est passé » traînait depuis juin, et un `GRANT`
      oublié avait déjà causé le bug des congés. Cette fois les tables ne sont plus devinées
      à la main : elles sont énumérées via le schéma OpenAPI de PostgREST.
  - 8 tables exposées, **2 auxquelles il manquait les droits** : `washer_expenses` et
    `washer_recurring_expenses` (SELECT **et** DELETE refusés, `42501`).
  - **Conséquence RGPD** : le cron de purge des comptes supprime ces tables via le
    service-role. La suppression était refusée et l'erreur non vérifiée → les données de
    dépenses d'un compte supprimé pouvaient survivre à la purge, sans aucune trace.
  - `GRANT SELECT, DELETE` passés en prod le 2026-08-26. Droits revérifiés : tout est OK.
  - **Aucune donnée n'a fuité** : 0 ligne orpheline, et aucun compte n'était encore en
    attente de suppression. Le bug était latent, pas encore déclenché.
  - Code corrigé : erreur vérifiée et tracée, compteur `failed` renvoyé, et en cas d'échec
    le laveur est sauté au lieu que son compte auth soit supprimé — sinon ses lignes de
    dépenses deviendraient orphelines et non rattachables.
  - Purge rejouée après le GRANT : `{"ok":true,"purged":0,"failed":0}`.
  - **4ᵉ occurrence du motif « échec silencieux »** de la journée, après le bug RLS, le
    honeypot et les congés.
- [x] 2026-08-26 — `GRANT SELECT ON public.unavailabilities TO service_role;` passé en prod
      (lecture vérifiée OK, blocage d'un RDV en congé retesté de bout en bout → 409).
- [x] 2026-07-02 — `CRON_SECRET` défini dans Vercel.
- [x] 2026-07-02 — Cron-job.org : `https://washboard.fr/api/cron/send-reviews` toutes les heures,
      header `Authorization: Bearer <CRON_SECRET>`.
- [x] 2026-08-26 — **Facturation Google Cloud réactivée** (projet `washboard-496704`).
      L'essai gratuit avait expiré le 17/08 → `REQUEST_DENIED` sur toutes les API Maps :
      autocomplétion d'adresse, zones de couverture et frais de déplacement étaient **cassés
      en prod**. Places / Geocoding / Distance Matrix vérifiées OK depuis.
      Budget d'alerte « WashBoard Maps Alert » : 10€/mois, seuils 50/90/100%.
      Note : **aucun crédit Maps récurrent** sur le compte (le crédit d'essai de 256,52€ a
      expiré sans être consommé) — on est en compte payant, à 0€ grâce aux paliers gratuits.
  - [x] 2026-08-26 — Clé Vercel vérifiée : l'autocomplétion répond en production, la clé
        est donc valide et facturée. Rien à changer côté Vercel pour Maps.
