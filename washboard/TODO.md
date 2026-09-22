# WASHBOARD — TODO

> **Bloc-notes du projet (long terme).**
> Convention :
> - `[ ]` = à faire · `[x]` = fait (ajouter la date `AAAA-MM-JJ`)
> - Quand une tâche est terminée → la cocher + dater (la laisser dans la liste ou
>   la déplacer en bas dans « ✅ Fait »).
> - Toute nouvelle tâche découverte → l'ajouter dans la bonne section.
>
> Dernière mise à jour : 2026-09-21 (audit post-lancement : vitesse, contraste, image de
> partage, CGU et acceptation des CGV). Avant : 2026-09-14 (réseaux sociaux,
> facturation électronique ; légal et Stripe live repoussés vers mi-novembre ; landing
> livrée ; et plus tôt : compte d'essai EssaiAuto à supprimer, blog SEO, centre d'aide,
> fiche client, forfaits annuels)

---

## 🔴 Priorité haute

- [ ] **AVANT LE 5 OCTOBRE 2026 — Quota Supabase dépassé.** Bandeau vu le 2026-09-14 dans
      le tableau de bord Supabase : « Organization exceeded its quota in the previous billing
      cycle. Projects will be restricted from 05 Oct, 2026 if your organization remains over
      quota. » Une restriction couperait les pages de réservation de tous les laveurs.
  - Mesuré le 2026-09-14 (lecture seule) : base **14 Mo**, fichiers stockés **2,1 Mo**
    (fonds 1,6 Mo dont un de 510 Ko, logos 0,5 Mo). Loin des limites : le dépassement est
    très probablement la **bande passante sortante** (egress).
  - Cause probable : les fonds et logos téléversés sont servis **directement depuis
    Supabase** (`getBgStyle` met l'URL publique dans un `background-image`), à chaque visite
    d'une page de réservation, sans cache Vercel. La vidéo TikTok virale du 2026-09-04 a
    multiplié les visites.
  - À faire : (1) confirmer le poste en cause sur la page Usage de l'organisation Supabase ;
    (2) servir fonds et logos via l'optimisation d'images de Next (`/_next/image`, mise en
    cache par Vercel, ~5× plus légers) ; (3) vérifier que l'organisation n'a pas d'autre
    projet qui consomme ; (4) si besoin, passer en offre Pro Supabase avant le 5 octobre.

- [ ] **Audit post-lancement du 2026-09-21 (liste « 20 points à vérifier » vue sur TikTok).**
      Fait par Ryan, en lecture seule, sur www.washboard.fr et le code à jour. **15 points
      déjà en place, 5 restent.** Ordre prévu par Ryan : la vitesse d'abord (session
      suivante).
  - [ ] **1. Vitesse de chargement.** Mesuré en 4G lente, sur un téléphone moyen (CPU ×4) :
        blog LCP 1,3 s (très bon), accueil LCP 2,3 s (bon), **page de réservation LCP 3,1 s,
        dont 2,3 s d'attente du serveur (TTFB)** — c'est la page que voient les clients des
        laveurs. Une seule mesure : la refaire d'abord pour écarter un démarrage à froid.
        Sur l'accueil, **CLS 0,155** (seuil 0,1) : le contenu bouge pendant le chargement.
        PageSpeed Insights n'a pas pu être utilisé (quota Google épuisé ce jour-là).
        Agent : `dev`.
  - [ ] **2. Contraste des couleurs.** axe-core, WCAG AA, mode clair : 6 à 12 éléments en
        échec par page publique. Cause principale : `text-slate-400` (#90a1b9) sur fond
        blanc = **2,63:1** (minimum 4,5:1) — pied de page, dates d'articles, petites
        mentions, liens légaux. Aussi `#62748e` sur fonds bleutés (4,3:1) et l'onglet actif
        de la page de réservation (`#0ea5e9` sur `#ecf8fd`, 2,56:1). `/signup` et `/login`
        passent. Lié à « Accessibilité » dans 🟢 Polish. Agent : `designer`.
  - [ ] **3. Image de prévisualisation de la page d'accueil.** Le blog (une image par
        article) et les pages de réservation (logo du laveur) en ont une ; **l'accueil
        n'a ni `og:image` ni `twitter:image`**, alors que `twitter:card` vaut
        `summary_large_image`. C'est le lien le plus partagé. Ajouter
        `src/app/opengraph-image.tsx` sur le modèle de `src/app/blog/opengraph-image.tsx`.
        Agent : `designer` pour le visuel.
  - [ ] **4. CGU.** Pas de page. Ryan : à faire. Agent : `legal`.
  - [ ] **5. Acceptation des CGV à l'inscription.** Les CGV existent, mais `/signup` ne
        demande pas de les accepter (ni la politique de confidentialité) : sans trace
        d'acceptation, elles sont difficilement opposables à un laveur en cas de litige
        (impayé, résiliation contestée). Case à cocher + date d'acceptation enregistrée.
        À faire avec le point 4 (une seule case pour CGU et CGV). Agents : `legal` pour le
        texte, `dev`, relecture `cyber` (ça touche l'inscription).
  - Détails mineurs relevés : `/login`, `/signup` et la page 404 reprennent le titre de
    l'accueil ; `robots.txt` bloque `/register`, qui n'existe pas (la route est `/signup`) ;
    `/confidentialite` ne cite pas la mesure d'audience (Vercel Analytics, sans cookie) ;
    la vidéo `tuto.mp4` (14 Mo) de l'accueil n'a ni `poster` ni `preload="none"` ;
    5 libellés différents pour le même bouton d'inscription.
  - **Déjà en place, inutile de revérifier** : page RGPD (`/confidentialite`), aucune clé
    secrète dans le code envoyé au navigateur (1,3 Mo analysés, `.env` hors git), HTTPS
    forcé + HSTS, **pas de bandeau cookies nécessaire** (seulement le cookie de session et
    le thème ; il le deviendra si on ajoute Google Analytics ou le pixel Meta), title et
    description sur toutes les pages, favicon, sitemap et robots.txt, 0 image sans `alt`,
    images de l'accueil en webp (17 à 47 Ko), aucun débordement à 390 px, page 404
    personnalisée avec un vrai code 404, aucun guillemet cassé dans le texte visible,
    formulaires validés (et zod côté serveur pour la réservation), anti-spam (piège à robots
    sur la réservation, plafonds sur inscription, réservation, mot de passe, support et
    Maps — compteurs en mémoire par instance, suffisant pour l'instant), analytics (Vercel
    + entonnoir maison anonyme), un seul objectif pour tous les CTA (`/signup`). Routes de
    test fermées en production (`/api/e2e/cleanup` 403, `/api/debug/reviews` 401).
  - **QUESTION POUR ALEXANDRE** : les points 1, 3 et 5 touchent l'accueil, la page de
    réservation et l'inscription, qui sont dans ton périmètre. OK pour que Ryan s'en
    charge, ou tu préfères les prendre ?

- [x] 2026-09-14 — **Corrigé** : enregistrement refusé sans type (écran et serveur, règle
      commune `lib/prestation.ts`, 11 tests), message qui dit ce qui manque, « Sans
      catégorie » réservé aux anciennes prestations qui n'en ont pas (et leurs types ne sont
      plus effacés), étape « Créer ma première catégorie » sur un compte neuf, prestations
      sans type cachées de la page publique et signalées en rouge au laveur. Au passage :
      la ligne « Options & suppléments » ne s'écrase plus sur téléphone. Test e2e du cas
      « tout décoché ». Constat d'origine :
- [x] **L'écran Prestations piège les nouveaux inscrits.** Relevé par `ideas` en réunion
      d'équipe le 2026-09-14, après lecture de `PrestationsManager.tsx` (le bouton
      Enregistrer n'est pas en cause : `canSave` ne dépend que du nom, du prix et de la
      durée). Deux vrais pièges :
  - une prestation n'existe qu'après avoir créé une catégorie, sur un autre écran, et
    rien ne l'explique clairement ;
  - choisir « — Sans catégorie — » **vide sans prévenir les types déjà cochés**, ce qui
    rend la prestation impossible à réserver.
  Symptôme constaté chez un inscrit : tout configuré, page publique sans rien à réserver.
  À faire : `designer` sur l'enchaînement catégorie → prestation (état vide explicite,
  garde-fou quand aucun type n'est coché), puis `dev`. Montrer le rendu avant de pousser.

- [x] 2026-09-14 — **Refus anti-abus de la réservation tous tracés.** Demandé en réunion
      d'équipe (« donner à `cyber` un accès aux journaux »). Constat : les journaux Supabase
      ne servent à rien ici (les réservations publiques passent par notre serveur, Supabase
      ne voit jamais l'attaquant), et deux des trois protections de `api/bookings` ne
      laissaient aucune trace. Ajoutés : `bookings.rate_limited` et
      `bookings.daily_cap_reached` ; l'email client retiré de `bookings.honeypot_triggered`
      (remplacé par l'IP). La vraie surveillance est repoussée, voir « Infra & environnements ».

- [x] 2026-09-11 — **7 secrets GitHub créés**, vérifié sur la CI de `b8f6402` : le job e2e
      va jusqu'au bout (navigateur, build, tests de bout en bout, nettoyage). Historique —
      ils étaient requis pour que le job e2e
      de la CI tourne réellement. Sans eux, le job s'arrête proprement avec un
      avertissement (il ne casse pas le build, mais ne teste rien).
      Dans *Settings → Secrets and variables → Actions* du dépôt :
      `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`
      (valeurs de `washboard/.env.local`), `E2E_WASHER_EMAIL`, `E2E_WASHER_PASSWORD`,
      `E2E_WASHER_SLUG`, `E2E_CLIENT_EMAIL` (valeurs de `washboard/.env.test.local`).

- [x] 2026-08-30 — **Couverture e2e complète + branchée sur la CI.** 22 → **123 tests**
      couvrant l'inscription et ses validations, la connexion, le mot de passe oublié,
      la réinitialisation, le parcours de réservation complet, l'administration de la
      page client (prestations, disponibilités, zone, créneaux intelligents), la compta
      (4 périodes, dépenses, récurrents), le CRM (entonnoir, liens par réseau, export),
      le calendrier (3 vues), les paramètres, l'abonnement, le guide, le blog, les pages
      légales, le SEO (sitemap/robots/JSON-LD) et les protections d'API (crons sans
      secret, routes authentifiées vues d'un anonyme, honeypot).
      Le job CI tourne sur un **build de production**, pas le serveur de dev.
      ⚠️ La base Supabase étant partagée avec la prod, tout objet créé est préfixé
      `[E2E]` et supprimé en `afterEach`, plus un nettoyage `always()` en CI. Aucun test
      ne crée ni ne supprime de compte.
      Corrigé au passage : `playwright.config.ts` ciblait `localhost:3000` en dur, port
      occupé par un autre projet (Folyo) — les tests visaient la mauvaise application et
      échouaient sans qu'on comprenne pourquoi. Port configurable via `E2E_PORT`.

- [x] 2026-08-30 — **Audit de dette technique (méthode SonarQube) et réduction.**
      Dette mesurée : **197,7 h ≈ 24,7 jours** · ratio 1,96 % → **note A**
      (formule SonarQube : coût de remédiation / coût de développement estimé).
      La note est bonne, mais elle vient du volume du projet : l'essentiel de la dette
      restante est concentrée dans **10 composants monolithiques** (80 h) et
      **11 fichiers de plus de 400 lignes** (44 h) — voir la section dédiée plus bas.
      Réduit dans la foulée :
      - **2 bugs réels trouvés en écrivant les tests** (voir entrées dédiées) ;
      - couverture `src/lib` : 93,4 % → **96,5 %** (branches 88,7 % → 93,7 %) ;
      - tests unitaires : 277 → **371** ;
      - **plus aucune fonction dupliquée dans le projet** (4 éliminées, dont
        `haversineKm` qui existait en double alors qu'elle décide si un client est
        dans la zone d'intervention — deux implémentations d'une règle
        d'autorisation) ;
      - 20 `console.*` convertis vers le logger structuré (observabilité) ;
      - 168 lignes de CSS dupliquées factorisées ;
      - blocs dupliqués entre fichiers : 70 → 42 ;
      - avertissements ESLint : 25 → 23 (les 23 restants sont le motif
        `set-state-in-effect` assumé dans `eslint.config.mjs`).
      Nouveaux modules extraits et testés : `calendarLayout`, `comptaPeriod`,
      `crmStats`, `categoryTypes`.

- [x] 2026-08-30 — **BUG CORRIGÉ : la semaine comptable commençait le dimanche.**
      Trouvé en extrayant la logique de période de `ComptaDashboard` pour la tester.
      `toISO` formatait via `toISOString()`, donc en UTC : la France étant toujours en
      avance sur UTC, toute date prise à minuit reculait d'un jour. Conséquences réelles
      pour le laveur : le CA hebdomadaire incluait le dimanche précédent et excluait le
      dimanche courant (**en permanence**), et la vue « Jour » consultée avant 2 h du
      matin affichait la veille. Le projet avait pourtant déjà la bonne fonction
      (`toDateStr`) : `ComptaDashboard` avait redéfini la sienne. Corrigé et couvert par
      22 tests (`lib/comptaPeriod.ts`).

- [x] 2026-08-30 — **BUG CORRIGÉ : facturation non testée.** `graceEnded` (décide si on
      **bloque les réservations** d'un laveur) et `monthsOwed` (décide **combien il
      doit**) n'avaient aucun test — `plan.ts` plafonnait à 33 % de branches. Pas de
      défaut trouvé dans leur logique, mais le risque était entier : 14 tests ajoutés,
      à dates figées. `plan.ts` est désormais à 100 %.

- [x] 2026-08-30 — **Comptes fantômes `auth.users` : cause tracée.** Le rollback
      existait bien dans `signup/route.ts` (confirmé par `cyber` et `dev`), mais **rien
      n'y était loggué** : ni l'échec d'insert `washers`, ni l'échec du rollback
      lui-même — or c'est ce second cas qui crée un compte fantôme (email pris à vie,
      aucune fiche laveur, plus de réinscription possible), exactement le cas
      `spotifypren1234@gmail.com` du 2026-08-28. Trois `logger.error` ajoutés, en
      distinguant le doublon d'email (cas normal) d'une vraie panne. La prochaine
      occurrence laissera une trace exploitable.
      Reste optionnel : compter les comptes fantômes déjà existants (requête lecture
      seule sur prod, à faire avec l'accord d'Alexandre).

- [x] 2026-08-28 — **5 comptes de test supprimés de la base** (`thf`, `Washing`,
      `Compte Démo`, `TestClaude`, `TesteurOrg`) à la demande d'Alexandre — même procédure
      que la purge RGPD (`api/cron/purge-accounts` : dépenses → logo storage → utilisateur
      auth, cascade sur `washers`/bookings/services). `ysclean` (actif, probablement le
      compte de Yanis) et `BellAuto89` (essai en cours) conservés après vérification.
      Ne restent que Kooki Clean, Kookii Clean, ysclean, BellAuto89.

- [x] 2026-08-28 — **Paiement PayPal de l'engagement annuel vérifié de bout en bout par
      Alexandre**, confirmé bon. Calcul du montant correct côté code (`AbonnementPanel.tsx`,
      `amountFor()` utilise `yearlyPrice()` de `lib/plan.ts`), lien `paypal.me/WashBoardSAAS/
      <montant annuel>` fonctionnel.

- [x] 2026-08-28 — **Défilement des avis clients corrigé** sur la page de réservation
      publique. Signalé par Alexandre : la section "Avis clients" restait figée sur les
      premiers avis (`overflow-x-auto` seul, sans barre visible ni flèche). Extrait en
      composant dédié `components/booking/ReviewsCarousel.tsx` : flèches gauche/droite
      (affichées seulement quand il y a de quoi défiler de ce côté) + scroll-snap +
      voile en dégradé derrière chaque flèche. Puis, sur retour d'Alexandre : flèches
      retirées au profit d'un défilement automatique (7 s), 1 avis à la fois sur mobile
      (la 2e carte était coupée), 2 à partir de `sm`.

- [x] 2026-08-30 — **Sélecteur de jour (`StepSlot.tsx`) : même défaut corrigé.** 14 jours
      proposés mais 5-6 visibles, sans aucun indice de défilement — un client pouvait
      croire qu'il n'y avait plus de disponibilité après le dernier jour affiché. Voile
      en dégradé des deux côtés, affiché seulement quand il reste des jours hors écran.
      Pas de défilement automatique ici (contrairement aux avis) : c'est une sélection
      active, un déplacement subi serait pénible.

- [x] 2026-08-30 — **5 vulnérabilités npm → 0.** `npm audit fix` règle `brace-expansion`,
      `tmp` et `protobufjs`. Pour `uuid`, npm proposait de rétrograder `exceljs`
      4.4.0 → 3.4.0 (breaking) : vérifié qu'`exceljs` n'appelle que `uuid.v4` alors que
      la faille ne concerne que `v3/v5/v6` avec buffer — non atteignable. Résolu par un
      `override` npm vers `uuid@11.1.1` sans toucher à `exceljs`. Vérifications de
      non-régression : 7 paquets de prod changés seulement (les 4 vulnérables + 2 jeux de
      données navigateur), 22 paquets restants en dev uniquement ; `uuid` n'a qu'un
      dépendant (`exceljs`) et n'est utilisé nulle part dans notre code ; export Excel du
      CRM re-testé de bout en bout ; **22/22 tests e2e verts**.

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

- [x] ~~**La routine cloud "réunion d'équipe quotidienne" n'a pas les droits d'écriture
      sur le dépôt GitHub.**~~ **Résolu — constaté le 2026-09-07.** Le problème datait
      du tout premier jour (2026-08-27) : `git push` renvoyait un 403 et le rapport
      était resté dans la session cloud. Les droits ont été accordés depuis, et la
      preuve est dans l'historique : **12 rapports pour 12 jours, aucun manquant**, du
      2026-08-27 au 2026-09-07, publiés chaque matin entre 9h05 et 9h12 (heure de
      Paris). Seul le tout premier a dû être rattrapé à la main.
      Ce qui reste, et qui n'est pas un défaut : quand on travaille en local sans avoir
      récupéré le rapport du matin, `git push` est refusé. `pull.rebase` est passé à
      `true` sur le poste d'Alexandre pour que `git pull` rejoue les commits locaux
      par-dessus, sans commit de fusion parasite.

- [x] 2026-08-27 — **Migration SQL de l'entonnoir de réservation appliquée** (table
      `booking_funnel_events`, `washboard/supabase/migrations/003_booking_funnel_events.sql`).
      Collée à la main dans l'éditeur SQL de Supabase par Alexandre. Confirmé
      fonctionnel : la page CRM affiche des données réelles (visiteurs, conversion,
      répartition appareil/source, timing des visites) sur le compte Kooki Clean.
      ⚠️ Rappel qui reste valable : le fichier avait été créé par l'agent `dev`
      sous forme de migration, ce qui contredit la convention du projet (SQL donné
      inline dans le chat, jamais de fichier de migration) — à rappeler à `dev`/`cyber`
      pour la prochaine fois.

- [x] 2026-08-28 — **Next.js mis à jour (16.2.6 → 16.3.3), mergé sur master.** Trouvé par
      l'agent cyber le 2026-08-27 via `npm audit --omit=dev`. La plus
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
      avant le commit. **Test manuel du golden path fait par Alexandre** (page de
      réservation publique) : confirmé bon. **`cyber` a rendu un GO explicite** le
      2026-08-28 après audit indépendant (légitimité npm confirmée, `npm audit` reproduit,
      diff limité à `package.json`/lock, recherche des CVE Next.js récentes — a même
      vérifié que la faille critique RCE via l'optimisation d'images AVIF ne concerne pas
      WashBoard, `next/image` n'y étant utilisé qu'avec des images locales/statiques).
      Fusionné sur `master` (commit `ff672e9`), tsc/lint/277 tests re-vérifiés après
      fusion, poussé.

- [x] 2026-08-26 — **Branche `feat/refonte-hero-et-forfaits` poussée puis mergée sur master.**
      Yanis avait corrigé le bug des congés de son côté en parallèle : les deux correctifs
      ont été conservés (voir la section « Priorité haute » plus bas). Le mode test des
      crons est donc disponible en prod.

- [x] 2026-08-26 — **Relance par SMS validée** (smsSent: 1) apres ajout de BREVO_API_KEY
      en local. Les deux canaux, avis et relance, sont verifies de bout en bout.

- [x] 2026-08-26 — Réservation de test `dbd2b4f2` supprimée chez Kooki Clean. Kookii Clean
      (le vrai client) vérifié intact : 41 réservations.

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

## 🎨 Refonte 2026 — état de la branche `refonte-pwa` au 2026-09-22

> Écrit par le Claude de Ryan en fin de session, pour que celui de Yanis ou
> d'Alexandre reprenne sans redécouvrir. **Passes 0 à 3 faites, la 4 est la
> suivante.** Le plan de vol complet est dans `.claude/agents/refonte.md`.

- [ ] **CHANGEMENT D'ARCHITECTURE (2026-09-22, pas encore commité) — v2
      seulement dans la PWA installée, jamais sur le site.** Alexandre : « moi
      je veux que la PWA ressemble a une app mais que le site web que ce soit
      sur mobile ou ordinateur reste comme actuellement ». Les passes 2 et 3
      avaient posé la v2 **sans aucune condition** (n'importe quel visiteur du
      site la voyait) — retrofité par un Claude dédié, en attente de relecture
      et de commit par l'orchestrateur :
  - Deux mécanismes de détection, documentés en détail dans
    `.claude/agents/refonte.md` (section « v1 sur le site, v2 seulement dans
    la PWA installée ») : la classe `wb-pwa` posée sur `<html>` par un script
    `beforeInteractive` (`layout.tsx`) pour un changement purement visuel, et
    le hook `usePwaStandalone()` (`src/hooks/usePwaStandalone.ts`, basé sur
    `src/lib/pwaStandalone.ts`) pour un changement de FORME.
  - `ClientsView.tsx` et `ClientProfileModal.tsx` sont redevenus des points
    de branchement (comparaison v1/v2 : structure trop différente pour du CSS
    seul → hook, pas de classe). Le code v1 vient de `git show
    8a1efa6:washboard/src/components/dashboard/<fichier>.tsx` repris à
    l'identique dans `ClientsViewV1.tsx` / `ClientProfileModalV1.tsx` ;
    l'ancien contenu (v2) est devenu `ClientsViewV2.tsx` /
    `ClientProfileModalV2.tsx`. `CrmDashboard.tsx` (l'ancien CRM, pas migré)
    importe toujours `ClientProfileModal` sans rien savoir du branchement.
  - Vérifié : `tsc`, `eslint` (33 avertissements, baseline 32 + 1 attendu —
    pattern `mounted` déjà présent sur `ThemeToggle`/`NotificationsToggle`),
    `vitest run --coverage` (nouveau test `pwaStandalone.test.ts`, 100 % sur
    le fichier), `next build` propre, et un script Playwright jetable
    (jamais commité) qui capture Clients + la fiche en 4 combinaisons
    (site/PWA émulée × clair/sombre) sur `npm run dev` **et** sur
    `npm run build && npm run start` — 16 captures au total, toutes
    conformes. **Non fait : installation réelle de la PWA sur un appareil.**
  - **Pour la suite (passes 4 à 8) : poser ce branchement DÈS L'ÉCRITURE de
    l'écran**, schéma `EcranV1.tsx` / `EcranV2.tsx` + `Ecran.tsx` en point
    d'entrée — voir `.claude/agents/refonte.md`, mis à jour avec un exemple
    complet.
- [x] **Passe 0** `e630338` — socle mobile. Rien ne bouge à l'écran. Les règles
      qui auraient changé une page publique (tirer-pour-rafraîchir, sélection
      des liens) sont limitées au dashboard via `body.wb-dashboard-active`.
- [x] **Passe 1** `8a1efa6` — jetons v2 sous le préfixe `--v2-` dans
      `globals.css`, Archivo variable exposée en `--font-archivo`, appliquée
      nulle part. Archivo pèse ~88 Ko contre ~29 Ko pour Geist : mesuré, assumé.
- [x] **Passe 2** `d6e6623` — liste Clients, écran pilote, premier écran en v2.
      Voir le changement d'architecture ci-dessus : retrofité le 2026-09-22
      pour ne s'appliquer qu'à la PWA installée.
- [x] **Passe 3** `31a42de` — fiche client en feuille, plus Appeler/Message,
      piège de focus et retour du focus. Même retrofit que la passe 2.
- [ ] **Passe 4 — barre du bas derrière `washers.beta_refonte`.** Lancée puis
      arrêtée avant toute écriture (quota). Deux contraintes à ne pas perdre :
  - le SQL se donne à Ryan pour qu'il le colle dans Supabase, **jamais un
    fichier de migration**, et `cyber` le relit avant ;
  - **le code doit tourner AVANT que la colonne existe.** La branche peut être
    déployée ou fusionnée sans que le SQL soit passé : un `select` sur une
    colonne absente casse l'écran pour tout le monde, Kookii Clean comprise.
    Drapeau absent = éteint, en silence.
  - Vérifier ce qui devient inatteignable si la barre remplace le menu : c'est
    le bug qui a tué la première version du CRM (six pages orphelines). Le menu
    latéral reste le filet tant que les passes 5 et 6 ne sont pas faites.
- [ ] Passes 5 à 8 : Chiffres (CRM + compta), Plus, Agenda, Aujourd'hui en
      dernier. Voir le plan de vol.

**La maquette v2 est lisible en local**, dans `WashBoard/maquette_v2/` sur le
poste de Ryan (hors dépôt, ~12 Mo) : les 20 écrans en image plus, pour chacun,
la taille de police et la position exactes de chaque ligne de texte. Utile si
l'outil Artifact n'est pas accessible. Lire `LISEZMOI.md` d'abord. Source :
l'artifact « WashBoard — direction v2 » exporté en PDF.

**Comment les passes ont été menées** — à reprendre tel quel, ça a bien marché :
un agent `refonte` **neuf par passe** (son contexte se dégrade sinon, son propre
plan de vol le dit), l'agent **ne commite jamais** (l'orchestrateur relit le
diff, relance typecheck + eslint + `vitest run --coverage`, puis commite), et
chaque passe rend une capture clair **et** sombre comparée à la maquette.
Depuis le retrofit du 2026-09-22 : **quatre captures par écran qui change de
forme**, pas deux — site (display-mode: browser) et PWA (display-mode:
standalone, émulée dans Chrome DevTools → Rendering), chacun clair et sombre.
Une capture « site » qui montre du v2 est un bug bloquant, pas un détail.

**Trois pièges rencontrés, qui ne se voient dans aucun outil :**
- un motif entre crochets écrit **dans un commentaire** JSX est lu par le
  scanner de classes de Tailwind v4, qui tente d'en faire du CSS et fait
  planter la compilation. Ni `tsc`, ni `eslint`, ni `vitest` ne le voient :
  seul le lancement réel de l'app le montre ;
- après un `next dev` interrompu, `npm run typecheck` échoue sur un fichier de
  types généré à moitié → `rm -rf .next` avant de conclure quoi que ce soit ;
- `npm install` remet un `"dev": true` sur `fsevents` dans `package-lock.json`,
  et `next dev` réécrit `AGENTS.md` : à écarter de chaque commit.

**Valeurs encore non vérifiées, signalées en commentaire dans `globals.css` :**
l'ambre et le rouge en sombre, et `--v2-filet-fort` en sombre (extrapolé) —
aucun écran sombre de la maquette ne permet de les mesurer.

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

- [ ] **QUESTION POUR ALEXANDRE — faut-il ajouter `jsdom` + `@testing-library/react`
      pour pouvoir tester les composants ?** Posée par Ryan le 2026-09-19. Rien n'a été
      installé : ajouter deux dépendances engage le projet sur la durée, ce n'est pas une
      décision d'un seul côté.
  - **Ce qui a motivé la question, un cas réel.** En corrigeant les compteurs du canal
    d'assistance, une régression a été introduite : un `useRef` de garde jamais remis à
    `false` au remontage laissait la liste des fils **définitivement vide** en mode
    développement (React Strict Mode monte, démonte et remonte chaque composant). Pire que
    le défaut d'origine, et précisément dans le contexte où l'on teste. Elle n'a été
    attrapée que par un essai manuel au navigateur, avec Playwright et des appels réseau
    simulés. **Aucun test automatique du dépôt ne pouvait la voir**, et elle serait passée
    en production si personne n'avait regardé l'écran.
  - **Pourquoi c'est structurel, pas accidentel.** Il n'existe aujourd'hui aucun test de
    composant React dans `src/components` — la configuration Vitest écarte d'ailleurs
    explicitement quatre hooks de la mesure de couverture au motif qu'ils sont
    « untestables sans DOM » (`vitest.config.ts`, la note y est déjà écrite). La règle du
    projet dit qu'on n'écarte que ce qui n'est pas mesurable, jamais ce qui est seulement
    fastidieux — mais ici la liste des exclusions s'allonge à chaque fonctionnalité, et
    c'est exactement la zone où la dernière régression est née.
  - **Le coût.** Deux dépendances de développement, une configuration Vitest à passer en
    environnement `jsdom` pour ces fichiers, et des tests à écrire. Le gain : pouvoir
    tester un cycle monte / démonte / remonte, les effets, et le comportement réel des
    hooks — au lieu de les exclure de la mesure.
  - **À trancher par toi**, c'est ton projet autant que le sien. Si tu dis non, il faudra
    au moins assumer que cette zone reste vérifiée à la main, et le dire clairement dans
    la configuration plutôt que sous l'étiquette « non mesurable ».

- [ ] **QUESTION POUR ALEXANDRE — la question « Avez-vous fait ce rendez-vous ? » ne
      protège qu'une des deux vues. Est-ce voulu ?** Relevé par Ryan le 2026-09-15 en
      documentant le centre d'aide. Rien n'a été modifié : c'est ta fonctionnalité,
      livrée le matin même, et tu as peut-être tranché sciemment. Constat et pistes
      ci-dessous, à toi de dire ce qu'on en fait.
  - `ConfirmerCloture` n'est importé que par `BookingList.tsx`, donc la protection
    n'existe que sur la page d'accueil `/dashboard`. Dans `CalendrierDashboard.tsx`
    (ligne ~1529), « Marquer terminé » appelle directement `updateStatus(id, 'done')`
    pour tout rendez-vous `pending`/`confirmed`, **passé ou non, sans poser la question**.
  - Ce qui rend la chose gênante : le rappel du soir pointe vers `/dashboard/calendrier`
    (`lib/rappelTerminer.ts` ligne 54), c'est-à-dire vers la vue **non protégée**. Le
    laveur reçoit à 22 h « N rendez-vous à marquer Terminé pour vos factures », tape la
    notification, et peut tout clôturer d'un clic — en émettant les factures — sans
    qu'on lui demande si les rendez-vous ont eu lieu. C'est exactement le cas que
    `9646bc0` visait à empêcher.
  - Chronologie, qui ne tranche pas : `0fc718a` (rappel, 10h38) précède `9646bc0`
    (clôture, 11h26), mais `87bdcae` (11h51) a retouché la notification **après** la
    protection — sur son titre et son texte, pas sur sa destination.
  - **Piste A, une ligne** : faire pointer le rappel du soir vers `/dashboard`. Écrit
    puis **annulé volontairement** le 2026-09-15 — après vérification, ce n'est pas une
    correction mais un arbitrage produit, donc ton appel. Le pour : l'accueil est la vue
    protégée, et sa liste est même plus large (`BookingList.tsx` ligne 82 ne filtre que
    sur le statut, sans plafond de date ni pagination : tous les rendez-vous du jour non
    terminés, **plus** ceux restés ouverts les jours d'avant). Le contre : l'accueil n'a
    aucun filtre « aujourd'hui », le laveur doit lire la date sur chaque carte, là où le
    calendrier montre la journée d'un coup d'œil. On échange de la lisibilité contre de
    la sécurité — à toi de dire si le change en vaut la peine.
  - **Piste B, le vrai correctif** : porter `ConfirmerCloture` dans le calendrier.
    Analysé le 2026-09-15, **non implémenté délibérément** : le fichier fait 1 544 lignes,
    il est signalé plus bas comme le plus risqué du projet, et **aucun test ne couvre
    cette zone** (aucun test de composant React dans le projet ; `e2e/dashboard-calendrier.spec.ts`
    n'ouvre jamais un rendez-vous et ne clique jamais « Terminé »). Ce qu'on a trouvé,
    si tu décides de t'y mettre :
    - **Le piège principal** : le calendrier n'a **aucune notion d'expiration** — pas de
      `isExpired` dans tout le fichier. Le bouton « Terminé » (ligne 1529) s'affiche pour
      tout rendez-vous `pending`/`confirmed`, passé **ou à venir**. Brancher
      `ConfirmerCloture` dessus sans condition ajouterait une confirmation aux clôtures
      faites à l'heure, ce qui n'est pas le comportement de l'accueil. Il faut d'abord
      recréer l'équivalent de `isExpiredPending`/`isExpiredConfirmed`
      (`BookingList.tsx` lignes 146-147) en comparant `scheduled_at` à maintenant.
    - Sur les **trois** appels à `updateStatus` du fichier, **seul celui de la ligne 1529
      est concerné**. Ceux des lignes 1517 (« Confirmer ») et 1537 (« Annuler ») doivent
      rester strictement inchangés. Aucune action groupée n'existe.
    - `updateStatus` (ligne 485) doit accepter `closedLate`, comme `BookingList` lignes
      56-75. La route API l'accepte déjà sans contrainte (`api/bookings/[id]/route.ts`
      lignes 28 et 51) et aucun effet de bord n'en dépend — tous testent `status` seul.
    - `facturationPrete` : aucun coût, la page calendrier charge déjà `washer` en
      `select('*')`, il suffit de calculer `infosFacturationManquantes(washer).length === 0`
      et de passer la prop, comme `dashboard/page.tsx` ligne 89.
    - Le type `Booking` du calendrier (lignes 18-40) ignore `closed_late` et
      `is_professional`, que `BookingList` et `clientProfile` ont tous les deux.
    - Prévoir un test e2e : un rendez-vous passé ouvre bien la boîte, un rendez-vous à
      venir se clôture toujours d'un clic sans elle.

- [x] 2026-09-16 — **« Délai dépassé » s'affiche enfin dans le calendrier** (réponse à la
      question de Ryan : ce n'était pas volontaire, Alexandre a demandé la correction).
      `STATUS` a désormais une entrée `closed_late`, et une règle d'affichage `cleStatut`
      choisit l'étiquette : clôturé en retard → « Délai dépassé » en orange, comme sur
      l'accueil, dans le CRM et dans l'onglet Clients. Appliquée aux CINQ endroits qui
      affichaient un statut (mois, semaine, jour, liste d'une journée, détail) ; la légende
      la reprend d'elle-même. `updateStatus` garde aussi `closed_late` en mémoire : sans
      ça, le badge n'apparaissait qu'après rechargement. Vérifié sur le banc `/banc-landing`
      (aucune donnée touchée). Purement visuel : compta et factures ne lisent que `status`.
      Constat d'origine ci-dessous.
  - Relevé par Ryan le 2026-09-15 pendant l'analyse ci-dessus, sans
      rapport avec elle. Un rendez-vous clôturé en retard (`closed_late = true`) s'affiche « Délai
      dépassé » en orange sur l'accueil, dans le CRM, dans la fiche client et dans
      l'onglet Clients — mais « Terminé » en bleu dans le calendrier, dont le `STATUS`
      (lignes 42-47) n'a pas d'entrée `closed_late`. La colonne est pourtant bien chargée
      (`select('*')`), seulement ignorée à l'affichage. **Purement cosmétique** : rien
      n'en dépend côté argent (compta et `clientProfile` filtrent sur `status` seul), ni
      côté facture. À traiter séparément, plutôt avec `designer` puisque c'est un badge.

- [x] 2026-09-16 — **Le rappel du soir ne part plus en silence** (réponse à la question de
      Ryan ; Alexandre a demandé les deux). 1) `notifierLaveur` journalise désormais
      `push.aucun_appareil` quand un laveur n'a aucun appareil abonné : l'absence d'effet
      laisse une trace, et le cron du soir devient mesurable. 2) L'écran « Notifications »
      (Paramètres) dit explicitement, tant qu'elles ne sont pas actives, que le rappel de
      22 h n'existe ni par email ni par SMS, et qu'il ne sera donc jamais reçu. Le centre
      d'aide le disait déjà (Ryan). Constat d'origine :
  - **QUESTION POUR ALEXANDRE — le rappel du soir est muet pour qui n'a pas activé les
      notifications.** Relevé par Ryan le 2026-09-15, même passe. Rien n'a été modifié. Il part uniquement en push (`lib/push.ts`,
      `notifierLaveur`), sans repli par email. Or `notifierLaveur` sort en silence quand
      le laveur n'a aucun appareil abonné (`push.ts` ligne 59) : rien n'est journalisé,
      rien n'est affiché. Un laveur qui n'a jamais activé les notifications — ou sur
      iPhone sans avoir ajouté WashBoard à l'écran d'accueil — ne sera **jamais** relancé
      et ne peut pas le deviner. Même motif que les lectures muettes auditées le
      2026-08-26 : l'absence d'effet ne laisse aucune trace. À trancher : journaliser
      a minima, et/ou signaler dans l'interface que le rappel du soir suppose les
      notifications actives. En attendant, le centre d'aide le dit explicitement.

- [x] 2026-09-15 — **Lectures tronquées à 1 000 lignes.** L'API Supabase plafonne chaque
      réponse à 1 000 lignes, sans erreur. Corrigé le 2026-09-12 pour le CRM (visites et
      réservations) via `lib/supabase/toutesLesLignes.ts` : chez Kookii Clean, 5 659
      événements de visite en base, 1 000 transmis, et des statistiques figées au
      1er septembre sans que rien ne le signale.
  - [x] 2026-09-15 — **Les 8 lectures restantes sur `bookings` passent par
    `toutesLesLignes`**, triées sur `scheduled_at` (ou `review_request_at`) puis `id` :
    calendrier, tableau de bord, compta (page, routes `revenue` et `year-summary`), page de
    réservation publique (la plus sensible : une liste coupée affichait des créneaux
    occupés comme libres), créneaux malins, route debug. Journal d'erreur ajouté là où il
    manquait (calendrier, tableau de bord, page compta). Écartées volontairement :
    `travelFee` (`limit(1)`), `send-followups` (lots de 500), `send-reviews` (lots de 200),
    debug « 10 derniers » — ce sont des plafonds voulus, pas des coupures.
  - [x] 2026-09-15 — **Relances : les rendez-vous écartés sont marqués** (`lib/relances.ts`,
    6 tests). Un rendez-vous qu'on décidait de ne pas relancer (client revenu, ou ancien
    rendez-vous d'un client déjà relancé) ne recevait aucune marque : candidat pour
    toujours, relu chaque jour, il pouvait occuper le lot de 500 et empêcher d'atteindre
    les clients les plus anciens. `followup_sent_at` veut désormais dire « relance
    traitée » (envoyée ou devenue inutile) — la colonne n'est lue nulle part ailleurs.
    Clos seulement si le client est VRAIMENT revenu (rendez-vous plus récent passé,
    confirmé ou terminé) : un rendez-vous seulement à venir peut être annulé, le client
    doit rester relançable. Lecture en échec → pas de relance ce jour-là (avant : envoi).
  - [x] 2026-09-16 — **Facture émise à la main : le client professionnel la reçoit enfin.**
    Trouvé en auditant la veille, dans la foulée des questions de Ryan. `POST
    /api/bookings/[id]/facture` créait la facture sans envoyer aucun email, alors que le
    passage en « Terminé » l'envoie — or ce bouton sert justement au laveur qui complète
    ses informations de facturation APRÈS coup : son client pro n'a jamais rien reçu. La
    règle vit désormais dans `doitEnvoyerFactureAuClient` (`lib/facture.ts`, 4 tests) et
    les DEUX routes l'utilisent, pour qu'elles ne puissent plus diverger.
  - [ ] **Audit du 2026-09-16 — ce qui reste, par ordre d'importance** (rien n'a été
    modifié, à décider par Alexandre) :
    - [x] 2026-09-16 — **La question protège désormais AUSSI le calendrier** (réponse à la
      question de Ryan, décision d'Alexandre : faire le vrai correctif, pas le contournement).
      `ConfirmerCloture` est branché sur le seul bouton « Marquer terminé » de
      `CalendrierDashboard` ; « Confirmer » et « Annuler » sont inchangés. La règle « faut-il
      demander ? » vit dans `lib/cloture.ts` (7 tests) plutôt que dupliquée : un créneau
      PASSÉ resté en attente ou confirmé pose la question, un rendez-vous à venir se
      clôture d'un clic comme avant. `updateStatus` accepte `closedLate`, le type `Booking`
      du calendrier porte enfin `closed_late` et `is_professional`, et la page passe
      `facturationPrete` comme l'accueil. Vérifié en vrai sur le banc `/banc-landing`
      (aucune donnée touchée) : créneau du 15 → question affichée ; créneau du 17 → aucune.
      Le rappel du soir peut donc continuer de pointer vers le calendrier.
    - [x] 2026-09-16 — **Test de bout en bout écrit** (`e2e/dashboard-cloture.spec.ts`,
      2 cas) : la question s'ouvre avec ses deux réponses, « Revenir » et la touche Échap
      la ferment sans rien clôturer. Deux limites assumées, écrites dans le fichier plutôt
      que masquées : il ne CRÉE pas son créneau passé (la route de réservation refuse une
      date passée, et il n'y a pas de base de test séparée) — il se déclare ignoré s'il n'en
      trouve aucun ; et le cas « rendez-vous à venir clôturé d'un clic » n'est pas testé là,
      car le vérifier clôturerait un vrai rendez-vous et émettrait une facture sur le compte
      de test — il est couvert par `lib/cloture.test.ts`.
    - [ ] **`BookingList` n'utilise pas `lib/cloture.ts` : la règle existe toujours en
      deux exemplaires.** Relevé par Ryan le 2026-09-17 en relisant le correctif.
      `lib/cloture.ts` dit en commentaire que la règle « vit donc ici, testée, plutôt que
      dupliquée dans deux écrans » — c'est vrai du calendrier, qui l'importe, mais pas de
      l'accueil : `BookingList.tsx` lignes 146-147 garde ses `isExpiredPending` /
      `isExpiredConfirmed` calculés sur place. Les deux peuvent donc redivergerr, ce qui
      est exactement le mécanisme qui avait laissé le calendrier sans protection.
      Nuance qui explique peut-être le choix : l'accueil ne s'en sert pas seulement pour
      décider s'il faut poser la question, mais aussi pour choisir QUEL bouton afficher
      (Confirmer / Clôturer / Terminé) — ce n'est donc pas un remplacement direct par
      `doitDemanderConfirmation`. Le minimum serait de lui faire au moins partager
      `estCreneauPasse`, qui est exactement le même calcul des deux côtés. Rien n'a été
      modifié : c'est ton fichier et ton correctif, à toi de dire si ça vaut le coup.
    - [x] 2026-09-16 — **`reprendreApercu` lit désormais les aperçus page par page**
      (`toutesLesLignes` + tri sur `id`). Avant : `select('*')` sans `.range`, donc coupé à
      1 000 sans erreur — au-delà, un prospect se serait inscrit sans que sa page soit
      reprise, en silence. Sans effet aujourd'hui (6 aperçus). La fausse base des tests
      sait maintenant lire par paquets.
    - [x] 2026-09-17 — **Lien PDF public : confirmé public, avec « ne pas indexer ».**
      Décision d'Alexandre : on garde le lien ouvert (le client télécharge sans compte ;
      le fermer casserait la remise des factures et tous les emails déjà envoyés), et on
      ajoute `X-Robots-Tag: noindex, nofollow, noarchive` sur la route. Un robot ne devine
      pas l'UUID, mais un lien collé une fois sur un forum suffirait à rendre la facture
      — SIRET, adresses, montant — trouvable par recherche. Aucun accès n'est restreint.
    - [ ] **Activer un abonnement payé par PayPal : aucun automatisme, et aucun outil.**
      Constaté le 2026-09-17. Le paiement est un simple lien `paypal.me/WashBoardSAAS/<montant>`
      (`AbonnementPanel`) : PayPal ne prévient pas WashBoard, il n'existe aucune route
      PayPal, et le seul code qui écrit `subscription_status: 'active'` est le webhook
      Stripe (pas encore en service). L'app le dit au laveur : « activé manuellement sous
      24h ouvrées ». Aujourd'hui Alexandre ne peut le faire QUE par SQL — l'API refuse
      d'écrire ce champ (protection voulue, testée). À trancher : (a) laisser ainsi tant que
      Stripe n'est pas live, (b) un bouton d'activation dans l'espace NovaFlows (à faire
      avec l'interface d'administration déjà prévue pour le centre d'aide), ou (c) un vrai
      webhook PayPal. Risque actuel : un laveur qui paie un vendredi soir reste bloqué tout
      le week-end, et rien ne rappelle à Alexandre qu'un paiement attend.
  - [x] 2026-09-17 — **Notification « 💶 Paiement reçu » branchée côté Stripe** (demandée
    par Alexandre). `checkout.session.completed` prévient l'équipe avec le nom du laveur,
    la formule et le montant ; `invoice.payment_failed` envoie son miroir, « ⚠️ Prélèvement
    refusé », pour rattraper un client avant la fin de la grâce de 30 jours. Attendue avant
    la réponse (Vercel coupe la fonction sinon) et jamais bloquante : `notifierEquipe` ne
    lève pas, un raté de notification ne doit pas faire rejouer le webhook. **Ne partira
    qu'une fois Stripe en service** — un paiement PayPal reste invisible pour WashBoard.
    - **`ConfirmerCloture` n'enferme pas le focus** : la touche Tab sort de la fenêtre.
      Sans conséquence à la souris ou au doigt.
    - ~~Garde-fou « client historique »~~ — **écarté le 2026-09-17 par Alexandre.** Le
      constat, pour mémoire : `grandfathered = true` seul ne suffit pas. Le bandeau ne lit
      que `subscription_status`, donc l'essai continue de s'afficher, et surtout la page de
      réservation publique se coupe 30 jours après `trial_ends_at` — le drapeau n'exempte
      pas du paiement (`book/[slug]`), et les rappels de fin d'essai excluent justement les
      comptes historiques. La parade tient en une requête au moment où on pose le drapeau :
      `update washers set grandfathered = true, subscription_status = 'active' where ...`.
  - Le CRM envoie désormais au navigateur TOUS les événements d'un an. À surveiller quand
    un laveur dépassera quelques dizaines de milliers de visites : passer alors à des
    agrégats calculés côté serveur.

### 📊 Dette mesurée au 2026-08-30 — 195,2 h ≈ 24,4 jours (note A, ratio 1,94 %)

Méthode SonarQube : chaque type de constat porte un coût de remédiation, la dette est
leur somme ; le ratio compare ce coût au coût de développement estimé (30 min/ligne).
La note A vient du volume du projet (20 144 lignes) — elle ne veut pas dire qu'il n'y a
rien à faire, mais que le projet reste globalement sain.

| Constat | Nb | Coût unitaire | Total |
|---|---:|---:|---:|
| Fonction > 300 lignes (composant monolithique) | 10 | 8 h | **80 h** |
| Fichier > 400 lignes à découper | 11 | 4 h | **44 h** |
| Fonction > 60 lignes à scinder | 50 | 45 min | 37,5 h |
| Bloc dupliqué entre fichiers | 42 | 20 min | 14 h |
| Ternaire imbriqué (lisibilité) | 59 | 8 min | 7,9 h |
| Assertion non-null (`!`) | 35 | 10 min | 5,8 h |
| Avertissement ESLint (motif assumé) | 23 | 10 min | 3,8 h |
| Type `any` explicite | 4 | 15 min | 1 h |
| Imbrication > 8 niveaux | 1 | 1 h | 1 h |
| TODO/FIXME dans le code | 2 | 5 min | 0,2 h |

**Où elle se concentre** (63 % de la dette dans 8 fichiers) :

| Fichier | Lignes | Plus grosse fonction |
|---|---:|---:|
| `components/dashboard/CalendrierDashboard.tsx` | 1 544 | 1 434 |
| `components/dashboard/CrmDashboard.tsx` | 815 | 628 |
| `components/dashboard/ParametresForm.tsx` | 849 | 534 |
| `components/dashboard/admin/IdentiteForm.tsx` | 729 | 663 |
| `components/landing/LandingPage.tsx` | 739 | 647 |
| `app/booking/page.tsx` | 486 | 445 |
| `components/dashboard/admin/PrestationsManager.tsx` | 499 | 281 |
| `components/booking/StepSlot.tsx` | 452 | 398 |

- [ ] **Découper les composants monolithiques** (~80 h, le gros poste restant).
      Volontairement **non fait en autonomie** : découper un composant de 1 400 lignes
      touche l'outil de travail quotidien du laveur, et le risque de régression
      dépasse le gain de confort tant qu'Alexandre n'est pas là pour valider le rendu.
      Approche recommandée, la moins risquée en premier :
  1. Extraire la **logique pure** de chaque gros composant vers `lib/` + tests. C'est
     ce qui a été fait pour le calendrier, la compta et le CRM le 2026-08-30 — et ça a
     révélé **2 bugs réels** au passage. Restent `IdentiteForm`, `StepSlot`,
     `BookingList`, `booking/page.tsx`.
  2. Puis seulement extraire des **sous-composants de rendu**, un par un, en
     s'appuyant sur les 123 tests e2e comme filet.
  3. Ne jamais faire les deux dans le même commit : si une régression apparaît, on
     doit pouvoir dire lequel des deux l'a causée.

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
  - [x] 2026-09-06 — **Les 32 lectures des routes API et cron sont tracées.** Le
        « ~100 » annoncé ici était une estimation : le compte réel était de **55**.
        Les 32 des routes `src/app/api/**` (dont 4 dans les cron, les plus
        embêtantes puisque personne ne les regarde tourner) récupèrent désormais
        l'`error` et la journalisent sous `<route>.<donnée>.read_failed`.
        Le comportement n'a PAS été modifié : ces routes refusaient déjà
        correctement quand la donnée manquait, le seul défaut était le silence.
        Deux exceptions traitées à la main : le plafond quotidien de
        `api/bookings` est le seul comptage dont l'échec laisse *passer* — on
        continue quand même (bloquer un laveur parce qu'un comptage anti-abus a
        échoué coûterait plus cher que le spam), mais plus en silence ; et
        `zone/check` garde son repli permissif assumé, désormais tracé avec
        l'identifiant du laveur.
  - [x] 2026-09-17 — **Les 5 lectures de `lib/` sont tracées.** Deux d'entre elles
        cachaient plus qu'un silence :
    - `google-calendar.ts` : l'effacement d'un jeton Google révoqué était suivi d'un
      `logger.warn('gcal.token.cleared')` **inconditionnel**. Or Supabase ne lève pas sur
      un échec d'écriture, il le rend dans `error` : le `try/catch` ne pouvait rien
      attraper et la trace **affirmait le contraire de la réalité**. Le laveur gardait un
      bouton « Connecté » alors que Google refusait l'accès, agenda muet. Corrigé :
      `clear_failed` en erreur, `cleared` seulement en cas de succès.
    - `materializeRecurring.ts` : la lecture « cette dépense récurrente est-elle déjà
      posée ce mois-ci ? » en échec renvoyait `null`, donc le code concluait « non » et
      **créait un doublon** dans la compta. Corrigé : tracé ET on saute le mois — une
      ligne manquante se voit et se corrige, une ligne en double fausse les comptes
      longtemps. L'insertion elle-même est tracée aussi.
    - `travelFee.ts` (×2) : le rendez-vous précédent et la fiche du laveur. Les replis
      restent (adresse de départ, 0 €) — refuser une réservation serait pire — mais ils
      se voient. C'est le repli muet qui avait fait tomber les frais de déplacement à
      zéro pendant la panne de facturation Google du 2026-08-26.
  - [x] 2026-09-17 — **Les lectures des pages du dashboard sont traitées** (16 en réalité,
        pas 18 : l'audit comptait aussi des `auth.getUser()`, qui ont leur propre chemin).
        Deux familles, deux remèdes :
    - **9 lectures de la fiche laveur** (abonnement, admin, calendrier, clients, compta,
      crm, factures, guide, parametres). Ce n'était pas qu'un silence : `if (!washer)
      redirect('/login')` confondait « compte supprimé » et « lecture en échec », donc un
      raté réseau **déconnectait le laveur**. Le remède existait déjà sur la page d'accueil
      mais vivait là-bas seul : il est désormais dans `lib/washerCourant.ts`
      (`washerDuUtilisateur`), utilisé par les neuf pages — erreur réelle tracée puis
      écran « Réessayer », session intacte ; seul le code PGRST116 (aucune ligne) déconnecte.
    - **7 lectures secondaires** (prestations, catégories, horaires, congés) dans Réglages
      et Calendrier : tracées. Un échec y affichait « aucune prestation » ou une journée
      libre — donc un rendez-vous acceptable pendant des congés, sans aucun signal.

- [x] 2026-08-26 — **Clé Maps renommée et centralisée.** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
      devient `GOOGLE_MAPS_API_KEY`, lue à un seul endroit (`lib/googleMaps.ts`) au lieu de
      six. Le helper lit le nouveau nom **avec repli sur l'ancien**, pour que le déploiement
      ne casse rien tant que Vercel n'est pas à jour.
  - [x] 2026-09-11 — **Variable renommée dans Vercel, repli retiré.** Vérifié avant le
        retrait : `/api/health` renvoyait `mapsKey: "presente"` en production. La CI
        construisait encore avec l'ancien nom — corrigé dans le même mouvement.

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

## 🔵 Plus tard — vers mi-novembre 2026

> Repoussé le 2026-09-14 par Alexandre (prévu à l'origine début septembre) : les deux
> dépendent de la création de l'entreprise.

- [ ] **Passer Vercel en Pro (20 $/mois)** le jour de la création de l'entreprise. Demandé
      par Alexandre le 2026-09-17, après le dépassement de stockage.
  - **Pourquoi, et ce n'est pas le stockage** : les comptes Hobby sont réservés à un usage
    **personnel non commercial**. Vercel définit l'usage commercial comme tout site qui
    demande ou traite un paiement, vend un produit ou un service, ou dont quelqu'un tire un
    revenu. WashBoard vend un abonnement à 49 €/mois, affiche ses tarifs, encaisse par
    PayPal et bientôt par Stripe : c'est frontalement commercial. Et « utilisation
    commerciale sur un plan Hobby » figure explicitement dans la liste des causes de mise
    en pause d'un compte.
  - **Ce que coûte une pause, si elle tombe** : le site passe **entièrement hors ligne**
    (erreur 503 `DEPLOYMENT_PAUSED`), pas seulement les nouveaux déploiements — donc la
    page de réservation de CHAQUE laveur. La reprise n'est **jamais automatique** :
    « Paused projects resume one at a time, never automatically », il faut relancer chaque
    projet à la main. Et pour une pause liée à l'usage commercial, **l'upgrade seul ne
    suffit pas** : Vercel envoie un email avec les étapes, et il faut passer par le support.
    Autrement dit, payer après coup ne remet pas le site en ligne d'un clic.
  - **Ce que Pro règle au passage** : le plafond de stockage des déploiements (10 Go en
    Hobby, dépassé le 2026-09-17 — 265 déploiements purgés à 20 ce jour-là), une rétention
    configurable plus longue, et la Skew Protection, aujourd'hui grisée « Pro » dans les
    réglages.
  - À faire en même temps que l'activation de Stripe en production : même déclencheur,
    la création de l'entité.

- [ ] **Remplir les placeholders légaux** dès que l'entité est créée (micro-entreprise ou
      autre) : fichiers `src/app/(legal)/mentions-legales/page.tsx`, `cgv/page.tsx`,
      `confidentialite/page.tsx`. Remplacer `[NOM LÉGAL]`, `[FORME JURIDIQUE]`, `[SIRET]`,
      `[ADRESSE COMPLÈTE]`.

- [ ] **Obligation légale de WashBoard lui-même, le jour de la création** : choisir une
      plateforme agréée pour **recevoir** les factures électroniques (obligatoire pour
      toute entreprise depuis le 1er septembre 2026), puis **émettre** ses factures
      d'abonnement par elle au 1er septembre 2027 (vérifier si Stripe le fait via un
      partenaire). Démarche administrative, pas de code.

- [ ] **Passage de Stripe en live** (voir la mémoire `project-stripe-activation.md` pour la
      procédure complète). Deux points à ne pas oublier ce jour-là :
  - [ ] **Les forfaits annuels n'existent pas côté Stripe.** L'engagement annuel ajouté le
        2026-08-26 (2 mois offerts) ne concerne que le paiement manuel PayPal/virement :
        `STRIPE_PRICE_IDS` associe **un seul prix par plan**, sans notion de cycle, et
        `POST /api/stripe/checkout` ne reçoit pas le cycle choisi. Il faudra créer les prix
        annuels dans Stripe, étendre `STRIPE_PRICE_IDS` en `Record<Plan, Record<BillingCycle,
        string>>`, et transmettre le cycle depuis le `BillingToggle`. Sans ça, un client qui
        choisit l'annuel serait facturé au mois.
  - [x] 2026-09-14 — Variables Vercel nettoyées par Alexandre : `STRIPE_PRICE_ID_BUSINESS`
        (plan Business retiré le 2026-08-26) et ancien nom de la clé Maps supprimés, clés
        VAPID et `SUPPORT_ADMIN_EMAILS` vérifiées, `E2E_CLEANUP_ENABLED` absente.

## 🟡 Roadmap produit

- [x] 2026-09-17 — **Livré par Ryan** (`56836f2`). Tables `support_questions` /
      `support_messages` **créées à la main dans Supabase** ce jour-là, SQL donné dans la
      conversation (pas de fichier de migration). Testé de bout en bout en local contre la
      base réelle : question posée côté laveur, reçue et résolue côté équipe.
  - En plus du cahier des charges : une section **Assistance** sous Guide, pour retrouver
    ses conversations sans repasser par le Guide, avec pastille de non-lu sur l'entrée de
    menu **et sur le bouton ☰** (sur téléphone le menu est replié, sinon la pastille est
    invisible). Lien direct `?fil=<id>`, utilisé par la notification et l'email.
  - **Email au laveur** quand l'équipe répond, en plus du push : le push suppose les
    notifications activées, ce que beaucoup de laveurs n'ont pas fait. L'email ne contient
    jamais le texte de la réponse (il circule en clair et se transfère), seulement le titre
    et un lien.
  - Plafond de **10 fils ouverts par laveur** : chaque création notifie l'équipe, c'était
    un vecteur de spam. Relevé par `cyber`.
  - Relu trois fois par `cyber` (schéma, implémentation, email). Deux pièges signalés par
    lui ont été corrigés : un `\r` isolé survivait dans le titre (inoffensif aujourd'hui,
    dangereux le jour où un titre finirait dans un en-tête d'email), et le test qui
    vérifiait l'absence de la réponse dans l'email ne pouvait pas échouer. Remplacé par
    trois verrous, **vérifiés par sabotage volontaire** : ajouter un paramètre `reponse` à
    `sendSupportReply` casse la vérification de types et deux tests.
  - [ ] Reste à faire : vérifier la **réception réelle** de l'email (Resend, rendu dans une
    vraie boîte) — aucun test ne l'envoie vraiment. Et supprimer le fil de test dont le
    titre commence par `[TEST` sur le compte Kooki Clean.

- [x] ~~**Poser une question depuis le centre d'aide, répondre depuis le compte NovaFlows.**~~
      Demandé par Alexandre le 2026-09-14. **Attribué à Ryan** le 2026-09-15. Aujourd'hui le centre d'aide
      (`/dashboard/guide`) n'a que des réponses toutes faites : un laveur bloqué n'a aucun
      moyen d'écrire à l'équipe depuis l'app.
  - **Côté laveur** : un bouton « Poser une question » dans le centre d'aide (et quand la
    recherche ne trouve rien), un champ de texte, puis l'historique de ses échanges avec
    les réponses. Discret sur téléphone, comme le reste de l'espace connecté.
  - **Côté équipe** : une interface d'administration accessible depuis le compte
    NovaFlows, réservée à `SUPPORT_ADMIN_EMAILS` comme la page `/dashboard/support`
    existante (qu'elle peut prolonger). Liste des questions avec le laveur concerné,
    non lues en premier, réponse directe, statut ouvert / résolu.
  - **Notification sur le téléphone d'Alexandre** à chaque nouvelle question :
    `notifierEquipe` (`lib/push.ts`) le fait déjà pour les inscriptions, à réutiliser. Le
    laveur est notifié à son tour quand l'équipe répond (même mécanique, ses appareils).
  - Nouvelle table Supabase : SQL donné dans la conversation, avec les `GRANT` explicites
    par rôle et des RLS qui limitent chaque laveur à ses propres questions.
  - Montrer le rendu (laveur et administration) avant de pousser.

- [x] 2026-09-15 — **Guide (centre d'aide) mis à jour, fait par Ryan** (`lib/guide.ts`,
      commit 661ce5f). Nouvelle section « Factures » (infos à remplir, création au
      « Terminé », envoi au client pro, numérotation, import des anciennes factures) et
      trois entrées : « J'ai oublié de marquer un rendez-vous », « À quoi sert la
      notification de 22 h ? », « Quelle différence entre l'onglet Clients et le CRM ? ».
      Réponses recoupées avec le code, exactes. Ce qui était demandé :
  - **Factures** : infos de facturation dans les Paramètres, facture émise au passage en
    « Terminé », envoyée aux clients pros, onglet Factures, import des anciennes factures,
    numéro de départ.
  - **Onglet Clients** : recherche, dernière prestation. La réponse « Où retrouver
    l'historique d'un client ? » renvoie encore au CRM.
  - **« Clôturer » un créneau passé** : la question « Avez-vous fait ce rendez-vous ? ».
  - **Rappel du soir** à 22 h (rendez-vous du jour pas encore « Terminé »).
  - Revoir « Que se passe-t-il quand je marque un RDV terminé ? » : parler de la facture.

- [x] 2026-09-15 — **Réseaux sociaux sur la LANDING, fait par Ryan** (commits 58126bf et
      9604de0) : rangée d'icônes Instagram (`washboard.fr`) et TikTok (`wash_board.fr`)
      dans le pied de page, cibles de 44 px, ouverture dans un nouvel onglet, étiquettes
      pour les lecteurs d'écran ; comptes aussi déclarés en `sameAs` dans le JSON-LD, pour
      que Google et les IA les rattachent à WashBoard. Les deux identifiants diffèrent
      volontairement, ne pas les uniformiser.
- [x] 2026-09-16 — **Le prix dans la notification de réservation.** Demandé par Alexandre,
      fait le jour même. La notification donne désormais `✨ Prestation · 45€`, le montant
      **sur la même ligne que la prestation** : au repos, un iPhone ne montre que les deux
      premières lignes du corps, une quatrième ligne aurait été invisible. Montant réellement
      encaissé, via `finalDisplayPrice(booked_price, is_smart_slot, smart_discount)` déjà
      testé dans `lib/pricing` — donc options, véhicules multiples et frais de déplacement
      compris, remise d'un créneau groupé déduite, et aucune règle de prix dupliquée.
      **Vérifié en vrai** le 2026-09-16 : réservation d'essai passée par la route publique
      sur AutoNettoyage, notification reçue par Alexandre avec « ✨ Lavage complet · 75€ »
      — soit 65 € de prestation + 10 € de frais de déplacement calculés par le serveur, ce
      qui prouve que c'est bien le montant encaissé et non le tarif affiché. Réservation
      d'essai supprimée ensuite.
      Constat d'origine :
  - Afficher le prix réellement facturé, pas le tarif de la prestation : `booked_price`
    inclut les options, le nombre de véhicules et les frais de déplacement, et le créneau
    malin porte une remise (voir `effectivePrice` côté CRM). Un montant faux serait pire
    que pas de montant.
  - Garder une ligne par information et un seul emoji, comme les autres (💶). Le corps de
    la notification est déjà coupé au bout de deux lignes sur iPhone au repos : vérifier
    ce qui reste visible sans l'ouvrir.
  - Même question pour la notification de l'équipe à l'inscription ? À trancher.

- [ ] **Réseaux sociaux dans l'ESPACE DES LAVEURS** (reste à faire ; la landing est faite
      ci-dessus). Aucun lien
      vers les comptes WashBoard (TikTok, Instagram…) n'existe aujourd'hui sur le site.
  - **Landing** : icônes des réseaux dans le pied de page (et éventuellement une ligne
    « Suis-nous » près du CTA final). Liens directs, ouverts dans un nouvel onglet, avec
    un libellé accessible (« WashBoard sur TikTok »).
  - **Espace connecté** : visible sans gêner, **surtout sur téléphone où rien ne doit
    prendre de place**. Pas de bandeau, pas de fenêtre, pas de bloc en haut du tableau de
    bord. Pistes : une rangée de petites icônes tout en bas du menu latéral sur
    ordinateur ; sur téléphone, uniquement dans le menu (ou en bas de Paramètres / du
    centre d'aide), jamais sur l'écran principal. Montrer le rendu à Alexandre avant de
    pousser.
  - À fournir par Alexandre : la liste des comptes et leurs liens.

- [ ] **Facturation des laveurs à leurs clients** (réforme de la facturation
      électronique). Le sujet, ce sont les factures **des laveurs**, pas celles de
      WashBoard (précisé par Alexandre le 2026-09-14).
  - **Calendrier vérifié sur impots.gouv.fr** le 2026-09-14 : réception obligatoire pour
    toutes les entreprises depuis le 1er septembre 2026 ; émission obligatoire pour les
    petites et micro-entreprises au **1er septembre 2027**. Les micro-entrepreneurs en
    franchise de TVA sont concernés. Client pro établi en France : facture structurée
    (UBL, CII ou Factur-X) via une plateforme agréée. Client particulier : pas de
    facture électronique, mais transmission des ventes aux impôts (e-reporting, tous les
    deux mois pour un franchisé d'après la FAQ).
  - **Problème dès aujourd'hui** : la réservation promet aux clients pros « une facture
    avec vos informations société », mais `components/pdf/BookingPDF.tsx` n'est qu'un
    justificatif — ni SIRET ni adresse du laveur, pas de numérotation continue, et
    « TVA non applicable — art. 293 B » écrit pour tous les laveurs, même ceux qui
    facturent la TVA.
  - [x] 2026-09-14 — **Étape 1 : une vraie facture valable** (branche locale
    `feat/facture-laveur`, commits `71f3103`, `93ff431`, en attente de la validation
    d'Alexandre pour la mise en ligne ; les deux SQL sont passés). SIRET et adresse du
    laveur, « EI » ajouté ou forme juridique / capital / RCS pour une société, régime et
    taux de TVA, numéro continu par laveur attribué en base (`emettre_facture`), contenu
    figé, logo, mise en page sobre, onglet Factures, envoi par email aux clients pros.
    Testée en local (F-00001 sur le compte test).
  - [ ] Faire relire la liste des mentions de la facture par `legal`.
  - **Calendrier retenu par Alexandre le 2026-09-15** (au lieu d'une décision « début
    2027 », jugée trop tardive : les laveurs chercheront une solution dès début 2027) :
    - [ ] **D'ici fin 2026 : choisir la plateforme agréée partenaire.** Comparer 3 ou 4
          offres : prix (par facture ou par mois), raccordement technique (API),
          services pour les petites entreprises et micro-entrepreneurs, prise en charge
          de l'e-reporting des ventes aux particuliers. Ne coûte rien, fait gagner des mois.
    - [ ] **En parallèle, dès maintenant : le format Factur-X.** Un PDF qui embarque les
          données de la facture (XML CII), lisibles par les logiciels comptables : l'un
          des formats officiels de la réforme. Les clients pros des laveurs peuvent déjà
          importer leurs factures, et la landing peut annoncer « prêt pour la facture
          électronique ». Demande une bibliothèque spécialisée (PDF/A-3 + XML) :
          quelques jours de travail, à partir du contenu figé `facture_contenu`.
    - [ ] **Début 2027 : se raccorder à la plateforme choisie**, pour que WashBoard émette
          les factures électroniques de ses laveurs et fasse l'e-reporting, bien avant le
          1er septembre 2027. Argument fort pour la formule Pro : Alexandre indique que ses
          laveurs ont souvent des clients pros.
  - [x] 2026-09-15 — **Onglet Factures : tri et import** (en ligne, `5e80663` puis
    `8538350`). Filtres « Tout » / année / mois avec total. Import des factures **de
    vente** faites avant WashBoard, une par une ou en ZIP (PDF, JPG, PNG) : le ZIP est
    ouvert dans le navigateur (limite Vercel de 4,5 Mo par requête), chaque fichier va
    dans le stockage privé `factures-importees` par un lien d'envoi à usage unique ;
    date, montant et numéro d'origine lus automatiquement (français et anglais),
    vérifiés par le laveur avant enregistrement. Carte Facturation : « Numéro de la
    prochaine facture » (ne peut qu'augmenter). SQL passé le 2026-09-15 (table
    `factures_importees`, RLS, droits resserrés, bucket privé) ; il a fallu
    `notify pgrst, 'reload schema'` pour que l'API voie la nouvelle table.
  - [ ] **Factures d'ACHAT : côté « Achats » de l'onglet Factures** (décision
    d'Alexandre le 2026-09-15 : un côté Ventes et un côté Achats dans le même onglet).
    Le sélecteur « Ventes | Achats » existe déjà, le côté Achats affiche « en
    développement ». À construire : même import (une par une ou en ZIP, date, montant,
    fournisseur lus automatiquement), totaux séparés des ventes — mélangés, le total du
    mois additionnerait ce qui est encaissé et ce qui est payé. À relier ensuite aux
    Dépenses de la Comptabilité pour ne rien saisir deux fois. Lié à la réforme : depuis
    le 1er septembre 2026, toute entreprise doit pouvoir **recevoir** ses factures
    d'achat en électronique — à rattacher au choix de la plateforme agréée.
  - [ ] **À voir avec Kookii Clean : envoyer aussi la facture par email aux
    particuliers ?** Aujourd'hui, au passage en « Terminé », seuls les clients pros la
    reçoivent automatiquement ; le particulier la télécharge par le lien de son email de
    confirmation. Pour une prestation de plus de 25 €, le laveur doit la remettre au
    client : l'email le ferait pour lui. Option envisagée : un réglage « toujours /
    seulement les pros ». Alexandre demande à Kookii Clean si c'est utile.
  - [ ] **Question ouverte (Alexandre, 2026-09-15) : demander un acompte à la
    réservation ?** But : limiter les rendez-vous où le client n'est pas là et le laveur
    s'est déplacé pour rien. Rien à construire avant décision. Points à trancher :
    - **Hors V1 aujourd'hui** : le CLAUDE.md exclut le paiement en ligne. Deux voies :
      (a) paiement dans WashBoard via Stripe Connect (l'argent va au laveur, frais Stripe
      par paiement, vérification d'identité de chaque laveur) ; (b) plus simple : le
      laveur affiche son propre moyen de paiement (lien PayPal/Lydia, virement) et
      WashBoard ne fait que le demander et noter « acompte reçu ».
    - **Juridique** : sans mention contraire, une somme versée d'avance par un
      particulier vaut **arrhes** (Code de la consommation, art. L214-1) — le client peut
      renoncer en les perdant, le laveur en rendant le double. Choisir et écrire le mot
      dans la confirmation. Recevoir un acompte oblige en principe à émettre une
      **facture d'acompte**, puis une facture finale qui le déduit : impact sur la
      facturation déjà en place. À faire relire par l'agent legal.
    - Demander à Kookii Clean si les absences de clients arrivent vraiment, et combien.
  - [x] 2026-09-15 — **Rappel du soir « marquez vos rendez-vous Terminé »**
    (`api/cron/rappel-terminer`, `lib/rappelTerminer.ts`, 7 tests). Notification aux
    laveurs qui avaient des rendez-vous dans la journée (confirmés OU restés en attente :
    Kookii Clean va parfois chez le client sans confirmer) et ne les ont pas tous
    terminés. Sans « Terminé », pas de facture ni de compta à jour. Le calendrier permet
    désormais de terminer directement un rendez-vous en attente.
  - [x] 2026-09-15 — **Tâche cron-job.org créée, fait par Alexandre** (« WashBoard – rappel
    du soir »). Reste à vérifier la première exécution le 2026-09-16 (réponse 200 dans
    l'historique HIST ; rappel posé dans l'agenda à 9 h). Réglages : tous les jours à **22 h, fuseau
    Europe/Paris** (pas UTC : le rappel glisserait d'une heure au changement d'heure),
    URL `https://www.washboard.fr/api/cron/rappel-terminer`, en-tête
    `Authorization: Bearer <CRON_SECRET>` — même réglage que les autres tâches.
  - [x] 2026-09-15 — **« Clôturer » un créneau passé demande d'abord « Avez-vous fait ce
    rendez-vous ? »** (`ConfirmerCloture.tsx`, accueil du dashboard). Avant, « Clôturer »
    valait « Terminé » d'office, donc une facture pour un lavage peut-être jamais fait.
    Oui → Terminé + facture (envoyée au client si pro ; si la facturation est incomplète,
    la fenêtre le dit). Non → annulé, sans facture, sans compta, sans message au client.
    **Testé en production par Alexandre le 2026-09-15** sur AutoNettoyage avec 2 rendez-vous d'essai :
    Oui → Terminé + F-00004 ; Non → annulé sans facture. Rendez-vous supprimés ensuite
    et compteur remis à 4 (suite de numéros sans trou).

- [ ] **Landing : étoffer le contenu qui convainc, pas la longueur.** Constat du
      2026-09-13 : ~7 écrans sur ordinateur (6 187 px), 9 sur mobile, **731 mots**,
      9 blocs. Le problème n'était pas la taille mais ce qui manquait pour qu'un pro paie
      49 €/mois. **Livré le 2026-09-13 (`f935111`)** : le « +40 » présenté comme un
      exemple de calcul, vraies captures (calendrier, CRM, réservation, données de
      démonstration), grille des 12 fonctionnalités, « Pour qui ? », « Comment ça
      marche » en 3 étapes, FAQ à 10 questions. Reste :
  - [ ] **Témoignage de Kookii Clean** : aucune preuve sociale sur la page (ni avis, ni
        client cité), alors qu'un vrai client paie. **Bloqué côté Alexandre** : il faut
        sa phrase et son accord pour publier son nom.

- [x] 2026-09-15 — **Reprise automatique de l'aperçu à l'inscription** (`lib/repriseApercu.ts`,
      branchée dans `api/auth/signup`, commit 6a555a3, 15 tests). **Répétition en production
      faite par Alexandre** le 2026-09-15 avec l'aperçu d'essai « Essai Reprise » (numéro
      fictif, fiche écrite avec des espaces) : catégorie, prestations, horaires et lien repris,
      aperçu supprimé, notification « 🔁 Nouveau client — aperçu repris » reçue ; compte
      d'essai supprimé ensuite. Numéros comparés normalisés ; deux aperçus au même numéro ou
      aperçu avec réservations → rien repris, l'équipe tranche ; chaque reprise est annoncée
      dans la notification d'inscription. `page-proposition.mjs` normalise le téléphone.
      Le script manuel `prospects/reprendre-apercu.mjs` reste en secours. Historique de la
      décision : la reprise manuelle avait été éprouvée le 2026-09-11 en répétition du rendez-vous
      URHUS : inscription avec le numéro de l'aperçu, puis reprise en dix secondes. À brancher
      dans `api/auth/signup` : si le numéro saisi correspond à un aperçu, son contenu et son
      lien passent dans le nouveau compte, sans intervention.
  - Le numéro n'est **pas vérifié** (aucun code SMS) et ceux des prospects sont publics :
    se déclencher sur lui seul permettrait à n'importe qui de récupérer la page, le logo
    et le lien d'un prospect. Parade retenue : reprise automatique + notification immédiate
    à l'équipe (« X a repris l'aperçu Y »), pour qu'un détournement saute aux yeux.
  - Ne **jamais** faire échouer l'inscription : reprise après création du compte, en
    best-effort, erreur journalisée et signalée.
  - Normaliser le téléphone à la création de l'aperçu : `page-proposition.mjs` le stocke
    aujourd'hui tel qu'écrit dans la fiche.
  - Tests : numéro d'un aperçu → reprise ; numéro inconnu → compte vide ; reprise en
    échec → inscription réussie quand même.
  - Reporté volontairement : pas de modification de l'inscription juste avant un rendez-vous.

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
- [x] 2026-09-15 — **Onglet « Clients » : le fichier clients du laveur** (commit 533b299,
      `app/(dashboard)/dashboard/clients`, `lib/listeClients.ts`, 11 tests). Demande
      d'Alexandre. Entrée « Clients » dans le menu après CRM, pour toutes les formules. Un
      client par email (même regroupement que la fiche client), du plus récemment actif au
      plus ancien : nom ou entreprise + badge PRO, téléphone, email, **dernière prestation**
      (terminée, ou confirmée et passée — un rendez-vous à venir n'en est pas une) avec sa
      date en premier, prochain rendez-vous, nombre de lavages. Un appui ouvre la fiche
      client existante. **Recherche** par nom, entreprise, email, adresse ou téléphone,
      sans accents ni majuscules ; un numéro se retrouve quelle que soit son écriture
      (« 06 12 », « +33 6 12 »). Réservations lues avec `toutesLesLignes`, seules les
      colonnes utiles envoyées au navigateur (ni notes internes, ni factures).
  - [ ] Plus tard, si un laveur dépasse quelques milliers de clients : paginer la liste
        à l'écran (aujourd'hui tout s'affiche d'un coup, 3 à 60 clients par compte).

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
- [ ] **Surveillance des abus pour `cyber`** (décidé le 2026-09-14 : pas urgent avec
      quelques laveurs, les protections bloquent déjà). Les journaux Vercel s'effacent vite
      (quelques heures à un jour selon l'offre) : une lecture à la réunion du matin
      manquerait la nuit. Plan retenu :
  - table Supabase des refus (type, route, laveur visé, IP brouillée avec un sel, date),
    purgée à 30 jours ; SQL dans la conversation, `GRANT` explicites ;
  - route de consultation en lecture seule, protégée par un secret dédié, qui ne rend
    que des totaux (aucune IP, aucun email) ;
  - notification sur le téléphone d'Alexandre en cas de pic (`notifierEquipe`) ;
  - à trancher : la routine cloud reçoit-elle ce secret (règle actuelle : aucun accès
    autonome aux routines cloud) ; faire valider la conservation des IP par `legal` et
    l'ajouter à la politique de confidentialité.

- [ ] **Workflow branches + Preview (optionnel)** : pour les features risquées, créer
      une branche → Vercel génère une URL de preview → valider → merger sur master.
      Évite de pousser direct en prod sur du code chaud. (Pas obligatoire en solo.)
- [x] 2026-06-30 — **Le déploiement est bloqué par les tests** : Build Command Vercel
      = `npm run test && npm run lint && npm run build` (un échec bloque la mise en ligne).
- [ ] **Environnement de recette/staging dédié** : seulement quand il y aura une
      équipe / un testeur, ou des migrations risquées. Inutile avant.

## 🟢 Polish / UX

- [x] ~~**Bouton désactivé indistinguable d'un bouton actif en thème sombre.**~~
      **Classé sans suite le 2026-09-06.** Relevé par `designer` en réunion d'équipe : le
      bouton principal du parcours de réservation utilise `disabled:opacity-40` sur la
      couleur d'accent du laveur. En thème clair, ça donne un bleu délavé qui se lit bien
      comme « éteint » ; en thème sombre, 40 % de bleu sur un fond bleu nuit reste un bloc
      plein qui ressemble à un bouton actif — le client tape dessus et rien ne se passe,
      sur toutes les étapes du parcours. Captures clair/sombre prises à l'appui sur le
      compte de test. **Alexandre a tranché : on ne change pas.** Ne plus faire remonter ce
      point dans les rapports d'équipe.
      Écartés dans le même lot, pour la même raison : l'anneau de focus clavier invisible
      sur les écrans de connexion (`.wb-input { outline: none }` de `globals.css` écrase la
      règle globale `*:focus-visible`, même spécificité, la dernière gagne), et le fond
      photo de la page de réservation qui ne couvre pas toute la hauteur (le bloc « Avis
      clients » se retrouve blanc sur blanc en thème clair).

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

- [ ] **`GRANT DELETE ON public.booking_funnel_events TO service_role;` manquant.**
      Constaté le 2026-09-14 en supprimant trois comptes de test : « permission denied for
      table booking_funnel_events ». Conséquence : la purge RGPD quotidienne
      (`api/cron/purge-accounts`, statistiques de visite de plus de 13 mois) échoue à chaque
      passage — elle le journalise (`purge.funnel_events.delete_failed`) mais ne supprime
      rien. Aucune donnée n'a encore 13 mois (table créée le 2026-08-27) : sans urgence
      avant l'été 2027, mais à passer au prochain accès SQL. 5e occurrence du motif « droit
      service_role oublié ».

- [x] 2026-09-14 — **Comptes de test supprimés à la demande d'Alexandre** : `EssaiAuto`
      (`essai-demo`), `fg` (`fg-d57b`) et `Spotifypren` (`spotifypren-3ca3`), tous en essai,
      0 réservation, vérifiés un par un avant suppression. Même procédure que la purge RGPD
      (dépenses → logo et fond dans le storage → utilisateur auth, cascade sur la fiche, les
      prestations, les réservations et les horaires). Vérifié après : aucune ligne restante,
      aucun fichier, 0 compte fantôme (9 comptes de connexion), Kookii Clean intact
      (78 réservations). Les adresses email sont libres pour de nouvelles inscriptions.

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
