# WASHBOARD — TODO

> **Bloc-notes du projet (long terme).**
> Convention :
> - `[ ]` = à faire · `[x]` = fait (ajouter la date `AAAA-MM-JJ`)
> - Quand une tâche est terminée → la cocher + dater (la laisser dans la liste ou
>   la déplacer en bas dans « ✅ Fait »).
> - Toute nouvelle tâche découverte → l'ajouter dans la bonne section.
>
> Dernière mise à jour : 2026-10-04 (sécurité `bookings` : bascule client admin faite par Ryan
> et fusionnée sur master, REVOKE RLS toujours en attente ; nouvelle faille trouvée sur
> `fusionner_clients`/`anonymiser_client`). Avant : 2026-09-21 (audit post-lancement : vitesse,
> contraste, image de partage, CGU et acceptation des CGV). Avant : 2026-09-14 (réseaux sociaux,
> facturation électronique ; légal et Stripe live repoussés vers mi-novembre ; landing
> livrée ; et plus tôt : compte d'essai EssaiAuto à supprimer, blog SEO, centre d'aide,
> fiche client, forfaits annuels)

---

## 🔔 À FAIRE PAR ALEXANDRE — à lui rappeler à chaque conversation (2026-09-25)

> Actions que seul Alexandre peut faire (accès Vercel / Supabase). Tant qu'une case est
> ouverte, le lui redire en fin de réponse. Cocher + dater quand c'est fait.

- [~] **Vercel → projet `wash-board` → Settings → Environment Variables → `SUPPORT_ADMIN_EMAILS` :
      cocher « Preview » en plus de « Production »** — *fait par Alexandre le 2026-09-26 (vérifié :
      la variable est bien en Production + Preview), mais l'accès équipe n'apparaît toujours pas sur
      l'essai : lire la ligne de diagnostic au bas de « Plus » (compte · équipe · liste du
      déploiement) pour savoir si c'est l'adresse du compte ou la variable.* (même valeur), sauvegarder, puis
      redéployer la branche `refonte-pwa`. Sans ça, la PWA de test ne le reconnaît pas comme
      équipe : ni le formulaire « Prendre la main sur un compte » (Assistance), ni le bouton
      dans les conversations, ni la ligne « Support (équipe) » de Plus n'apparaissent.
- [x] 2026-09-26 (dit par Alexandre) — **Supabase (SQL Editor) — colonne de suppression des conversations d'Assistance côté
      laveur** (sans elle, le glisser-supprimer répond « Impossible de supprimer », la liste
      continue de marcher) :
      ```sql
      ALTER TABLE support_questions ADD COLUMN IF NOT EXISTS hidden_for_washer_at timestamptz;
      GRANT SELECT, UPDATE (hidden_for_washer_at) ON support_questions TO authenticated;
      ```
- [x] 2026-09-27 — **Supabase (SQL Editor) — table `documents` (devis et factures écrits à la
      main)**, sans laquelle l'écran Chiffres › « Devis et factures à la main » ne peut rien
      enregistrer. Le SQL complet (table, compteur `devis_prochain_numero`, RLS, GRANT, fonction
      `emettre_document`) a été donné dans la conversation du 2026-09-27, et vérifié en
      production le même jour (D-00001 → F-00015). Format des numéros : `F-00014` — préfixe +
      compteur sur cinq chiffres, **sans l'année** ; `emettre_document` doit produire exactement
      cette forme (`D-` pour les devis), sinon la suite des factures se casse en deux.
- [ ] **Supabase (SQL Editor) — colonne de paiement des factures à la main**, sans laquelle le
      bouton « Marquer payée » répond une erreur et l'« Encaissé » reste incomplet :
      ```sql
      alter table public.documents add column if not exists paye_le timestamptz;
      ```
      Rien d'autre à faire : les GRANT de `documents` portent sur la table entière
      (`grant select, update, delete on public.documents to authenticated`), pas colonne par
      colonne, et la policy d'`update` vaut déjà pour ce champ.
- [ ] **Supabase (SQL Editor) — table `clients` (réglages écrits à la main)**, sans laquelle
      « Ne plus contacter » dans la Fiche client répond une erreur et l'onglet « À relancer »
      de Clients ne reflète jamais un opt-out. Premier morceau d'un vrai CRM, proposé par Yanis
      (canevas partagé le 2026-09-28) et discuté avec Alexandre le même jour :
      ```sql
      create table public.clients (
        id uuid primary key default gen_random_uuid(),
        washer_id uuid not null references public.washers(id) on delete cascade,
        cle text not null,
        ne_plus_contacter boolean not null default false,
        notes text,
        cree_le timestamptz not null default now(),
        maj_le timestamptz not null default now(),
        unique (washer_id, cle)
      );

      alter table public.clients enable row level security;

      create policy "clients_select" on public.clients
        for select using (washer_id in (select id from public.washers where user_id = auth.uid()));
      create policy "clients_insert" on public.clients
        for insert with check (washer_id in (select id from public.washers where user_id = auth.uid()));
      create policy "clients_update" on public.clients
        for update using (washer_id in (select id from public.washers where user_id = auth.uid()));

      grant select, insert, update on public.clients to authenticated;
      grant all on public.clients to service_role;
      ```
      `notes` est ajoutée tout de suite bien que rien ne l'écrive encore : le prochain morceau du
      CRM (fiche entreprise, tâches) en aura besoin, mieux vaut une seule migration que deux.
      `service_role` reçoit tout : les deux crons (`send-followups`, `send-reviews`) lisent
      cette table avec le client admin pour exclure les clients opposés.
- [ ] **Supabase (SQL Editor) — tables `entreprises` et `sites` (fiche entreprise)**, À EXÉCUTER
      APRÈS le bloc `clients` ci-dessus (la dernière ligne y ajoute deux colonnes). Sans ce SQL,
      la Fiche entreprise ne peut rien créer ni rattacher. Construite le 2026-09-28 :
      ```sql
      create table public.entreprises (
        id uuid primary key default gen_random_uuid(),
        washer_id uuid not null references public.washers(id) on delete cascade,
        nom text not null,
        delai_paiement_jours integer,
        cree_le timestamptz not null default now(),
        maj_le timestamptz not null default now()
      );

      alter table public.entreprises enable row level security;

      create policy "entreprises_select" on public.entreprises
        for select using (washer_id in (select id from public.washers where user_id = auth.uid()));
      create policy "entreprises_insert" on public.entreprises
        for insert with check (washer_id in (select id from public.washers where user_id = auth.uid()));
      create policy "entreprises_update" on public.entreprises
        for update using (washer_id in (select id from public.washers where user_id = auth.uid()));
      create policy "entreprises_delete" on public.entreprises
        for delete using (washer_id in (select id from public.washers where user_id = auth.uid()));

      grant select, insert, update, delete on public.entreprises to authenticated;
      grant all on public.entreprises to service_role;

      create table public.sites (
        id uuid primary key default gen_random_uuid(),
        entreprise_id uuid not null references public.entreprises(id) on delete cascade,
        adresse text not null,
        note text,
        cree_le timestamptz not null default now()
      );

      alter table public.sites enable row level security;

      create policy "sites_select" on public.sites
        for select using (entreprise_id in (
          select id from public.entreprises where washer_id in (select id from public.washers where user_id = auth.uid())
        ));
      create policy "sites_insert" on public.sites
        for insert with check (entreprise_id in (
          select id from public.entreprises where washer_id in (select id from public.washers where user_id = auth.uid())
        ));
      create policy "sites_update" on public.sites
        for update using (entreprise_id in (
          select id from public.entreprises where washer_id in (select id from public.washers where user_id = auth.uid())
        ));
      create policy "sites_delete" on public.sites
        for delete using (entreprise_id in (
          select id from public.entreprises where washer_id in (select id from public.washers where user_id = auth.uid())
        ));

      grant select, insert, update, delete on public.sites to authenticated;
      grant all on public.sites to service_role;

      alter table public.clients add column if not exists entreprise_id uuid references public.entreprises(id) on delete set null;
      alter table public.clients add column if not exists role_entreprise text;
      alter table public.clients add column if not exists masque_le timestamptz;
      ```
      Un « contact » d'entreprise EST un client (table `clients`) : `entreprise_id` le rattache,
      `role_entreprise` porte son rôle libre (« Chef d'atelier ») — pas de table `contacts`
      séparée. Conséquence assumée dans `lib/entrepriseProfile.ts` : on ne peut rattacher qu'un
      client déjà connu (au moins une réservation ou un document), jamais quelqu'un qui n'a
      jamais rien pris — ce serait résoudre les « prospects » en douce, pas encore fait.
      `masque_le` (2026-09-28) sert « supprimer un client » (glisser la ligne dans Clients) :
      un MASQUAGE, jamais une vraie suppression — voir `ClientReglages.masque` dans
      `lib/clientProfile.ts` pour pourquoi (numérotation des factures, obligation légale de
      conservation).
- [ ] **Supabase (SQL Editor) — colonne `clients.vehicules`** (2026-09-28, « les modèles de
      voitures des gens »), sans laquelle le champ Véhicules de la fiche répond une erreur :
      ```sql
      alter table public.clients add column if not exists vehicules text;
      ```
- [ ] **Supabase (SQL Editor) — menu « Options » refait : colonnes `clients.nom`/`.telephone`,
      tables `client_taches` et `client_rgpd_journal`, fonctions `fusionner_clients` et
      `anonymiser_client`** (2026-09-28) — sans ce SQL, « Modifier la fiche » (nom/téléphone),
      « Ajouter une tâche », « Fusionner un doublon » et « Anonymiser la fiche » répondent tous
      une erreur (« Exporter ses données » fonctionne sans, il ne journalise juste rien). SQL
      complet donné plus bas, section « Roadmap produit » › **Menu « Options » de la fiche
      refait**, À EXÉCUTER APRÈS le bloc `entreprises`/`sites` ci-dessus (même table `clients`).
- [ ] (optionnel, pour tester Google Agenda sur la version d'essai) ajouter l'adresse de
      retour de l'essai dans la console Google Cloud et régler `GOOGLE_REDIRECT_URI` /
      `NEXT_PUBLIC_APP_URL` sur Preview — voir le bloc « Google Agenda » de la refonte.

---

## 🎯 Priorités d'Alexandre — 3 sujets importants (2026-10-02)

> Désignés par Alexandre comme importants, pas encore détaillés — à préciser avec lui
> avant de lancer quoi que ce soit dessus.

- [ ] **SMS.** Sujet à préciser.
- [ ] **Refonte du site web.** Sujet à préciser — distinct de la refonte PWA déjà en
      cours (voir la section dédiée plus bas, « 🎨 Refonte 2026 ») : à confirmer si ça
      recouvre la même chose, la landing uniquement, ou autre chose encore.
- [ ] **Refonte de la page de réservation des laveurs** (`/book/[slug]`). Sujet à
      préciser.

---

## 🔴 Priorité haute

- [x] 2026-10-04 — **🔒 SÉCURITÉ, CORRIGÉ — la policy RLS de `bookings` laissait un laveur
      lire/écrire TOUTES les colonnes de ses propres réservations en interrogeant Supabase
      directement, sans passer par le site.** Trouvé le 2026-10-02 par un audit `cyber` pendant
      le chantier de masquage des réservations verrouillées. Ce n'était pas du piratage au sens
      classique : un laveur CONNECTÉ possédait déjà tout ce qu'il fallait (l'adresse du projet
      Supabase et la clé publique "anon" sont visibles dans le code source du site pour n'importe
      qui ; son propre jeton de connexion prouve son identité à Supabase). Avec les outils
      développeur du navigateur (F12), il pouvait appeler Supabase directement et récupérer
      nom/téléphone/adresse/prix en clair sur une réservation que le site, lui, masque
      correctement — ou pire, écrire `saisie_par_laveur: true` pour se déverrouiller pour de bon.
      **Corrigé en 2 temps, vérifié en conditions réelles :**
      1. Audit complet (28 fichiers) : toute lecture/écriture serveur de `bookings` qui passait
         par la session (`authenticated`) bascule vers le client admin, avec filtre `washer_id`
         explicite partout (l'admin ignore la RLS, ce filtre devient la seule barrière entre
         laveurs). Nouveau garde-fou automatique `lib/supabase/accesBookings.test.ts` qui scanne
         le code et fait échouer les tests si `bookings` est un jour relu par la session.
      2. SQL exécuté en prod le 2026-10-04 :
         ```sql
         revoke all on public.bookings from anon, authenticated;
         grant all on public.bookings to service_role;
         ```
      Revérifié après coup : une requête directe à l'API Supabase avec la clé publique renvoie
      bien `42501 permission denied for table bookings` ; le dashboard (accueil, Clients,
      Calendrier) continue de fonctionner normalement avec une vraie session.
- [x] 2026-10-04 — **🔒 CORRIGÉ, VÉRIFIÉ — `POST /bookings/[id]/facture` facturait une
      réservation verrouillée après coup.** `PATCH /bookings/[id]` (qui émet la facture
      automatiquement au passage en « Terminé ») bloquait déjà une réservation verrouillée ;
      cette route séparée (facturation manuelle, pour un rendez-vous déjà « Terminé » sans
      facture) avait été oubliée — pas une nouvelle règle, un simple alignement sur le
      garde-fou déjà décidé ailleurs. Risque réel : émettre la facture donne au PDF un accès
      permanent (exception légale « facture déjà émise »), donc contournait le masquage sans
      même avoir besoin du jeton. Même garde-fou ajouté (`estVerrouillee`/`seuilsVerrouillage`,
      403 si verrouillée), 3 tests ajoutés (`route.test.ts`), `tsc`/`eslint`/`vitest run`
      (2426 tests) et `next build` revérifiés.
- [x] 2026-10-04 — **🔒 CORRIGÉ, VÉRIFIÉ — `GET /api/booking-availability` (public, sans
      session) exposait l'heure exacte de TOUS les créneaux du laveur, y compris ceux
      verrouillés par le masquage.** Un laveur connaissant son propre id pouvait interroger
      cette route pour voir l'heure d'un rendez-vous que son dashboard lui cache. **Décision
      de Ryan** : le masquage doit vraiment frustrer le contournement, pas seulement
      brouiller le dashboard. Impossible de simplement retirer l'heure comme ailleurs (cette
      route sert aussi à empêcher un double rendez-vous sur le même créneau) : un rendez-vous
      verrouillé est maintenant remplacé par un blocage de toute la journée (minuit à minuit,
      heure de Paris), un seul véhicule, sans options — jamais moins prudent qu'avant,
      parfois plus (la journée entière devient indisponible au lieu du seul créneau réel).
      `src/app/api/booking-availability/route.ts` calcule désormais `seuilsVerrouillage` (une
      lecture `washers` en plus, échoue plutôt que d'exposer en clair si illisible). 4 tests
      ajoutés (`route.test.ts`), `tsc`/`eslint`/`vitest run` (2430 tests) et `next build`
      revérifiés.
      (`create_booking_atomic` : voir plus bas, vérifié sans faille. `api/debug/reviews` et
      `e2e/cleanup` : déjà fermés en production, voir section Polish/Audit du site.)
- [x] 2026-10-04 — **🔒 CORRIGÉ, VÉRIFIÉ, POUSSÉ EN PROD — Jeton d'accès séparé pour
      `GET /api/bookings/[id]/pdf`.** `BOOKING_LINK_SECRET` ajouté sur Vercel (production +
      preview) et vérifié en prod par Ryan. **Trouvé en testant manuellement en prod** : le fil
      du jeton n'avait été posé que dans `BookingForm.tsx`/`StepConfirmation.tsx` (la nouvelle
      page) — `LegacyBookingForm.tsx`/`LegacyStepConfirmation.tsx` (la page personnalisée,
      utilisée par les 24 comptes laveurs existants, remis sur ce mode par la refonte) n'avaient
      reçu AUCUN de ces deux fichiers lors de la fusion puisqu'ils ont été créés par la refonte
      après mon correctif initial. Pas de faille : la route bloquait déjà correctement côté
      serveur (verrouillée + pas de jeton → 404) quel que soit le composant d'affichage ; seul
      l'AVANTAGE du jeton (lien qui survit à un verrouillage ultérieur) manquait pour tous les
      laveurs réels. Même correctif ajouté dans les deux fichiers Legacy, revérifié `tsc`/`eslint`/
      `vitest run` (2423 tests) et `next build`. Implémenté selon le plan
      ci-dessous (les 8 étapes), avec deux écarts mineurs documentés dans le diff : jeton en
      base64url plutôt qu'hex, et un rendez-vous saisi par le laveur lui-même (`isOwner`) ne
      reçoit jamais de jeton (il n'est de toute façon jamais verrouillé). Revérifié en conditions
      réelles avec un compte jetable (créé puis supprimé) : id seul sur une réservation
      verrouillée → 404 ; bon jeton → 200 ; jeton d'une AUTRE réservation → 404 ; réservation
      dans le quota sans jeton → 200 (les liens déjà envoyés avant ce correctif continuent de
      marcher) ; facture déjà émise → servie sans bloquer, jeton ou pas.
      Route publique sans session :
      l'id de réservation sert de clé d'accès pour le VRAI client (confirmation/facture sans
      compte), mais le même id est visible du laveur dans son propre dashboard pour une
      réservation verrouillée — il peut donc récupérer le PDF complet (nom, téléphone, adresse,
      heure, prix) en contournant le masquage. Trouvé par `cyber` le 2026-10-02, en même temps
      que la policy RLS ci-dessus (déjà corrigée). Plus délicat qu'un simple garde-fou : la route
      n'a pas de session, donc impossible de distinguer "le vrai client qui retélécharge son PDF"
      du "laveur qui contourne le verrouillage" par la seule authentification.
      **Décision retenue** (approche `cyber`) : un jeton HMAC, distinct de l'id, envoyé au client
      UNIQUEMENT, jamais exposé au laveur. **Étapes 1 à 7 implémentées le 2026-10-04 (non
      commitées)** — `src/lib/bookingToken.ts`, tests verts. **Reste avant de pousser :**
      `BOOKING_LINK_SECRET` à ajouter sur Vercel (déjà dans `.env.local`), puis l'étape 8
      (vérification manuelle). Écarts assumés : sans clé, `genererJetonReservation` renvoie
      `null` (journalisé `bookings.jeton.secret_missing`) au lieu de planter — la réservation
      aboutit, le lien part sans jeton, et une réservation verrouillée reste refusée ; le POST
      ne renvoie pas de jeton au laveur qui saisit son propre rendez-vous. Plan d'origine :

      1. **Nouvelle variable d'env serveur** `BOOKING_LINK_SECRET` (longue chaîne aléatoire,
         jamais `NEXT_PUBLIC_`) — à ajouter en local ET sur Vercel.
      2. **Nouveau fichier `src/lib/bookingToken.ts`** : `genererJetonReservation(bookingId)` →
         `crypto.createHmac('sha256', process.env.BOOKING_LINK_SECRET!).update(bookingId).digest('hex')`
         (ou base64url pour un lien plus court) ; `jetonValide(bookingId, jeton)` qui recalcule et
         compare (en temps constant, `crypto.timingSafeEqual`, pas `===`, pour éviter une attaque
         par mesure de temps). Tests unitaires à côté.
      3. **`src/app/api/bookings/[id]/pdf/route.ts`** (fichier déjà lu, logique exacte connue) :
         - Passer la signature de `GET(_req: Request, ...)` à `GET(req: Request, ...)` pour lire
           `new URL(req.url).searchParams.get('jeton')`.
         - Lire `washer` (déjà fait dans ce fichier pour construire le PDF) + calculer
           `estVerrouillee()` comme dans `confirmation/[id]/page.tsx` (même pattern à copier).
         - Si `booking.facture_numero` est déjà rempli → **toujours servir**, jeton ou pas,
           verrouillée ou pas (exception légale : une facture déjà émise doit rester accessible
           au client qui en a le droit, variable `facture` déjà calculée dans ce fichier un peu
           plus bas, réutiliser la même condition).
         - Sinon, si réservation verrouillée ET (`jeton` absent OU `jetonValide(id, jeton)` faux)
           → 404 (même comportement que `confirmation/[id]`).
         - Sinon → comportement actuel inchangé.
      4. **`POST /api/bookings`** (`src/app/api/bookings/route.ts`) : ajouter `jeton:
         genererJetonReservation(id)` dans la réponse JSON (`{ data: { id, booked_price } }`
         actuellement — regarder la forme exacte avant de modifier, ne pas casser ce qui lit déjà
         cette réponse côté client).
      5. **`src/components/booking/StepConfirmation.tsx:92`** : le lien `href` du bouton PDF
         devient `/api/bookings/${bookingId}/pdf?jeton=${jeton}` (le jeton vient de la réponse du
         POST, à faire remonter dans le state du composant parent si ce n'est pas déjà le cas).
      6. **`src/lib/email/index.ts`**, deux endroits précis à corriger (grep `/pdf` fait le
         2026-10-04, lignes approximatives, à revérifier avant de patcher) :
         - ligne ~179 (`pdfUrl` de l'email de confirmation)
         - ligne ~422 (`url` de l'email de facture)
         Les deux fonctions reçoivent déjà `bookingId` : leur ajouter un paramètre `jeton` (jamais
         optionnel, pour qu'un oubli d'appel casse à la compilation plutôt qu'en silence) et
         construire `${url}?jeton=${jeton}`. **Ne pas toucher** à la ligne ~485
         (`/api/documents/[id]/pdf`, route différente, hors de ce chantier).
      7. **Tests** à ajouter/adapter : route PDF (jeton valide + verrouillée → 200 ; jeton invalide
         + verrouillée → 404 ; sans jeton + verrouillée → 404 ; sans jeton + PAS verrouillée → 200,
         comportement actuel préservé ; facture déjà émise → 200 dans tous les cas) ; génération/
         vérification du jeton (`bookingToken.test.ts`) ; les deux fonctions email (le jeton
         apparaît bien dans l'URL envoyée).
      8. **Vérification manuelle avant de pousser** : créer une réservation de test, vérifier que
         le bouton PDF de l'écran de confirmation fonctionne, vérifier que les emails contiennent
         bien `?jeton=`, vérifier qu'un lien SANS jeton sur cette même réservation échoue une fois
         qu'elle devient verrouillée (compte de test au-delà du quota).

      Compromis déjà acceptés, à ne pas rouvrir : les liens déjà envoyés AVANT ce correctif
      n'ont pas de jeton — ils cassent si la réservation est re-verrouillée plus tard par un
      changement d'offre, SAUF si une facture a déjà été émise (couvert par le point 3). C'est
      un compromis assumé, pas un oubli.
- [x] 2026-10-04 — **🔒 SÉCURITÉ, CORRIGÉ — `fusionner_clients` et `anonymiser_client`
      (fonctions RGPD) exécutables par n'importe quel compte connecté, SANS vérifier que le
      `washer_id` passé en paramètre appartient à l'appelant.** Trouvé par `cyber` en marge de
      l'audit `bookings` ci-dessus — plus grave que lui, puisque destructeur et inter-laveurs
      (pas juste de la lecture) : n'importe quel laveur connecté pouvait fusionner ou anonymiser
      les clients d'un AUTRE laveur, pour peu qu'il connaisse un email/téléphone client (le
      `washer_id` cible, lui, est public). Corrigé par un garde-fou ajouté au début des deux
      fonctions (`if not exists (select 1 from washers where id = p_washer_id and user_id =
      auth.uid()) then raise exception`), plus un `revoke execute ... from public, anon` (ces
      fonctions héritaient par défaut du droit d'exécution Supabase pour tout le monde, pas
      seulement `authenticated`). Un vrai bug indépendant trouvé au passage dans
      `fusionner_clients` et corrigé dans le même SQL : fusionner vers une fiche identifiée par
      téléphone (sans email) pouvait effacer le contenu JSON de devis/factures du client
      (`jsonb_set` qui reçoit un `NULL`). SQL complet dans l'historique de conversation du
      2026-10-04. **Vérifié en conditions réelles** avec deux comptes jetables : un laveur qui
      cible le `washer_id` d'un autre reçoit `42501 Accès refusé`, les données de la victime ne
      bougent pas, et l'usage légitime (un laveur sur ses propres clients) continue de marcher.
- [x] 2026-10-04 — **Vérifié, PAS de faille — `create_booking_atomic`, `emettre_facture`,
      `emettre_document` n'ont ni `anon_exec` ni `auth_exec`** (requête `pg_proc` lancée par
      Ryan). L'hypothèse de `cyber` ne se vérifiait pas pour ces trois-là : fausse alerte,
      rien à corriger.
- [x] 2026-10-04 — **Hygiène, FAIT — `rls_auto_enable` et `support_messages_touch_question`
      n'ont plus le droit `EXECUTE` par défaut pour `anon`/`authenticated`.** Confirmées
      `event_trigger`/`trigger` par la requête `pg_proc` (lecture seule) exécutée par Ryan,
      puis les deux `revoke` ci-dessous exécutés par Ryan. Étaient trouvées dans la même requête
      `pg_proc` que ci-dessus, en marge de la vérification de `create_booking_atomic`. Toutes
      deux `SECURITY DEFINER`, sans paramètre. Analysées par `cyber` le 2026-10-04 : presque
      certainement sans danger, ce sont des fonctions de DÉCLENCHEUR (`RETURNS trigger` /
      `event_trigger`), que Postgres refuse d'appeler directement hors d'un trigger réel, donc
      le droit `EXECUTE` large ne sert à rien à un attaquant.
      - `support_messages_touch_question` : la nôtre, SQL retrouvé dans l'historique de
        conversation (commit `717168f`, 17/09) — met à jour `support_questions` à l'insertion
        d'un message, rattachée au trigger `trg_support_messages_touch_question`.
      - `rls_auto_enable` : pas écrite par l'équipe — c'est l'aide que Supabase crée tout seul
        quand on active "RLS automatique sur les nouvelles tables" dans le tableau de bord
        (déclenchée par l'event trigger `ensure_rls`). À garder, elle protège par défaut toute
        table oubliée.
      **Pas urgent, mais à nettoyer par hygiène** (ne casse rien, fait taire le conseiller
      sécurité de Supabase). Vérifier d'abord en lecture seule que le type de retour est bien
      `trigger`/`event_trigger` :
      ```sql
      select p.proname, pg_get_function_result(p.oid) as returns, p.prosecdef,
             pg_get_userbyid(p.proowner) as owner, pg_get_functiondef(p.oid) as definition
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('rls_auto_enable', 'support_messages_touch_question');
      ```
      Puis, si confirmé :
      ```sql
      revoke execute on function public.rls_auto_enable()                 from public, anon, authenticated;
      revoke execute on function public.support_messages_touch_question() from public, anon, authenticated;
      ```
      (le `from public` est nécessaire en plus de `anon`/`authenticated` : le droit vient de
      `PUBLIC` par défaut, un revoke sans ce mot-clé laisserait les deux rôles en hériter).
- [x] 2026-10-04 — **🔒 CORRIGÉ, VÉRIFIÉ — annulation puis restauration contournait le quota
      de réservations verrouillées.** Le quota mensuel exclut les réservations `cancelled`. Un
      laveur pouvait donc annuler une réservation DANS son quota, ce qui reculait le seuil et
      déverrouillait la suivante en clair (il pouvait même la confirmer), puis repasser l'annulée
      en "pending" sans effet de bord. Deux appels suffisaient. Trouvé par `cyber` le 2026-10-02.
      **Décision de Ryan** : rendre `cancelled` définitif plutôt que de compter les annulations
      dans le quota (qui pénaliserait un laveur pour une annulation faite par son CLIENT). Vérifié
      au préalable qu'aucun écran du dashboard ne permet de "désannuler" une réservation — la
      fonctionnalité n'existait nulle part, le correctif ne retire donc rien. `PATCH
      /bookings/[id]` refuse désormais (409) tout changement de statut une fois `cancelled`. 3
      tests unitaires ajoutés (`route.test.ts`), plus un test Playwright de bout en bout
      (`e2e/dashboard-annulation.spec.ts`, réservation créée par le vrai parcours public, id
      capturé depuis la réponse réseau, contournement reproduit avec la vraie session laveur) —
      non exécutable dans cet environnement (pas d'identifiants `TEST_WASHER_*`), à lancer côté
      Ryan. `tsc`/`eslint`/`vitest run` (2433 tests) et `next build` revérifiés.
- [x] 2026-10-04 — **🔒 CORRIGÉ, VÉRIFIÉ — un laveur qui redescend d'offre pouvait voir une
      réservation déjà FACTURÉE se retrouver re-verrouillée a posteriori** (le plafond de l'offre
      actuelle s'applique rétroactivement sur 12 périodes passées). Signalé par `cyber` le
      2026-10-02 en auditant `POST /bookings/[id]/facture` et `/dashboard/factures` (qui affiche
      déjà `client_name` sans masque, au passage — une incohérence, pas un trou RGPD).
      **Analyse `legal`** : le laveur a une obligation de conservation de ses factures (10 ans,
      Code de commerce art. L123-22 ; 6 ans côté délai de reprise fiscal, LPF art. L102 B) : un
      accès rompu l'expose à perdre une pièce justificative — risque de service pour WashBoard,
      pas un problème RGPD direct (le PDF, pas l'écran dashboard, porte les mentions légales de
      facturation). Masquer le nom ailleurs dans le produit tant que la facture reste accessible
      n'est pas un souci de conformité, mais n'a plus non plus de justification commerciale une
      fois la prestation facturée (et potentiellement déjà réglée) — le masquage ne sert qu'à
      inciter à upgrader AVANT facturation. **Recommandation retenue** : toute réservation
      déjà facturée (`facture_numero` non nul) est exemptée du verrouillage PARTOUT, pas
      seulement sur la route PDF — aligne le détail réservation sur le comportement déjà existant
      de la liste factures, au lieu de l'inverse. Corrigé dans `estVerrouillee()`
      (`reservationsVerrouillees.ts`), le point central déjà utilisé par tous les écrans ;
      `facture_numero` ajouté à la liste de colonnes lue par les 4 endroits qui ne
      sélectionnaient pas déjà `*` (`booking-availability`, `bookings/jour`,
      `clients/page.tsx`, `clients/messages/page.tsx`). Au passage, fuite corrigée dans
      `booking-availability` (créée par mon propre correctif du jour) : `created_at` et
      `saisie_par_laveur`, nécessaires au calcul mais jamais prévus dans la réponse, fuitaient
      dans le JSON renvoyé au visiteur public — la route ne renvoie plus que les 4 champs
      documentés, verrouillé ou pas. 6 tests ajoutés (`reservationsVerrouillees.test.ts`,
      `bookings/jour/route.test.ts`, `booking-availability/route.test.ts`),
      `tsc`/`eslint`/`vitest run` (2449 tests) et `next build` revérifiés. **Vérifié en
      conditions réelles** par `e2e/security-facture-exemption.spec.ts` (nouveau projet
      Playwright `security`) : compte jetable créé et authentifié via le service-role (pas
      `TEST_WASHER_*`, supprimé après coup), 5 réservations dans le quota + une 6ᵉ au-delà
      déjà facturée + une 7ᵉ témoin sans facture — exécuté en local, les deux assertions
      passent (la facturée reste en clair, la témoin reste masquée), nettoyage vérifié (plus
      aucune trace en base après coup).
- [ ] **⚖️ `anonymiser_client` (droit à l'effacement) laisse des données personnelles derrière
      elle**, relevé par `cyber` le 2026-10-04 en relisant la fonction pour le correctif
      ci-dessus. **Analyse `legal` reçue le 2026-10-04, rien codé ni poussé — gros sujet,
      à reprendre à tête reposée plutôt qu'en fin de session.** Décision de Ryan : on
      implémente la partie sans ambiguïté, on suspend l'autre (ci-dessous) en attendant un
      vrai expert-comptable.

      **À effacer, sans ambiguïté (feu vert `legal`, prêt à coder)** :
      - `bookings` : `lat`, `lng` (position GPS exacte du domicile), `billing_address`,
        `vehicles_detail` (saisi par le CLIENT à la réservation, pas une note libre du
        laveur — traité comme nom/email/téléphone, pas comme la limite ci-dessous).
      - `documents` : `contenu.prestation.lieu` (la même adresse que `adresseFacturation`,
        qui elle EST déjà effacée — vraie incohérence, pas un choix), `contenu.client.vehicule`.
      - `client_taches` (pense-bêtes du laveur liés à ce client) : à supprimer EN MÊME TEMPS
        que la fiche, dans la même fonction, juste avant le `delete from clients`. Contrairement
        à la limite déjà actée le 2026-09-28 (notes/véhicules en texte libre qui pourraient
        mentionner un nom — acceptée, pas à rouvrir), ces tâches n'ont AUCUNE autre raison
        d'exister que ce client précis : plus de base légale de conservation une fois la fiche
        effacée.
      - `client_rgpd_journal.cle` (conserve aujourd'hui l'email/téléphone EN CLAIR après
        l'anonymisation — le journal censé PROUVER l'effacement garde la donnée effacée) :
        remplacer par un **HMAC-SHA256** avec une clé secrète serveur (même principe que
        `BOOKING_LINK_SECRET`, voir `lib/bookingToken.ts`), jamais un hash simple (cassable
        par dictionnaire sur un email). **Calculer le HMAC côté TypeScript** (nouveau
        `lib/rgpdHash.ts`, nouvelle variable d'env type `RGPD_JOURNAL_HASH_SECRET`) et le
        passer en paramètre à la fonction SQL plutôt que de gérer un secret dans Postgres —
        cohérent avec tout le reste du produit. Implique : renommer la colonne `cle` en
        `cle_hash` dans `client_rgpd_journal`, modifier la signature de `anonymiser_client`
        pour recevoir `p_cle_hash` en plus de `p_cle`, mettre à jour l'appelant TypeScript
        (route qui déclenche l'anonymisation).
      - **Oubli signalé par `legal` à ne pas ignorer** : les lignes DÉJÀ écrites dans
        `client_rgpd_journal` avant ce correctif contiennent encore l'email/téléphone en
        clair — une fois le secret HMAC choisi, il faudra aussi migrer ces lignes
        existantes (recalculer leur hash avec le même secret), pas seulement corriger la
        fonction pour l'avenir.

      **Suspendu — PAS une décision produit, à trancher avec un expert-comptable
      (Alexandre)** : `bookings.company_name`/`.siret` et `documents.client.entreprise`/
      `.siren`. Une facture B2B peut avoir une obligation légale d'identifier l'acheteur
      professionnel (mentions obligatoires) ; les effacer rétroactivement sur une facture
      déjà émise pourrait fragiliser sa conformité fiscale. Ne pas toucher à ces 4 champs
      tant que ce point n'est pas confirmé.

      SQL de départ fourni par `legal` (à affiner, pas une version validée pour la prod) :
      ```sql
      -- UPDATE bookings : ajouter à l'UPDATE existant
      set lat = null,
          lng = null,
          billing_address = 'Adresse supprimée',
          vehicles_detail = '[]'::jsonb
          -- company_name/siret : SUSPENDU, voir ci-dessus

      -- UPDATE documents : ajouter aux jsonb_set imbriqués existants
      '{prestation,lieu}'   -> to_jsonb('Adresse supprimée'::text)
      '{client,vehicule}'   -> 'null'::jsonb
      -- client.entreprise/client.siren : SUSPENDU, voir ci-dessus

      -- client_taches : avant le "delete from clients"
      delete from public.client_taches where washer_id = p_washer_id and cle = p_cle;

      -- client_rgpd_journal : cle -> cle_hash (calculé en TypeScript, passé en paramètre)
      -- + migration des lignes déjà écrites en clair avec le même secret, une fois choisi.
      ```

- [x] 2026-10-04 — **4 des 5 fuites mineures corrigées, vérifiées.** Trouvées le 2026-10-02
      (dont 3 confirmées par une vérification Playwright en conditions réelles) :
      - `dashboard/clients/page.tsx` → les cartes "bloquées" (déjà sans nom) ne transmettent plus
        `scheduled_at` en entier : tronqué au jour (midi UTC), même règle que `dashboard/page.tsx`.
      - **`ends_at`**, **`lat`/`lng`** et **`travel_fee`** ajoutés au masque central (`MASQUE`
        dans `reservationsVerrouillees.ts`) — réparé en un seul endroit pour tous les écrans qui
        l'utilisent (`dashboard`, `calendrier`, `clients`, `clients/messages`, `crm`, `chiffres`,
        `/api/bookings/jour`, `/api/bookings/historique`).
      - Vérifié : tsc, eslint (0 erreur), vitest run (2451 tests, 2 nouveaux), 7 tests Playwright,
        next build en NODE_ENV=production.
      **Volontairement pas corrigé maintenant, à la demande d'Alexandre** : le prix/durée/
      catégorie de la PRESTATION jointe reste lisible sur une réservation verrouillée (le prix du
      rendez-vous lui-même, `booked_price`, est bien masqué — pas celui de la prestation liée).
      Correctif probable : ajouter `services: null` au masque central, à vérifier contre tous les
      écrans qui l'utilisent (certains pourraient mal gérer une relation `services` soudainement
      nulle). **En attente.**

- [x] 2026-09-27 — **Les factures écrites à la main comptent dans le chiffre d'affaires**, mais
      seulement PAYÉES (choix d'Alexandre : « quand un devis se transforme en facture on met un
      pop up payé ou pas encore payé ; si c'est payé ça va dans l'encaissé, sinon on met un
      bouton payé »). Colonne `documents.paye_le`, question posée à la naissance de toute
      facture (`FeuillePaiement` dans `DocumentsV2.tsx`), bouton « Marquer payée » ensuite,
      projection en lignes d'encaissement par `encaissementsDesFactures` (`chiffresArgent.ts`).
      Elles comptent au jour de la PRESTATION, pas au jour du paiement — comme un rendez-vous
      clôturé en retard, qui compte le jour de son créneau.
- [ ] **La liste `/dashboard/factures` ignore les factures écrites à la main** — et c'est le
      trou comptable qui reste. Les deux sortes partagent LE MÊME compteur : une suite réelle
      peut être `F-00014` (rendez-vous), `F-00015` et `F-00016` (à la main), `F-00017`
      (rendez-vous), alors que la liste n'affiche que les premières et les dernières. Une suite
      de factures ne peut pas avoir de trous. À faire : y ajouter les documents de genre
      `facture` (avec leur PDF, `/api/documents/:id/pdf`) pour que la suite se relise d'un bout
      à l'autre. Écran encore v1 : à traiter en même temps que sa refonte.

- [x] 2026-10-04 — **Quota Supabase : désamorcé par le passage en offre Pro.** Alerte vue le
      2026-09-14 : « Organization exceeded its quota... Projects will be restricted from 05 Oct,
      2026 if your organization remains over quota. » **Vérifié aujourd'hui dans Billing** :
      organisation sur **Pro Plan**, facture d'octobre (25 €) **payée le 2026-10-01**, les 7
      dernières factures affichent toutes « PAID ». Le risque de coupure pure et simple n'existe
      donc plus. Point qui reste vrai, structurellement, tant que le **spend cap** reste activé
      (réglage volontaire : jamais facturé en plus du forfait, mais projet qui peut ralentir ou
      passer en lecture seule en cas de dépassement du quota inclus — pas une coupure pour
      impayé). Mesuré fin septembre (mémoire projet) : consommation retombée à 6 % du quota —
      le risque semble loin aujourd'hui, mais pas nul tant que le spend cap reste activé.
      Les causes probables identifiées le 2026-09-14 restent valables si la consommation
      remonte : fonds/logos servis directement depuis Supabase (`getBgStyle`, sans passer par
      l'optimisation d'images Next/cache Vercel), amplifiés par un pic de trafic viral.

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

## 🧩 Tickets permanents — Guide/tuto & Landing page (ne se ferment jamais)

Deux catégories qui restent ouvertes en continu plutôt que cochées une fois pour
toutes : chaque nouvelle fonctionnalité du produit peut mériter une ligne sur la
landing (nouvel argument de vente) ou dans le guide/tuto (nouvelle chose à
expliquer). Nouvelles idées à ajouter ICI au fil de l'eau, plutôt que dans
🔴/🟡 où elles se perdraient une fois cochées.

### 📣 Landing page

- [ ] **Mentionner le suivi des campagnes Meta (Ads)** — demande de Ryan,
      2026-10-05. La fonctionnalité existe déjà en dashboard
      (`/dashboard/clients/publicites`, derrière `hasFeature(washer, 'campagnes')`
      — suivi du pixel Meta, rattachement des réservations à une campagne) mais
      n'est mentionnée NULLE PART sur `LandingPage.tsx` — aucune occurrence de
      « Meta », « campagne » ou « publicité » dans tout le fichier. **Rapide à
      faire** : pas de nouveau composant, juste une ligne d'argument à ajouter
      dans une liste de features existante (voir par ex. la section « 3 features
      secondaires » déjà présente, même traitement en colonnes). Reste à écrire
      le texte exact et choisir où l'insérer (section dédiée, ou glissée parmi
      les features existantes) — à trancher avec Ryan/Alexandre, pas un choix
      technique.
- [x] 2026-10-05 — **« Trou » visuel à côté du +40 rendez-vous/mois** — signalé
      par Ryan, qui ne savait plus si c'était déjà traité. **Déjà géré** : un
      correctif précédent a ajouté la grille de 3 colonnes juste sous le calcul
      (« Tu hésites encore ? » / « Autre effet du +40 » / « Ce qui ne change
      jamais ») précisément pour combler ce vide (voir le commentaire dans
      `LandingPage.tsx` : « rangés sous le calcul plutôt que dans une seule
      carte compagne qui laissait trop de vide »). Rien à faire, confirmé en
      relisant le code le 2026-10-05.

### 📖 Guide / tuto

- [ ] 2026-10-08 — **Tuto PWA, FUSIONNÉ dans la visite guidée du tableau de
      bord — sur `feat/tuto-pwa`, poussée, preview Vercel vérifiée, PAS ENCORE
      MERGÉE sur `master`.** Demande de Ryan, 2026-10-05, puis très largement
      recadrée en cours de route (2026-10-07/08) : la première version
      (4 arrêts, composant `TutoPwaV2` à part, colonne `pwa_tour_complete_at`
      dédiée) a été jetée une fois que Ryan a précisé ce qu'il voulait vraiment
      — un seul tuto qui accompagne la création du compte de bout en bout,
      pas deux tutos séparés qui se chevaucheraient. **Remplace entièrement
      `VisiteGuidee.tsx` : rien à faire côté SQL, aucune nouvelle colonne,
      réutilise `dashboard_tour_complete_at` qui existait déjà.**
      - `lib/visiteGuidee.ts` : `ETAPES_VISITE` passe à 18 arrêts côté PWA
        (12 sur le site, inchangés dans l'ordre/contenu — décision de Ryan du
        2026-10-02 préservée). Les arrêts `pwaSeulement` (barre du bas,
        bouton [+], geste retour) s'intercalent entre les arrêts « page »
        existants plutôt que d'être un bloc à part : on présente un onglet,
        puis on y entre pour de vrai.
      - **Trois arrêts `interactif`** (Prestations, Horaires, Adresse de
        départ — ce dernier nouveau, c'était le 3ᵉ essentiel bloquant de
        `computeSetupProgress` et il manquait au tuto) : pas de fond sombre
        bloquant, l'écran réel reste cliquable, et la visite avance TOUTE
        SEULE dès que le laveur fait vraiment l'action (ajoute une
        prestation, un horaire, une adresse) — détecté via
        `signalerAvancement`/`abonnerAvancement` (`visiteGuidee.ts`), posé
        juste après chaque écriture réussie dans `usePrestationsV2.ts`,
        `useHorairesV2.ts` et `ProfilV2.tsx` (ces écrans gardent leur état
        local après écriture sans rappeler le serveur, donc les props de la
        page ne suffisaient pas).
      - Découpe lumineuse en CSS pur (`box-shadow` à 9999px autour d'un
        rectangle posé sur la cible via `getBoundingClientRect()`), comme
        prévu initialement — mais le suivi de position est passé d'une
        boucle `requestAnimationFrame` à 60 img/s (saccadait tout le reste
        sur un vrai téléphone, voir plus bas) à de l'événementiel
        (`ResizeObserver` + écouteurs scroll/resize + quelques mesures
        bornées pour rattraper un bandeau qui charge après coup).
      - **Trois tournées de retouches après test réel par Ryan sur preview
        Vercel** (pas que de la vérification Playwright cette fois) :
        1. Double contour (le contour pulsé du site restait posé en plus de
           la découpe PWA, désaligné) — corrigé, l'app n'a plus qu'un seul
           repère à la fois.
        2. Jank réel sur téléphone (« aucune fluidité, mode saccadé ») —
           cause : la boucle `requestAnimationFrame` perpétuelle ci-dessus,
           combinée à des animations CSS qui repeignaient aussi en boucle
           (`box-shadow`/`filter` animés en continu). Remplacées par de
           l'`opacity` pure (compositeur, aucun repeint) ; navigation entre
           arrêts préchargée (`router.prefetch`) plutôt que chargée au clic.
           Mesuré sous ralentissement CPU 6x sur un build de production :
           533 ms de blocage sur une image avant correctif, ~210 ms après.
        3. Saut silencieux « étape 3 à étape 10 » — un arrêt `interactif`
           déjà satisfait en arrivant (compte déjà configuré) avançait
           instantanément sans rien montrer ; enchaîné sur les 3 arrêts
           interactifs d'affilée, ça ressemblait à un bug. Montre maintenant
           le même palier « Fait ✓ » visible que lorsque l'action vient
           d'être faite.
      - **4ᵉ tournée (2026-10-08/09, nuit) — Ryan pas satisfait du rendu
        malgré les trois correctifs ci-dessus : « j'ai pas essayé de faire
        des innovations ou des déplacements fluides et magnifiques »,
        « carte blanche », autonomie totale accordée pour reprendre à zéro
        si besoin.** Plutôt qu'ajuster encore le `transition` CSS, remplacé
        le mécanisme de déplacement lui-même par la **View Transition
        native du navigateur** (`document.startViewTransition`) — prévue
        exactement pour ça : le navigateur capture l'état avant/après et
        morphe lui-même position ET apparence (découpe sombre ↔ halo clair),
        plutôt qu'un simple glissement de `top`/`left`/`width`/`height`.
        - `view-transition-name: wb-visite-spot` sur la découpe/le halo,
          timing personnalisé (rebond, cohérent avec le reste) via
          `::view-transition-group/old/new`. La carte a son propre nom pour
          s'isoler du fondu-enchaîné racine (sinon ancien et nouveau texte
          restaient visibles, superposés — vu en capturant des écrans
          Playwright à 30/80/150/280/450 ms pendant la transition, pas
          seulement en relisant le CSS).
        - Le callback attend la fin RÉELLE de la navigation Next.js
          (asynchrone) via `navigation` (`useTransition`), avec un filet de
          1,5 s pour ne jamais bloquer la page.
        - Même traitement pour « Passer »/« Terminé » (fondu plutôt que
          disparition sèche), petit retour haptique (`navigator.vibrate`,
          Android uniquement) quand une action réelle vient d'être détectée.
        - `prefers-reduced-motion` respecté ; Safari < 18 (pas de support) :
          retombe sur la transition CSS déjà en place, aucune régression.
      - Vérifié à chaque étape par des comptes Supabase jetables + Playwright
        (jamais commités) : tour complet 18 arrêts, double-contour absent,
        ajout réel d'une prestation → avance automatique confirmée,
        recentrage derrière la carte, redémarrage depuis le Guide, fondu
        d'ouverture/fermeture avec et sans support des View Transitions.
        `tsc`, `eslint` (0 erreur), `vitest run` (2469 tests) et
        `next build` propres à chaque commit.
      - **Reste à faire** : accord final de Ryan sur le rendu après cette
        dernière tournée (il doit se reconnecter sur le téléphone — même lien
        de preview, pas besoin de réinstaller), puis fusion sur `master`.

## 🎨 Refonte 2026 — état de la branche `refonte-pwa` au 2026-09-22

> Écrit par le Claude de Ryan en fin de session, pour que celui de Yanis ou
> d'Alexandre reprenne sans redécouvrir. **Passes 0 à 3 faites, la 4 est la
> suivante.** Le plan de vol complet est dans `.claude/agents/refonte.md`.

- [x] **Tuto PWA à la première installation de l'application** (demande
      d'Alexandre, 2026-10-07) — **résolu différemment de ce qui était prévu
      ici : pas un second tuto séparé.** Ryan a tranché le 2026-10-07 que
      cette présentation (barre du bas, bouton central, geste retour) devait
      s'intercaler DANS la visite guidée existante plutôt que se déclencher à
      part à l'installation — un laveur qui installe l'app après coup la
      verra simplement en rejouant la visite depuis le Guide
      (`redemarrerVisite()`). Voir l'entrée « Tuto PWA, FUSIONNÉ dans la
      visite guidée » plus haut (section Guide/tuto) pour le détail de ce qui
      a été construit.
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
- [x] **Passe 4 — barre du bas derrière `washers.beta_refonte`** (code écrit,
      **en attente du SQL** — la colonne n'existe pas encore en base, voir
      plus bas pour l'instruction exacte à donner à Ryan) :
  - `BarreBasV2.tsx` (nouveau) — les 5 destinations de la maquette
    (`project/Main.dc.html`), verre de châssis (nouveaux jetons `--v2-verre-*`
    dans `globals.css`, première utilisation réelle de cette matière : les
    passes 2/3 sont des surfaces opaques). Mapping **interimaire** faute
    d'écrans finaux pour Chiffres et Plus (passes 5/6 pas faites) : Chiffres
    → `/dashboard/compta`, Plus → `/dashboard/parametres` — à corriger dès que
    ces passes livrent leurs vrais écrans. Signalé dans le compte rendu de
    passe pour arbitrage si une autre priorité se dessine avant la passe 5.
  - `DashboardShell.tsx` : branchement par `usePwaStandalone()` (la FORME du
    châssis change, une nav en plus apparaît) **+** nouvelle prop
    `betaRefonte`. **Additif, pas un fork V1/V2** — contrairement au schéma
    `EcranV1/EcranV2` des passes 2-3 : le menu latéral, l'en-tête et le
    contenu ne changent pas de JSX, seule une barre en plus apparaît quand
    `isPwa && !!betaRefonte`. Le menu latéral (Sidebar) n'est conditionné par
    rien de tout ça — toujours rendu, jamais cette règle à revoir avant les
    passes 5/6.
  - `washer.beta_refonte?: boolean | null` ajouté au type `Washer`, même
    convention que `dashboard_widgets` (absent = colonne pas en base,
    `null`/`false` = pas encore dans le bêta, les trois « éteint », jamais une
    erreur). 11 des 12 pages du dashboard passent `betaRefonte={washer.beta_refonte}`
    à `DashboardShell` ; `assistance` et `guide` sont passées de
    `select('name, ...')` à `select('*')` (même règle que ci-dessus : un
    `select` à colonnes nommées casserait tant que `beta_refonte` n'existe pas
    en base) ; `/dashboard/support` (outil interne, hors des 5 destinations,
    n'apparaît dans aucun menu) n'a volontairement pas été touchée.
  - **SQL à donner à Ryan, jamais un fichier de migration** (relecture `cyber`
    d'abord) :
    ```sql
    ALTER TABLE washers ADD COLUMN IF NOT EXISTS beta_refonte boolean DEFAULT false;
    ```
    Une seule colonne sur une table déjà exposée (RLS déjà en place sur
    `washers`) : pas de nouveau `GRANT` nécessaire.
  - Vérifié que le code tourne colonne absente : tous les `select` restent
    `'*'` ou explicites-mais-sans-`beta_refonte`, `!!undefined` → `false`
    partout, aucun risque de casser l'écran pour un laveur réel aujourd'hui.
  - Liste des 12 pages du dashboard vérifiée une à une (voir le compte rendu
    complet de la passe) : aucune ne devient orpheline, le menu latéral reste
    le filet de secours pour CRM, Factures, Guide, Assistance, Abonnement,
    Admin (accessible depuis des liens sur l'accueil, pas depuis un menu) et
    Support (déjà hors menu par conception, avant cette passe).
  - **Piège rencontré, à connaître pour la suite** : l'émulation DevTools
    « Rendering → display-mode: standalone » (Chrome réel) ne se reproduit
    PAS via le CDP `Emulation.setEmulatedMedia` en Playwright avec le
    Chromium 149 fourni (testé headless et headed, `matchMedia` reste
    `false`) — contrairement à `prefers-color-scheme`, qui lui fonctionne.
    Contournement fiable : `page.addInitScript` qui remplace
    `window.matchMedia` pour la seule requête `display-mode: standalone`
    avant tout script de page. Le thème sombre de ce projet n'est pas non
    plus piloté par `prefers-color-scheme` (cookie `theme` lu serveur,
    `layout.tsx`) : `page.emulateMedia({colorScheme})` seul ne change rien,
    il faut poser le cookie (`context.addCookies`).
- [x] **Passe 5 — Chiffres = CRM + Comptabilité fusionnés**, 2026-09-23.
      Nouvelle destination `/dashboard/chiffres`, 3 onglets (Argent ·
      Acquisition · Clients) — voir `project/Chiffres.dc.html`,
      `ChiffresAcquisition.dc.html`, `ChiffresClients.dc.html`. Le mapping
      interimaire de `BarreBasV2.tsx` (Chiffres → `/dashboard/compta`) est
      corrigé, il pointe maintenant vers `/dashboard/chiffres`.
  - **Nouveaux fichiers** : `app/(dashboard)/dashboard/chiffres/page.tsx`
    (charge réservations + événements d'entonnoir + un compte de factures,
    même requêtes que `crm/page.tsx`), `components/dashboard/Chiffres.tsx`
    (garde-fou), `ChiffresV2.tsx` (les 3 onglets), `ChiffresArgent.tsx`,
    `ChiffresAcquisition.tsx`, `ChiffresClients.tsx`.
  - **`CrmDashboard.tsx` et `ComptaDashboard.tsx` ne deviennent PAS des
    points de branchement v1/v2** — décision de cette passe, à ne pas
    rouvrir sans le dire. Contrairement à `ClientsView`/`ClientProfileModal`
    (même URL, contenu qui bascule), « Chiffres » est une destination
    **neuve**, absente de toute navigation v1 : le site n'a jamais de raison
    d'atteindre `/dashboard/chiffres`. `Chiffres.tsx` vérifie quand même
    `isPwaStandalone()` au montage et renvoie vers `/dashboard/crm` sinon
    (lien copié, favori...) — rien pendant la vérification, jamais de flash
    v2 côté site. `/dashboard/crm` et `/dashboard/compta` restent
    entièrement inchangés, joignables par le menu latéral comme avant.
  - **Logique réutilisée telle quelle, aucune requête dupliquée** :
    `crmStats.ts` (`ecartRelatif`, `getLast6Months`, `comptePourLeCA`,
    `effectivePrice`), `comptaPeriod.ts` (`getPeriodRange`,
    `navigatePeriod`), `funnelStats.ts` (`buildFunnelSummary`,
    `restrictToSessionsReaching`, `comparePeriods`,
    `buildReferrerBreakdown`, `buildDeviceBreakdown`,
    `buildVisitTimingBreakdown`, `formatConversionRate`), `crmPeriod.ts`
    (`getCrmPeriodBounds`, `previousCrmPeriod`), `listeClients.ts`,
    `clientProfile.ts`/`buildClientProfile`, et les mêmes routes API que
    `ComptaDashboard.tsx` (`/api/expenses`, `/api/compta/revenue`,
    `/api/compta/year-summary`) — vérifié qu'elles acceptent n'importe
    quelle plage `start`/`end`, y compris une année entière, donc aucune
    route n'a eu besoin d'être touchée. `ClientProfileModal` (déjà v2)
    s'ouvre depuis l'onglet Clients sans rien savoir du nouvel appelant.
    `CATEGORIES` exporté depuis `ComptaDashboard.tsx` (`const` →
    `export const`, seul changement dans ce fichier — son rendu ne bouge
    pas) pour ne pas dupliquer les libellés de catégorie de dépense.
  - **Trois coupes assumées, faute de donnée ou de logique existante** (à
    signaler si Alexandre veut les construire — ce sont des chantiers `dev`,
    pas de la présentation) :
    1. Période de l'onglet Argent : Jour/Semaine/Mois/Année (celle de
       `comptaPeriod.ts`) plutôt que Mois/Semaine/Année/**Tout** de la
       maquette — « Tout » sur l'argent demanderait une nouvelle requête
       d'agrégat sur tout l'historique, qui n'existe pas.
    2. Onglets Acquisition et Clients : pas de sélecteur de période (fixés
       au mois courant / à tout l'historique), la maquette n'en montre pas
       sur ces deux écrans — contrairement à l'ancien CRM qui en propose
       un. Un laveur qui veut naviguer les mois reste sur `/dashboard/crm`.
    3. Onglet Clients : ni les cohortes « reviennent, par mois d'arrivée »,
       ni « gagnés/perdus ce mois », ni « Les relances qui marchent »
       (canal + résultat d'une relance : rien dans la base ne relie
       aujourd'hui une relance envoyée à son canal ni à si le client est
       revenu — voir « Les deux automatismes de message » plus haut, et
       l'étape 4 du plan CRM, `client_events`, pas construite). Remplacé
       par une note honnête plutôt qu'un faux chiffre. Gardés : valeur
       moyenne par client, meilleurs clients (classement par CA, agrégat
       direct de `listeClients`), part CA/RDV pro vs particulier.
  - **Vérifié qu'aucune page ne devient orpheline** : parcours des liens de
    l'ancien CRM (export Excel, filtre Tous/Particuliers/Professionnels,
    fiche client, liens par réseau) et de la Comptabilité (formulaire
    d'ajout de frais, frais récurrents, 4 vues de période, export) — tous
    restent sur `/dashboard/crm`/`/dashboard/compta`, atteignables par le
    menu latéral, non touchés par cette passe. Le nouvel écran renvoie vers
    eux plutôt que de les dupliquer (« + Ajouter un frais » → `/dashboard/
    compta`, « Factures » → `/dashboard/factures`).
  - **Vérifié en local** (compte Kooki Clean, plan Pro) : `tsc`, `eslint`
    (0 erreur, seuls les avertissements `set-state-in-effect` déjà acceptés
    par le projet), `vitest run --coverage` (1006/1006, seuils respectés),
    `next build` propre, et capture Playwright (contournement documenté
    plus bas) sur `/dashboard/crm`, `/dashboard/compta`, `/dashboard/
    chiffres` (3 onglets + fiche client), site et PWA émulée, clair et
    sombre. `/dashboard/crm` et `/dashboard/compta` rendent des captures
    **strictement identiques en octets** entre site et PWA — aucune fuite
    de v2. `/dashboard/chiffres` en mode site redirige vers `/dashboard/crm`
    (capture identique à `/dashboard/crm` normal). **Non vérifié** : l'état
    verrouillé (`UpgradePrompt`) de l'onglet Argent pour un plan Essentiel
    — le seul compte de test disponible (Kooki Clean) est en Pro ; le code
    réutilise exactement le même `hasFeature`/`UpgradePrompt` que
    `/dashboard/compta`, déjà éprouvé là-bas.
- [x] **Passe 5 bis — Chiffres : les graphiques suivent la période**,
      2026-09-24 (demande d'Alexandre : « les diagrammes sont fixes et ne
      s'adaptent pas à la période et aux filtres »). **En attente de
      relecture/commit** (l'agent ne commite jamais).
  - **La période vit dans `ChiffresV2.tsx`** (type + jour de référence,
    défaut : mois en cours) et se partage entre les 3 onglets, elle survit au
    changement d'onglet. Nouveau `SelecteurPeriodeV2.tsx` : Jour/Semaine/Mois/
    Année + flèches précédent/suivant (« suivant » désactivé quand la période
    contient aujourd'hui), cibles 44 px. Nouveau `GraphiqueBarres.tsx` : un
    seul composant pour Argent et Acquisition — toucher/glisser (ou flèches
    du clavier) lit la barre, ligne de zéro, perte = barre vers le bas ET
    rouge, animation coupée sous `prefers-reduced-motion`, `aria-label` de
    résumé.
  - **Argent** : le graphique montre le DÉTAIL de la période (semaine 7
    barres, mois 28–31, année 12, jour = une barre par heure 6 h–21 h élargie
    aux heures qui ont de la donnée). Valeur = résultat du créneau
    (encaissé − dépensé). **Exception vue « Jour »** : les frais n'ont pas
    d'heure, les barres montrent l'encaissé par heure (le titre le dit), le
    résultat du jour reste dans le héros.
  - **Définition du CA = celle de la Compta** (terminé seulement, net de
    remise, `revenuNet`) dans l'onglet Argent ; **celle du CRM** (confirmé +
    terminé, `booked_price ?? services.price`) dans l'onglet Clients — l'écran
    le dit en bas de l'onglet Clients. `/api/compta/revenue` et
    `/api/compta/year-summary` ne sont PLUS appelées par Chiffres : l'encaissé
    est calculé côté client depuis `bookings` (déjà chargées page par page,
    jamais tronquées), donc somme des barres = « Encaissé » par construction.
    Les dépenses viennent toujours de `/api/expenses?start&end`.
  - **Écart connu avec la Compta (v1), non corrigé** : `/api/compta/revenue`
    et `/api/compta/year-summary` bornent en UTC (`start + 'T00:00:00'` sans
    fuseau ; `getMonth()` serveur) — un RDV entre minuit et 2 h (Paris) à une
    frontière de période compte dans la période d'avant. Chiffres découpe à
    l'heure de Paris. Vérifié sur le compte de test (semaine, mois, année,
    mois d'août) : mêmes montants au demi-euro près. À corriger côté API par
    `dev` si on veut que les deux écrans concordent aussi pour un RDV de nuit.
  - **Bugs existants relevés, non touchés (hors périmètre)** :
    `comptaPeriod.navigatePeriod` déborde sur les mois courts (`setMonth`
    depuis un 31 : le 31 octobre « précédent » retombe le 1er octobre) — la
    Compta v1 est concernée les jours 29–31. Chiffres a sa propre navigation
    (`chiffresPeriode.deplacer`, testée). `/api/expenses?start&end` appelle
    `materializeRecurring` : naviguer vers une période passée CRÉE des lignes
    de frais récurrents dans ces mois passés (aucun gabarit actif sur le
    compte de test, donc rien créé pendant la vérification).
  - **Acquisition** : entonnoir, sources, appareils, horaires, comparaison à
    la période précédente ET nouveau graphique « Visiteurs par jour/heure/
    mois » se recalculent (bornes de Paris). Fenêtre de visites = 365 jours
    (`page.tsx`, passée en `evenementsDepuis`) : période entièrement avant →
    « Pas de données avant le … » ; à cheval → mention ; comparaison masquée
    si la période précédente n'est pas entièrement chargée.
  - **Clients** : période + filtre Tous / Particuliers / Pros (sur
    `is_professional` de chaque RÉSERVATION, comme l'ancien CRM). Défaut
    passé de « tout l'historique » à « mois en cours » (pas de « Tout » dans
    le sélecteur commun — à ajouter si Alexandre y tient).
  - Lisibilité : barres à 60 % d'encre (au lieu de `--v2-filet-fort`, 10 %,
    illisible), 30 % pendant qu'on lit une autre barre ; nouveau jeton
    `--v2-color-encre-pale`. Chevrons et barres d'entonnoir/sources en dur
    (`rgba(22,22,26,…)`, invisibles en sombre) remplacés par des jetons.
  - Un RDV `done` daté dans le futur (constaté : 27 sept. sur le compte de
    test) garde sa barre : « à venir » n'est posé que sur un créneau vide.
  - **Non vérifié** : tap réel sur un téléphone (testé avec
    `touchscreen.tap` Playwright + clavier), état verrouillé Essentiel (pas
    de compte), périodes de plus de 1 000 frais.
- [x] **Passe 6 — « Plus » (menu de réglages)**, 2026-09-23. Écrit par un
      agent `refonte` dédié, **en attente de relecture/commit par
      l'orchestrateur** (l'agent ne commite jamais — voir plus bas). Même URL
      qu'avant (`/dashboard/parametres`) : vérifié avant d'écrire que c'était
      bien le cas « même URL qu'un écran v1 existant » (schéma
      `EcranV1.tsx`/`EcranV2.tsx`), pas le cas « destination neuve » de la
      passe 5 (Chiffres) — les deux se ressemblent mais n'ont pas la même
      architecture, voir `.claude/agents/refonte.md`.
  - **Nouveaux fichiers** : `ParametresFormV1.tsx` (reprend à l'identique
    l'ancien `ParametresForm.tsx`, deux onglets, formulaire complet — seul
    ajout : un `id="lien-reservation"` sur la carte du lien, sans effet
    visuel, qui sert de cible d'ancrage), `ParametresFormV2.tsx` (le nouveau
    menu « Plus », planche `project/Reglages.dc.html`), et une route neuve
    `app/(dashboard)/dashboard/parametres/tout/page.tsx` qui rend
    `ParametresFormV1` tel quel, sans passer par le branchement v1/v2.
    `ParametresForm.tsx` redevient un point de branchement
    (`usePwaStandalone()`), même schéma que `ClientsView.tsx`.
  - **Pourquoi la route `/tout` existe, alors qu'elle n'est dans aucune
    maquette** : la maquette « Plus » ne montre que 12 lignes de menu. Le
    formulaire v1 en contient bien plus — email, mot de passe, notifications,
    accès support, zone de danger, facturation — qui n'ont pas de ligne
    dédiée dans ce menu. Sans un filet de secours, ces réglages deviendraient
    inatteignables depuis la PWA dès que `/dashboard/parametres` affiche le
    menu v2 (le menu latéral y renvoie aussi) : exactement le bug des « six
    pages orphelines » qui a coûté la première version du CRM. `Ligne`
    « Messages automatiques » → `#avis`, « Équipe » → `#profil`, « Un lien
    par réseau » → `#lien-reservation`, plus une ligne « Tous les réglages »
    en bas de l'écran v2 pour le reste. À répartir sur ses propres lignes du
    menu au fur et à mesure que ces réglages ont leur écran v2 dédié — pas
    fait dans cette passe, volume trop important pour une seule passe qui
    reste vérifiable.
  - **Trois lignes de la maquette non construites, faute de logique
    existante** (même réflexe qu'à la passe 5 : signalées, pas approximées) :
    1. **« Modèles de messages » (7 dans la maquette)** — le code n'a qu'un
       seul message d'avis (codé en dur dans `api/cron/send-reviews`) et un
       seul message de relance personnalisable. Aucune notion de modèles
       multiples nulle part.
    2. **« Importer mes clients »** — la table `clients` et son import
       (étape 1 du plan CRM, `.claude/agents/refonte.md`) n'existent pas
       encore. Rien à lier à cette ligne.
    3. **Résumé « Lun–Sam » de la ligne Horaires** — aucune fonction du
       projet ne réduit une liste de créneaux (`availabilities`) à un résumé
       de jours ouverts ; `DisponibilitesManager.tsx` a bien un tableau
       `DAYS_SHORT` mais rien qui calcule cette phrase. La ligne s'affiche
       sans valeur plutôt qu'un résumé inventé.
  - **Valeurs affichées, toutes réelles, aucune approximée** : « Messages
    automatiques » compte `review_enabled`/`followup_enabled` ; « Équipe »
    lit `team_size` (affiche « Pro » plutôt qu'un nombre pour un compte sans
    `multi_laveurs`, comme le fait déjà l'ancien formulaire) ; « Prestations
    et prix » réutilise le comptage déjà fait par `page.tsx` pour la barre
    d'avancement (`servicesCount`, nouvelle prop facultative, aucune requête
    ajoutée — `undefined` si la lecture a échoué, pas un zéro inventé) ;
    « Zone et déplacement » lit `zone_config` tel quel (`X km` ou
    `X départements` selon le type stocké — pas de « communes », qui n'existe
    dans aucune des trois formes de zone) ; « Apparence de ma page » montre un
    point de la couleur `brand_color` réelle, jamais un nom de couleur inventé
    (« Bleu » dans la maquette) faute de fonction de nommage ; « Abonnement »
    réutilise `PLAN_LABELS`/`grandfathered`, sans le compte à rebours d'essai
    (les champs `trial_ends_at`/`subscription_status` ne sont pas passés à ce
    composant aujourd'hui — pas ajoutés dans cette passe, ce serait un
    changement de logique, pas de présentation).
  - **Deux réglages du menu qui n'ouvrent rien d'autre** (déviations
    assumées par rapport à la maquette, comme `ChiffresArgent.tsx` à la passe
    5) : « Apparence » (thème) bascule sur place via `useTheme()` — même hook
    que `ThemeToggle.tsx` — au lieu de renvoyer vers l'artboard de référence
    `Sombre.dc.html`, qui n'est pas un écran de réglage ; « Déconnexion »
    réutilise exactement le même `<form action="/api/auth/logout"
    method="POST">` que l'en-tête du dashboard (`DashboardShell.tsx`), pas
    une seconde implémentation.
  - **Repéré en construisant cette passe, non corrigé (hors périmètre)** :
    `ChiffresArgent.tsx` (passe 5) colore ses chevrons en
    `stroke="rgba(22,22,26,0.28)"` codé en dur, sans variante sombre — presque
    invisible sur fond sombre. `ParametresFormV2.tsx` utilise à la place
    `var(--v2-color-gris)` (posé via `style`, une propriété CSS `stroke`
    accepte une variable), correctement contrasté dans les deux thèmes. À
    corriger dans `ChiffresArgent.tsx` si Alexandre le confirme utile.
  - **Vérifié** (compte de test `novaflows.pro@gmail.com`, plan grandfathered,
    slug `autonettoyage`) : `tsc` (0 erreur), `eslint` sur les 5 fichiers
    touchés (0 avertissement), `vitest run --coverage` (1006/1006, seuils
    respectés, inchangé), `next build` propre (`/dashboard/parametres/tout`
    listée parmi les routes). Capture Playwright (contournements
    `display-mode`/cookie `theme` déjà documentés) : site (affiche l'ancien
    formulaire, identique à avant) et PWA (affiche le nouveau menu) × clair
    × sombre, 4 captures. Vérifié en plus que l'ancre `#avis` de
    `/dashboard/parametres/tout` fonctionne (défilement jusqu'à la carte Avis
    Google). **Non vérifié** : un compte non-`grandfathered` en plan
    Essentiel (la ligne « Équipe » afficherait « Pro », jamais testé en
    conditions réelles) ; l'installation réelle de la PWA sur un appareil.
- [~] **Passe 7 — Agenda, sous-lots 1, 2 et 3 sur 3**, 2026-09-23.
      Écrite par trois agents `refonte` dédiés (un par sous-lot, contexte neuf
      à chaque fois — voir plus bas « Comment les passes ont été menées »),
      **en attente de relecture/commit par l'orchestrateur** (l'agent ne
      commite jamais). `CalendrierDashboard.tsx` (1727 lignes avant cette
      passe) est le plus gros fichier du dépôt — le plan de vol annonçait
      « au moins trois passes », ce sous-lot 2 est la deuxième.
  - **Découpe en 3 sous-lots** (décidée en lisant le fichier réel et
    `project/Agenda.dc.html`, pas devinée à l'avance) :
    1. *(fait)* Branchement v1/v2 + la liste du jour en LECTURE SEULE :
       bandeau de 7 jours, cartes de rendez-vous, temps de route estimé entre
       deux jobs, créneaux libres notables, résumé de bas de journée. Ouvrir
       un rendez-vous montrait une fiche v2, mais sans aucune action.
    2. *(fait ici)* Fiche de rendez-vous ACTIONNABLE : changer de statut,
       reprogrammer, écrire une note, émettre une facture, plus le lien de
       notification `?rdv=<id>` réparé côté v2 — voir le compte rendu détaillé
       ci-dessous.
    3. *(fait — voir « Sous-lot 3 » plus bas)* RDV manuel (le « + » de la
       maquette) et congés/indisponibilités — aucun des deux n'apparaît sur l'artboard
       `Agenda.dc.html` (pas de bouton « + » visible dans le HTML exporté, pas
       d'indicateur de congé) : la maquette ne couvre pas ces deux flux sur cet
       écran précis, donc rien à construire à l'identique d'elle. Les
       construire en v2 correctement (feuilles dédiées, jetons v2) est un
       sous-lot à part entière. Le menu latéral (Sidebar) reste le filet de
       secours pour ces deux flux tant que ce sous-lot n'est pas fait.
  - **Nouveaux fichiers** : `CalendrierDashboardV1.tsx` (copie du dernier
    commit avant cette passe, deux extractions de logique pure près — voir
    plus bas), `CalendrierDashboardV2.tsx` (l'agenda du jour).
    `CalendrierDashboard.tsx` redevient un point de branchement
    (`usePwaStandalone()`), même schéma que `ClientsView.tsx` — vérifié avant
    d'écrire que c'était bien le cas « même URL qu'un écran v1 existant »
    (`/dashboard/calendrier`, déjà le lien « Agenda » de `BarreBasV2.tsx`) et
    pas une destination neuve comme Chiffres (passe 5).
  - **Deux extractions de logique PURE, comportement inchangé** (préparent le
    sous-lot 2 autant que ce sous-lot-ci) : `cleStatut` (« Délai dépassé »
    plutôt que « Terminé » sur un rendez-vous clôturé en retard) déplacée de
    `CalendrierDashboard.tsx` vers `@/lib/calendarLayout.ts` ; le calcul
    « km → minutes de trajet à 60 km/h » (dupliqué deux fois dans
    l'avertissement de faisabilité d'un rendez-vous manuel) déplacé vers
    `@/lib/geo.ts` (`estimateTravelMinutes`). Les deux sont maintenant
    importées par `CalendrierDashboardV1.tsx` (résultat identique à avant,
    vérifié par des tests dédiés) et par `CalendrierDashboardV2.tsx` (qui les
    réutilise pour son propre affichage plutôt que d'en garder une copie).
    `Booking`/`CalendrierProps`/etc. exportés depuis `CalendrierDashboardV1.tsx`
    pour la même raison (une seule définition de la forme des données
    envoyées par `calendrier/page.tsx`).
  - **Trois coupes assumées par rapport à la maquette, faute de logique
    existante** (même réflexe qu'aux passes 5 et 6, signalées, pas
    approximées) :
    1. Pas de bouton « Proposer » sur un créneau libre — rien dans le code ne
       sait proposer un créneau à un client (aucune table, aucune route).
    2. Pas de nom de ville par rendez-vous (« Pessac », « Mérignac »...) —
       `ClientProfileModalV2.tsx` avait déjà tranché cette question pour la
       fiche client (« extraire une ville serait deviner un format qui n'est
       pas garanti », l'adresse est un champ libre) : même règle reprise ici.
    3. La ligne 2 de chaque carte montre catégorie·prestation (même repli que
       le modal de détail v1), pas le véhicule/l'option que montre la
       maquette au cas par cas (« Lavage complet · Tiguan »,
       « 4 véhicules VO · sans eau ») — en déduire une règle de mise en forme
       fiable pour chaque type de prestation n'est couvert par aucune
       fonction existante.
  - **Vérifié** (compte de test, plan grandfathered) : `tsc` (0 erreur),
    `eslint` sur les 7 fichiers touchés (0 avertissement nouveau — le seul
    avertissement de `CalendrierDashboardV1.tsx`, `set-state-in-effect` sur le
    lien `?rdv=`, existait déjà avant cette passe), `vitest run --coverage`
    (1013/1013, +7 tests pour les deux extractions, seuils respectés),
    `next build` propre (`/dashboard/calendrier` listée). Capture Playwright
    (contournements `display-mode`/cookie `theme` déjà documentés) : site
    (grille mois, identique à avant) et PWA (agenda du jour) × clair × sombre,
    4 captures. Zoom supplémentaire sur le bandeau de jours en sombre pour
    vérifier que le jour actif (fond clair, texte foncé — inversion du
    fond/encre standard du thème sombre, même mécanisme que le filtre actif
    de `ClientsViewV2.tsx`) n'est pas illisible : correct à l'œil.
    **Non vérifié** : l'installation réelle de la PWA sur un appareil, un
    compte avec plusieurs rendez-vous le même jour à des adresses différentes
    (le seul compte de test disponible n'avait qu'un rendez-vous le jour
    capturé — le calcul de trajet et le créneau libre n'ont donc été vérifiés
    que par la logique/les tests, pas par une capture qui les montre à
    l'écran), la lisibilité au soleil, le poids réel d'une agenda très
    chargée (30+ rendez-vous un jour donné, jamais simulé).
  - **Sous-lot 2 — fiche actionnable + lien de notification**, 2026-09-23.
    Écrit par un second agent `refonte`, sur la base du sous-lot 1 livré et
    commité entretemps par l'orchestrateur.
    - **Logique partagée, extraite en hook plutôt que dupliquée** :
      `src/hooks/useRendezVousFiche.ts` (nouveau) reprend tel quel l'état
      `selected` et les fonctions `openBooking`/`startReschedule`/
      `saveReschedule`/`updateStatus`/`emettreFactureManuelle`/`saveNotes`
      qui vivaient dans `CalendrierDashboardV1.tsx` (~250 lignes retirées de
      ce fichier) — comportement inchangé, mêmes requêtes, mêmes conditions,
      mêmes messages d'erreur. `CalendrierDashboardV1.tsx` et
      `CalendrierDashboardV2.tsx` appellent tous les deux ce hook avec leurs
      propres `bookings`/`unavailabilities`/`teamSize` ; seule la
      présentation (le JSX) diverge. Choix fait après avoir comparé les deux
      options prévues par le sous-lot 1 (composant partagé vs réécriture v2) :
      un **hook** plutôt qu'un composant, parce que la présentation change
      complètement de forme entre v1 (modale centrée, boutons Gmail/WhatsApp
      avec message pré-rempli) et v2 (feuille qui monte du bas, boutons
      Appeler/Message en liens `tel:`/`sms:` simples) — rien à mutualiser côté
      JSX, seulement l'état et les appels réseau.
    - **`ConfirmerClotureV2.tsx`** (nouveau) — même logique que
      `ConfirmerCloture.tsx` (`doitDemanderConfirmation`, inchangée), habillé
      avec les jetons v2 : seule pièce dupliquée de ce sous-lot, en
      présentation pure, pour la même raison que `ClientProfileModalV1`/`V2`
      divergent sur les statuts (aucune source commune de styles entre les
      deux langages visuels).
    - **Lien de notification `?rdv=<id>` réparé côté v2** : un second effet
      `useSearchParams`/`useRef`, propre à `CalendrierDashboardV2.tsx` (pas
      dans le hook partagé — il doit aussi positionner `dayDate`, ce qui
      diffère de la navigation mois/semaine/jour de v1). Contrairement à v1
      (préservé à l'identique, voir plus bas), il appelle `openBooking(rdv)`
      plutôt que d'écrire l'état sélectionné directement : la note existante
      est donc bien pré-remplie dans le champ éditable dès l'arrivée par ce
      lien, ce que v1 ne fait pas (voir juste en dessous) — code neuf, sans
      contrainte de non-régression, autant qu'il n'ait pas ce défaut.
    - **Quirk préexistant de v1 repéré et délibérément PAS corrigé** : le
      chemin `?rdv=` de `CalendrierDashboardV1.tsx` appelait déjà
      `setSelected(rdv)` directement (pas la fonction `openBooking`), donc le
      champ notes s'ouvre vide même si le rendez-vous a une note enregistrée,
      tant que la fiche n'a pas été refermée puis rouverte à la main. Vérifié
      en conditions réelles pendant cette passe (capture `10-site-notification-
      rdv.png`, voir plus bas) : le comportement est identique à avant
      l'extraction, seulement relocalisé dans le hook. Corrigé pour v2, pas
      pour v1 : le site doit rester identique pixel et comportement pour
      point, un correctif de bug est un chantier `dev` séparé, pas cette
      passe.
    - **Fiche v2, ce qui devient actionnable** : point+statut, nom, date/heure
      avec un lien « Modifier » qui bascule sur un formulaire date+heure
      inline (Enregistrer en accent plein, Annuler en filet) ; notes internes
      en `<textarea>` éditable (`onBlur` enregistre, identique à v1) ; boutons
      Confirmer/Marquer terminé/Annuler (masqués une fois le rendez-vous
      Terminé ou Annulé, mêmes règles qu'en v1, y compris le cas « en attente »
      qui autorise de passer direct à Terminé) ; fenêtre de confirmation avant
      clôture tardive (`ConfirmerClotureV2`) ; bouton Émettre la facture /
      lien de téléchargement une fois Terminé, avec le message d'erreur et le
      lien « Compléter mes informations » (pointant vers
      `/dashboard/parametres/tout#facturation`, la route filet-de-secours de
      la passe 6 — `/dashboard/parametres` seul, en v2, n'a plus le formulaire
      de facturation).
    - **Pas construit dans ce sous-lot, par choix de conception, pas oubli** :
      les boutons Gmail/WhatsApp de v1 qui pré-remplissent un message
      (`openGmail`/`openWhatsapp`, `lib/contact.ts`) n'ont pas d'équivalent en
      v2 — `ClientProfileModalV2.tsx` (passe 3) avait déjà tranché ce point
      pour la fiche client avec de simples liens `tel:`/`sms:`, repris ici à
      l'identique pour la cohérence entre les deux fiches v2.
    - **Couleurs** : aucune couleur en dur — jetons `--v2-color-vert`/`-rouge`/
      `-accent`/`-ambre`, vérifiés dans `globals.css` avant usage : ces quatre
      jetons ne sont PAS redéfinis dans le bloc sombre (seuls fond/surface/
      encre/gris le sont), donc une même valeur hexadécimale sert de couleur
      de texte/bordure dans les deux thèmes sans risque de contraste inversé
      (contrairement à `--v2-color-encre`, écarté pour un fond plein + texte
      blanc — bon en clair, imbuvable en sombre où `encre` devient presque
      blanc). `color-mix()` envisagé puis abandonné pour les fonds teintés de
      `ConfirmerClotureV2` (support navigateur incertain sur un Android
      ancien, aucun précédent dans le projet) : remplacé par des `rgba()`
      fixes.
    - **Vérifié** (compte de test `novaflows.pro@gmail.com`, plan
      grandfathered, un vrai rendez-vous confirmé du jour) : `tsc` (0 erreur),
      `eslint` sur l'ensemble du projet (35 avertissements avant cette passe
      → 36 après, +1 exactement — le même avertissement
      `react-hooks/set-state-in-effect` que celui déjà accepté sur le chemin
      `?rdv=` de v1, cette fois sur son équivalent v2, mesuré par comparaison
      avant/après avec `git stash`), `vitest run --coverage` (1013/1013,
      inchangé — le hook et `ConfirmerClotureV2` sont des fichiers React,
      hors du périmètre mesuré par `vitest.config.ts`, `src/lib` +
      `src/app/api` uniquement, même convention que les autres hooks du
      projet), `next build` propre (`/dashboard/calendrier` toujours listée).
      Capture Playwright (contournements `display-mode`/cookie `theme` déjà
      documentés, session réutilisée depuis `e2e/auth.setup.ts`) : site clair/
      sombre (grille mois, identique à avant, non modifiée), PWA clair/sombre
      (liste + fiche ouverte), fiche avec la note en cours d'enregistrement,
      formulaire de reprogrammation ouvert, et le lien `?rdv=<id>` capturé des
      **deux côtés** (site et PWA) sur le même vrai rendez-vous — 10 captures
      au total. La capture côté site confirme au passage le quirk décrit
      plus haut (notes vides malgré une note enregistrée). Note de test posée
      puis retirée par appel direct à l'API après la capture, pour ne rien
      laisser sur la donnée réelle du compte de test.
    - **Non vérifié, signalé plutôt qu'approximé** : les boutons Confirmer/
      Marquer terminé/Annuler et Émettre la facture n'ont pas été cliqués
      pendant la vérification (le seul rendez-vous disponible sur le compte
      de test est un vrai enregistrement encore utile aux passes suivantes ;
      cliquer « Marquer terminé » y aurait déclenché une émission de facture
      réelle) — la logique elle-même n'a pas changé de comportement (extraite
      telle quelle de `CalendrierDashboardV1.tsx`, déjà exercée par ce
      dernier), mais le câblage JSX précis de ces quatre boutons en v2 n'a été
      vérifié que par lecture de code et par le rendu visuel, pas par un clic
      réel de bout en bout. Aussi non vérifié : l'installation réelle de la
      PWA sur un appareil, le rendu avec un rendez-vous professionnel (aucun
      dans les données de test disponibles), une erreur réseau pendant une
      des quatre actions (simulable seulement avec des outils de coupure
      réseau, pas testé), la lisibilité au soleil.
  - **Sous-lot 3 — RDV manuel et congés en v2**, 2026-09-23. Écrit par un
    troisième agent `refonte`, qui a repris l'extraction de logique laissée
    inachevée (non commitée) par un agent interrompu — relue et vérifiée
    avant usage, pas supposée correcte.
    - **Deux hooks partagés, comportement du site strictement inchangé** :
      `src/hooks/useRendezVousManuel.ts` (validation, capacité d'équipe
      compte tenu des congés, avertissement de faisabilité du trajet,
      création) et `src/hooks/useConges.ts` (lister, bloquer, supprimer).
      Vérifié par comparaison mécanique (diff normalisé de l'indentation)
      contre le fichier d'origine `git show HEAD:…/CalendrierDashboardV1.tsx` :
      le corps des fonctions est identique, seule la variable `unavails`
      devient le paramètre `unavailabilities`. Le JSX de V1 n'a pas été
      touché. Une seule addition, pas un changement de comportement : un
      paramètre facultatif `onCree` (rappel appelé une fois, après l'ajout du
      rendez-vous à la liste) que V1 ne passe pas — l'agenda v2 s'en sert pour
      se placer sur le jour du rendez-vous créé.
    - **Preuve de non-régression du site** : mêmes scénarios rejoués sur le
      site (v1) et la PWA (v2) — corps de la requête `POST /api/bookings`
      identique octet pour octet entre les deux, mêmes messages (« Nom du
      client requis », « Créneau complet — 1/1 laveur déjà occupé à cet
      horaire », « Impossible — toute l'équipe est en congés ce jour-là »,
      avertissement de faisabilité « RDV précédent se termine à 12:00 —
      seulement 10 min d'écart… »), même séquence réseau pour les congés
      (`POST` puis `DELETE /api/unavailabilities/<id>`).
    - **Entrée dans l'agenda : un « + » en en-tête, à droite du titre**, qui
      ouvre une feuille à deux choix (« Nouveau rendez-vous » / « Bloquer une
      période »). Pourquoi pas un bouton flottant : la barre du bas
      (`BarreBasV2`) et le bouton Support l'occupent déjà, un troisième objet
      flottant y serait touché par erreur. Pourquoi une feuille à deux choix
      plutôt que deux boutons : un seul point d'entrée à retenir ; coût
      assumé : un tap de plus pour l'action la plus fréquente (le rendez-vous
      manuel). Les deux formulaires se préremplissent avec le jour affiché.
      Alternative écartée : « + » qui ouvre directement le rendez-vous, avec
      les congés en lien discret — à rouvrir si les retours disent que le tap
      en plus gêne.
    - **Congés visibles** (« voir ») : bandeau en tête du jour concerné avec
      « Supprimer » (période, motif, nombre de laveurs si équipe > 1), petit
      point ambre sous le jour dans le bandeau des 7 jours, liste « Congés à
      venir » en bas d'écran (une ligne par période, appui = feuille de
      suppression). Poser : feuille « Bloquer une période » (dates, motifs
      rapides ou libre, nombre de laveurs si équipe > 1) — mêmes champs que v1,
      sans règle nouvelle.
    - **Nouveaux fichiers** : `FeuilleV2.tsx` (feuille du bas générique + les
      classes de champs/boutons partagées par les trois autres),
      `RendezVousManuelV2.tsx`, `CongesV2.tsx`. `FeuilleV2` recopie la
      mécanique de `DetailRendezVous` (Échap, piège de focus, retour du
      focus, masque le bouton Support) plutôt que d'en extraire une base
      commune : `DetailRendezVous` est livré et commité, y toucher aurait
      mélangé refactorisation et fonctionnalité — à unifier quand une
      quatrième feuille apparaîtra. Un formulaire ne se ferme pas d'un tap à
      côté (mains mouillées, saisie perdue) : croix, « Annuler » ou Échap.
    - **Lisibilité** : erreurs et avertissements en « point plein + le
      mot », texte en encre, jamais en rouge/ambre : ces deux jetons ne sont
      pas redéfinis en sombre et donnent ~2,3:1 (rouge) et ~3,3:1 (ambre) sur
      `--v2-color-surface` sombre — sous le seuil pour du texte courant.
      Bouton Supprimer : fond `--v2-color-rouge` + texte blanc (lisible dans
      les deux thèmes).
    - **Limites connues, non corrigées ici** :
      1. L'**email reste obligatoire** pour un rendez-vous manuel (même
         règle que v1) : le rendre facultatif est l'étape 3 du plan CRM, un
         chantier `dev` (route `/api/bookings`, schéma), pas une refonte
         visuelle.
      2. La **liste de suggestions d'adresse** (`AddressAutocomplete.tsx`)
         garde le style v1 (slate) : ce composant est partagé avec le flux de
         réservation public, que la refonte ne touche pas. Lisible dans les
         deux thèmes mais hors jetons ; à habiller par une prop facultative
         quand ce sera décidé.
      3. Les **icônes natives** des champs date/heure sont grisées en sombre
         (rendu du navigateur, pas des jetons).
      4. Pré-existant du sous-lot 1, repéré en passant : à 390 px de large, les
         7 jours du bandeau dépassent de ~14 px et défilent un peu (le « L »
         de lundi se coupe après un appui sur un jour du bout).
    - **Vérifié** (compte de test `novaflows.pro@gmail.com`, plan
      grandfathered, équipe de 1) : `tsc` 0 erreur ; `eslint .` 36
      avertissements, 0 erreur — identique à avant ce sous-lot (les deux
      `set-state-in-effect` sur `?rdv=`, v1 et v2, existaient déjà) ;
      `vitest run --coverage` 1013/1013 (inchangé : hooks et composants React
      hors du périmètre mesuré) ; `next build` propre. Captures Playwright
      (390×844 pour la PWA émulée, 1280×900 pour le site, mêmes
      contournements `display-mode`/cookie `theme`) : PWA clair et sombre —
      agenda avec « + », feuille de choix, formulaire (haut, erreur, client
      professionnel, rempli, après création), avertissement de faisabilité,
      erreur « équipe en congés », bandeau de congé, feuille de suppression,
      feuille d'ajout ; site clair et sombre — grille mois, modale de
      suppression, ajout de congé, avertissement de faisabilité.
    - **Données réelles touchées, dites explicitement** : (a) **Congés** :
      créés puis supprimés par les vraies routes, sur des dates lointaines
      (11 avril 2027 côté PWA, 15 octobre 2026 côté site), 4 aller-retours
      `POST` + `DELETE` ; le compte de test a un congé préexistant le 26
      septembre 2026, jamais modifié — contrôlé en fin de test : seul ce
      congé reste. (b) **Rendez-vous** : **aucun n'a été créé**. `POST
      /api/bookings` était intercepté par Playwright (jamais envoyé) :
      il n'existe pas de route de suppression d'un rendez-vous, une vraie
      création aurait été irréversible (et aurait déclenché les emails de
      confirmation). Conséquence : la création réelle de bout en bout n'a pas
      été exercée en v2 ; seul le corps de la requête envoyée a été comparé
      à v1.
    - **Non vérifié** : appareil réel (clavier iOS/Android qui recouvre le pied
      de la feuille malgré `interactive-widget=resizes-content` ; tap sur les
      champs date/heure natifs), équipe de plus d'un laveur (le sélecteur
      « laveurs indisponibles » et les libellés « capacité réduite » n'ont
      jamais été affichés), avertissement de faisabilité avec coordonnées
      GPS (chemin « trajet estimé ~N min pour ~K km » : même hook, jamais
      exercé en v2 faute d'adresse sélectionnée dans la liste), rendu de la
      feuille sur grand écran (`sm:` — non capturé), lecteur d'écran.
- [~] **Ajout hors sous-lot — « Proposer » un créneau libre à un client**,
      2026-09-24. Demande d'Alexandre : la maquette montrait un lien
      « Proposer » sur la ligne de créneau libre sans dire vers quoi (le
      sous-lot 3 l'avait donc coupé, voir juste au-dessus) ; décidé ce jour-là :
      il ouvre une feuille listant les clients du laveur, en choisir un part
      vers WhatsApp ou SMS avec un message déjà écrit, modifiable avant envoi.
      **En attente de relecture/commit par l'orchestrateur.**
  - **Nouveaux fichiers** : `ProposerCreneauV2.tsx`. Modifiés :
    `CalendrierDashboardV2.tsx` (le bouton « Proposer » sur la ligne de trou,
    plus la ville du rendez-vous qui précède le trou via `villeDepuisAdresse`,
    déjà utilisée ailleurs dans ce fichier), `src/lib/phone.ts`/`phone.test.ts`
    (nouvelle fonction `whatsappDigits`, voir plus bas), `src/lib/contact.ts`
    (la réutilise, comportement inchangé — `openWhatsapp` sert toujours le
    site v1).
  - **Rien de nouveau en base, aucune route ajoutée** : ce sont des liens
    `wa.me`/`sms:`, comme les boutons Appeler/Message existants
    (`ClientProfileModalV2.tsx`). Réutilise `listeClients`/`rechercherClients`
    (`@/lib/listeClients`) sur les réservations déjà chargées par l'agenda —
    aucune requête ajoutée.
  - **Ordre de la liste** : le client sans nouvelle depuis le plus longtemps
    en premier (tri croissant sur `activite`, le champ que `listeClients`
    calcule déjà — simple inversion de son tri par défaut, aucun nouveau
    calcul). Raisonnement : proposer ce créneau EST une relance déguisée ; un
    client revenu récemment ou qui a déjà un rendez-vous à venir n'en a pas
    besoin, et son `activite` récente le fait naturellement descendre en fin
    de liste.
  - **Client sans téléphone** : affiché quand même (le masquer aurait laissé
    croire qu'il n'existe pas), mais sans les boutons WhatsApp/SMS — une ligne
    « Pas de téléphone — impossible de le lui proposer ainsi. » à la place,
    pour ne jamais laisser une action échouer en silence.
  - **Message suggéré** (via `messageCreneau`, `ProposerCreneauV2.tsx`) :
    `Bonjour {prénom}, j'ai un créneau libre {jeudi 24 septembre} de {10h00} à
    {12h00}. Ça vous intéresse ?` — ne mentionne pas la ville, déjà donnée par
    la ligne du créneau quand l'adresse la fournit.
  - **`whatsappDigits` extraite de `contact.ts`** (`openWhatsapp` faisait
    cette normalisation en dur) vers `@/lib/phone.ts`, testée
    (`phone.test.ts`), réutilisée par `openWhatsapp` **et** par
    `ProposerCreneauV2.tsx` — comportement de `openWhatsapp` vérifié
    inchangé (elle ne valide rien, contrairement à `normalizePhone` : un
    numéro imparfait continue de produire un lien).
  - **Limite découverte en testant sur le compte réel** (pas introduite par
    cet ajout, déjà vraie pour l'écran Clients) : `listeClients` exige un
    email pour regrouper un client (son unique identifiant stable
    aujourd'hui) — un rendez-vous sans email (le RDV manuel n'en a jamais
    exigé un dans la maquette, et l'étape 3 du plan CRM veut le rendre
    facultatif partout) n'apparaît dans AUCUNE liste de clients, y compris
    celle-ci, alors que « Proposer » ne se sert justement que du téléphone.
    Vérifié sur le compte de test : deux rendez-vous du jour (« Yanis Zidi »,
    « ad ») ont un email vide et n'apparaissent ni ici ni dans `/dashboard/
    clients`. Pas corrigé ici — changer la clé d'identification d'un client
    est une décision de logique métier partagée (étape 1 du plan CRM, table
    `clients` dédiée), pas une présentation.
  - **Séparateur `sms:?body=` vs `sms:&body=`** : iOS et Android n'acceptent
    pas le même séparateur avant `body` — détection par `navigator.userAgent`
    (`/iPad|iPhone|iPod/`, même test que `NotificationsToggle.tsx`), câblée
    directement dans `ProposerCreneauV2.tsx` sans extraction (composant, pas
    logique pure testable côté `src/lib` sans DOM).
  - **Vérifié** (compte de test `novaflows.pro@gmail.com`) : `tsc` 0 erreur ;
    `eslint` sur les fichiers touchés (0 erreur, 1 avertissement
    `set-state-in-effect` préexistant sur `?rdv=`, déjà présent avant cet
    ajout) ; `vitest run --coverage` 1042/1042 (+7 tests `whatsappDigits`,
    seuils respectés) ; `next build` propre. Captures Playwright (mêmes
    contournements `display-mode`/cookie `theme` que les passes précédentes,
    390×900) sur les VRAIES données du compte de test (un trou réel de 30 min
    ce jour-là) : PWA clair/sombre — agenda avec « Proposer », feuille
    ouverte (8 clients existants, triés du moins récent au plus récent),
    recherche filtrée ; site clair/sombre — grille mois v1, inchangée, pas de
    « Proposer ».
  - **Non vérifié** : le rendu de la ligne « Pas de téléphone » — tous les
    clients du compte de test ont un numéro enregistré, aucun cas réel
    disponible pour la capturer ; la branche est simple
    (`{c.phone ? … : …}`, vérifiée par relecture et par le typage) mais pas
    prouvée à l'écran. Le séparateur `sms:` selon iOS/Android (un seul
    appareil disponible). L'ouverture réelle de WhatsApp/l'app SMS avec le
    texte prérempli (les liens `wa.me`/`sms:` n'ont pas été cliqués jusqu'au
    bout, pour ne rien envoyer). Appareil réel, lecteur d'écran.
- [~] **Ajout hors sous-lot — vue du mois dans l'agenda (PWA)**, 2026-09-24.
      Demande d'Alexandre, modèle : le Calendrier d'Apple sur iPhone, vue du
      mois — « on change de mois en scrollant, on peut choisir une date et ça
      se met sur la semaine avec la vue actuelle ; on arrive sur la semaine
      mais il faut pouvoir accéder à la vue mois ».
      **En attente de relecture/commit par l'orchestrateur.**
  - **Nouveaux fichiers** : `MoisV2.tsx` (la vue), `src/lib/vueMois.ts` +
    `vueMois.test.ts` (calculs purs : plage de mois, semaines d'un mois,
    comptage des rendez-vous actifs par jour, points sous un numéro — 19
    tests). Modifié : `CalendrierDashboardV2.tsx` uniquement (v1 et tous les
    autres écrans intouchés — la vue n'existe pas sur le site).
  - **Comportement** : le bouton grille (à gauche du « + ») ou le titre du mois
    ouvrent une couche plein écran (`fixed`, sous la barre du bas, sous le menu
    latéral) qui se cale sur le mois du jour affiché. Défilement continu de
    12 mois avant à 24 mois après le mois courant ; titre du mois aligné sur la colonne du 1er
    (comme sur iPhone), année ajoutée hors de l'année en cours ; initiales L M
    M J V S D + « ‹ Semaine » + « Aujourd'hui » dans un en-tête collant en
    verre (voile de la couleur de fond + flou : seul élément translucide, la
    grille est sur papier opaque). Aujourd'hui = rond plein accent, jour affiché
    dans l'agenda = rond encre (même convention que le bandeau de 7 jours),
    week-ends en gris. Toucher un jour ferme la vue, place l'agenda sur ce jour
    et le remonte en haut de page ; « ‹ Semaine » et Échap ferment sans
    choisir. `?rdv=` n'est pas touché : la vue ne s'ouvre que sur un geste.
  - **Indicateurs** : un point encre par rendez-vous non annulé (`compterActifs
    ParJour`, sur le `byDate` déjà tenu par l'agenda) jusqu'à 3, puis 3 points
    et un « + » (un chiffre exact ne tient pas dans 55 px à côté des points, et
    le détail est un tap plus loin) ; un point ambre pour un congé (même
    convention que le bandeau de 7 jours, via `getUnavail`). Aucun chargement
    supplémentaire.
  - **Coût, mesuré** (Playwright, Chromium headless, `next dev` — donc PLUS
    LENT qu'en production ; ordre de grandeur seulement) : ouverture de la vue
    entre le tap et la deuxième frame. Première version (37 mois rendus d'un
    coup, `content-visibility: auto` par bloc) : ~120–325 ms sans limitation
    CPU, ~2 000 ms avec CPU ×4. `content-visibility` seul n'y changeait rien
    (le coût est le rendu React de ~1 100 boutons, pas la mise en page). Version
    livrée : chaque mois est un bloc à hauteur exacte (titre + semaines × 60 px)
    dont le contenu n'est rendu que lorsqu'il approche de l'écran
    (IntersectionObserver, un écran d'avance) ou est voisin du mois cible :
    ~50 ms sans limitation, ~150–450 ms en CPU ×4 ; 245 boutons montés à
    l'ouverture au lieu de 1 126. `content-visibility: auto` est gardé en
    complément pour les mois déjà rendus et dépassés (défilement long — non
    mesuré).
  - **Indépendance vis-à-vis de l'en-tête d'appli** : la vue est en `fixed`, son
    en-tête colle au haut de l'écran quoi qu'il y ait dessus ; l'agenda, lui,
    garde son `-mt-6 pt-6` — capturé avec `header{display:none}` : le titre
    reste à 24 px du haut, rien ne dépend de la barre. Le manifeste est en
    `statusBarStyle: "default"` : pas de recouvrement de la barre d'état, donc
    pas de marge d'encoche à ajouter en haut (un `env(safe-area-inset-top)` est
    quand même posé sur l'en-tête de la vue, à 0 aujourd'hui).
  - **Vérifié** : `tsc` 0 erreur ; `eslint` sur les 4 fichiers (0 erreur, 1
    avertissement `set-state-in-effect` préexistant sur `?rdv=`) ; `vitest run
    --coverage` 88 fichiers / 1 061 tests verts ; Playwright PWA émulée
    390×844 clair et sombre (agenda avec le nouveau bouton, vue ouverte sur
    septembre 2026 avec rendez-vous le 24 et congé le 26, mois suivant, saut
    lointain puis « Aujourd'hui », choix du 29 → agenda sur mardi 29, réouverture
    avec le 29 en rond encre, retour et Échap) + 1280×800 clair + agenda sans
    en-tête ; site 1280 px : aucun bouton « Voir le mois ». Aucune donnée créée,
    modifiée ni supprimée.
  - **Non vérifié** : le geste de défilement sur un vrai téléphone (fluidité,
    élan, arrivée sur un bloc pas encore rendu en défilement très rapide : un
    vide d'une frame est possible, le rendu se fait un écran d'avance mais pas
    plus) ; le rendu en verre de l'en-tête sur un Android ancien
    (`backdrop-filter`) ; le texte agrandi par le système (hauteurs de ligne
    fixes en px) ; `inert` sur iOS Safari (supporté depuis 15.5) ; le bouton Retour d'Android : il quitte l'agenda au lieu de fermer
    la vue (pas d'entrée d'historique — à décider : `pushState` interfère avec
    le routeur de Next, non tenté) ; lecteur d'écran.
  - **Constat hors périmètre** : les feuilles de l'agenda (`Feuille`,
    `DetailRendezVous`) retirent `wb-hide-fab` du `<body>` à leur fermeture, ce
    qui, d'après le code (non vérifié à l'écran), réaffiche le bouton WhatsApp
    par-dessus la barre du bas dans la PWA bêta
    tant qu'on ne recharge pas la page — la vue du mois n'y touche donc pas.
- [x] **Passe 8 — « Aujourd'hui » en v2**, 2026-09-23. Écrite par un agent
      `refonte`, relue et commitée par l'orchestrateur. Dernière passe du plan
      de vol.
  - **Correction de fait, au passage** : le briefing annonçait que les widgets
    ne se réordonnent pas. **C'est faux** — `WidgetsConfigurator` a une
    fonction `deplacer()`, et `widgetsVisibles(pref)` respecte l'ordre
    enregistré. C'est **l'en-tête de `lib/dashboardWidgets.ts` qui est périmé**
    (« Quatre blocs » alors qu'il y en a 7, « aucune réorganisation » alors
    qu'elle existe) : commentaire corrigé dans un commit séparé, puisque c'est
    du code v1. Seul le *glisser* de la maquette n'existe pas ; le
    réordonnancement, si.
  - **Décision : la v2 impose sa colonne vertébrale, les widgets pilotent le
    reste.** Les deux autres options ont été écartées pour de bonnes raisons :
    rhabiller les 7 widgets en v2 (5 sur 7 sont des tuiles « libellé / gros
    chiffre » — le tic explicitement interdit — et 5 sur 7 doublonnent des
    destinations que la v2 a déjà) ; les ignorer (jetterait un réglage déjà
    stocké et rendrait le bouton « Configurer » du site menteur d'un appareil à
    l'autre). Retenu : **même colonne `washers.dashboard_widgets`, même
    registre, même `widgetsVisibles()`, même `PATCH /api/washer`.** Un widget
    masqué sur le site reste masqué dans la PWA, et l'ordre du laveur est
    respecté.
  - **Deux écarts assumés dans cette décision** : (1) la colonne vertébrale
    (héros + la journée + à confirmer) **n'est pas gouvernée par la clé
    `today`** — en v1 la masquer laissait « À venir » juste dessous, donc on
    masquait un doublon ; en v2 la journée EST l'écran, appliquer cette clé
    viderait la destination de son seul rôle. La clé continue de piloter le
    widget du site, inchangée. (2) Les six autres deviennent **des lignes, pas
    des tuiles**, regroupées dans une carte commune ; `upcoming` garde sa
    section (« Ensuite ») parce qu'une liste de rendez-vous n'est pas une ligne.
  - **Le vrai piège de cette passe, désamorcé** : `PersonnaliserV2` réinjecte
    `today` **exactement à sa position stockée** au moment d'enregistrer. Sans
    ça, régler son accueil dans la PWA aurait modifié celui du navigateur en
    douce.
  - **Pas de `AccueilV1.tsx`, et c'est délibéré** — seule entorse au schéma des
    passes 2/3/7. L'accueil v1 n'est pas un composant : c'est l'assemblage fait
    par `page.tsx`, dont plusieurs morceaux (`StatsWidget`, `ClientsWidget`,
    `ZoneWidget`) sont des composants **serveur**. Le recopier dans un fichier
    client les aurait poussés dans le navigateur et aurait changé le rendu du
    site. Il passe donc tel quel, déjà rendu, dans la prop `v1` de
    `Accueil.tsx`. Diff de `page.tsx` : 60 ajouts, 3 suppressions, JSX v1
    déplacé verbatim dans un fragment, widgets non touchés, aucune requête
    ajoutée.
  - **Nouveaux fichiers** : `Accueil.tsx` (branchement `usePwaStandalone()`),
    `AccueilV2.tsx` (l'écran), `PersonnaliserV2.tsx` (la feuille de réglage).
  - **Deux ajouts hors maquette, assumés** : si la journée est vide, le héros
    bascule sur le **prochain rendez-vous tout court** avec sa date (un écran
    vide un jour de repos n'aide personne) ; et le sous-titre distingue
    « Journée terminée » de « Rien de prévu aujourd'hui ».
  - **Coupes assumées** : (1) la section **« À faire »** de la maquette — les
    tâches n'existent nulle part dans le produit, ni table ni route ; (2) le
    **« 12 min de route » du héros** — c'est le trajet depuis la position du
    laveur, or `washers.base_address` est un texte libre jamais géocodé ; le
    temps de route n'apparaît donc que là où il est calculable et déjà éprouvé
    (entre deux rendez-vous, et en total de journée) ; (3) **« portail 1234 »**
    — aucun champ « code d'accès » n'existe, `notes` est la note interne du
    laveur ; (4) **six des douze blocs de `Personnaliser.dc.html`** (météo,
    avis reçus, devis, factures impayées, créneaux libres, tâches) n'existent
    nulle part ; (5) poignées de glissement → **flèches**, le mécanisme réel ;
    (6) l'historique et « Charger plus » ne sont pas sur l'accueil v2 —
    vérifié non orphelin (l'agenda v2 navigue les jours passés, la fiche client
    garde l'historique).
  - **Vérifié** : `tsc` 0 erreur · `eslint` sur les 4 fichiers 0 avertissement,
    et `eslint src` mesuré par `git stash` → **34 avertissements avant comme
    après, zéro nouveau** · `vitest` 1013/1013 · `next build` propre,
    `/dashboard` toujours listée, aucune route parasite. 6 captures 390×844
    clair et sombre (accueil, personnaliser, journée terminée). Trois défauts
    trouvés grâce à ces captures et corrigés : « Mercredi 23 **S**eptembre »
    (`capitalize` → `first-letter:uppercase`), « Sam. 26 » qui passait à la
    ligne dans la colonne de 40 px, et le prix du héros avalé par les points de
    suspension d'une prestation à nom long.
  - **NON vérifié, à faire dès que `.env.local` existe sur le poste** : il n'y
    a **ni `.env.local` ni `.env.test.local`**, donc aucune connexion possible.
    Les captures viennent d'une **route jetable** (`/apercu-passe8`) rendant
    `AccueilV2` avec des données fabriquées dans le même châssis DOM —
    supprimée depuis, arbre propre. Elles prouvent le rendu, la mise en page,
    le sombre et la feuille ; elles **ne prouvent pas le branchement ni le
    câblage des données**. Restent à vérifier : que le site rende v1 et la PWA
    v2 sur `/dashboard` réel (4 captures + comparaison octet à octet du site
    avant/après, comme aux passes 5 à 7) · le `PATCH /api/washer` de
    `PersonnaliserV2`, jamais envoyé · le lien Itinéraire sur un vrai téléphone
    (sur iOS sans l'app Google Maps, il ouvrira Safari) · un compte neuf (la
    `DemarrageCard` en haut de l'écran v2) · un plan Essentiel (CA masqué) ·
    l'installation réelle, la lisibilité au soleil.
  - **Deux détails signalés, non corrigés** : les flèches de réordonnancement
    font 32 px et non 44 (deux cibles de 44 empilées donneraient des lignes de
    88 px ; l'interrupteur, lui, fait bien 44×44) ; et le fond papier s'arrête
    où le contenu s'arrête, laissant apparaître le `slate-50`/`slate-950` du
    châssis en bas d'écran — même comportement qu'à la passe 7, le corriger
    proprement toucherait `DashboardShell` et tous les écrans encore en v1.


- [x] **Retrait de l'en-tête et du menu latéral dans la PWA en bêta**,
      2026-09-24. Demande d'Alexandre : « Supprime le header, on est en mode
      vraiment ressembler à une app. » Écrit par un agent `refonte`, **non
      commité, rendu vérifié par relecture seulement** (voir plus bas).
  - **Condition** : la même que la barre du bas — PWA installée
    (`html.wb-pwa`) ET `washer.beta_refonte`. **Site (mobile et ordinateur) et
    PWA sans bêta : en-tête et menu inchangés d'un iota** (les classes ajoutées
    ne s'activent que sous `html.wb-pwa`).
  - **Mécanisme : CSS, pas le hook.** Contrairement à la barre du bas (un ajout,
    un flash accepté), un en-tête qui apparaît puis disparaît au montage
    provoquerait un saut de mise en page. `DashboardShell` pose donc
    `wb-entete-beta` sur le `<header>` dès que le serveur sait que le laveur est
    dans le bêta, et `wb-entete-barre` sur la rangée ☰ / « WashBoard » / badge de
    plan / déconnexion / thème ; `globals.css` (bloc juste sous la convention
    `wb-pwa`) masque la rangée et rend au `<header>` un rôle de simple bloc en
    flux normal (plus collant, sans fond ni filet). Zéro flash. Le `Sidebar`,
    lui, n'est plus monté quand `showBarreBas` (il était fermé hors écran, mais
    ses liens restaient focalisables au clavier).
  - **Bandeaux conservés** : `TrialBanner` (fin d'essai, essai expiré, carte
    enregistrée, résiliation programmée — l'information commerciale) et
    `AppBetaBanner` restent dans le `<header>`, donc visibles, en haut de page,
    en flux normal (ils défilent avec la page au lieu de rester collés).
    Aucun changement de composant ni d'état : pas de remontage.
  - **Compteur de messages non lus** : il ne peut plus être sur un ☰ (il n'y en
    a plus dans ce mode). Il est porté par la ligne **« Aide et assistance »**
    de « Plus » (point plein + « 3 non lus », `9+` au-delà), et celui de
    l'équipe par la ligne **« Support (équipe) »**. Nouveau
    `SupportBadgesContext.tsx` : `DashboardShell` continue d'interroger
    `/api/support/non-lues`, `/non-lues-equipe` et `/est-equipe` une seule fois
    par page et redistribue le résultat — aucune requête ajoutée.
    **Contrepartie assumée** : le signal n'est plus visible d'un coup d'œil
    depuis n'importe quel écran ; il faut ouvrir « Plus ». Piste si c'est trop
    discret : un point sur l'onglet « Plus » de la barre du bas (fichier
    `BarreBasV2.tsx`, un `unreadSupportCount` de plus) — non fait, à arbitrer.
  - **Ce que le menu latéral donnait vs ce qui est atteignable maintenant**,
    page par page (les 14 pages de `app/(dashboard)/dashboard/`, vérifiées une
    à une dans le code, pas de mémoire) :
    | Page | Avant (PWA bêta) | Maintenant |
    |---|---|---|
    | `/dashboard` | menu « Tableau de bord » | barre du bas › Aujourd'hui |
    | `/dashboard/calendrier` | menu « Calendrier » | barre du bas › Agenda |
    | `/dashboard/clients` | menu « Clients » | barre du bas › Clients |
    | `/dashboard/chiffres` | barre du bas | barre du bas › Chiffres |
    | `/dashboard/compta` | menu « Comptabilité » | Chiffres › Argent (lien « + Ajouter un frais », `ChiffresArgent.tsx` — la compta entière n'a pas d'autre entrée, mais c'est l'entrée existante depuis la passe 5) |
    | `/dashboard/factures` | menu « Factures » | Chiffres › Argent (ligne « Factures · N émises ») |
    | `/dashboard/crm` | menu « CRM » | **« Plus » › De temps en temps › « Export et liens par réseau » (ajouté)** |
    | `/dashboard/guide` | menu « Guide » | **« Plus » › Mon compte › « Guide d'utilisation » (ajouté)** ; aussi le lien du bandeau d'annonce |
    | `/dashboard/assistance` | menu « Assistance » + compteur | « Plus » › Mon compte › « Aide et assistance » + compteur (existait, compteur ajouté) |
    | `/dashboard/abonnement` | menu + badge de plan du ☰ + bandeaux | « Plus » › Mon compte › « Abonnement » (affiche déjà le plan) ; liens des bandeaux |
    | `/dashboard/parametres` | menu « Paramètres » | barre du bas › Plus |
    | `/dashboard/parametres/tout` | via Paramètres | « Plus » › « Tous les réglages » (email, mot de passe, notifications, accès support, zone de danger) |
    | `/dashboard/admin` | accueil, Paramètres | « Plus » › Une fois (prestations, horaires, zone, apparence de ma page) |
    | `/dashboard/support` | menu « Support (équipe) » — équipe seulement | **« Plus » › Outil interne › « Support (équipe) » + compteur (ajouté), visible uniquement si `/api/support/est-equipe` confirme** |
    Aussi disparus avec l'en-tête, déjà dans « Plus » : déconnexion, thème
    (« Apparence »), badge de plan (ligne « Abonnement »). **Non repris** : les
    icônes Instagram / TikTok du pied de menu (liens externes, pas des pages).
  - **Corrigé au passage** : `/dashboard/support` ne transmettait pas
    `betaRefonte` au châssis (son `select` nommait ses colonnes) — la barre du
    bas y aurait disparu et l'en-tête serait revenu. Passé à `select('*')`
    (même règle que guide/assistance, passe 4) + `betaRefonte` transmis.
  - **Haut de page** : `main` garde `pt-6`. `layout.tsx` déclare
    `appleWebApp.statusBarStyle: "default"` : sur iOS le contenu commence sous
    la barre d'état opaque (`safe-area-inset-top` vaut 0), aucune réserve à
    ajouter. Les quatre écrans v2 qui se calent sur l'ancien en-tête
    (`-mt-6` : Accueil, Agenda, Clients, Chiffres) restent corrects — leur fond
    papier remonte simplement jusqu'en haut de l'écran et leur `pt-6` donne
    24 px d'air. **Non modifiés.**
  - **À signaler, non traité** : (1) `CrmDashboard.tsx` (v1, inchangé) affiche
    toujours un titre « CRM » : un laveur qui ouvre « Export et liens par
    réseau » le voit. Le changer touche le site, donc arbitrage d'Alexandre —
    piste : `usePwaStandalone()` dans ce seul titre. (2) `themeColor` de
    `layout.tsx` reste `#ffffff` / sombre : sans en-tête blanc dessous, la barre
    d'état Android peut jurer avec le fond papier `#F6F5F3` des écrans v2 (à
    voir sur un vrai téléphone ; le changer ici modifierait aussi la couleur du
    navigateur sur le site). (3) `AppBetaBanner` (« Recevez vos réservations en
    notification ») s'affiche dans la PWA déjà installée, où l'annonce est
    presque sans objet — gardé à la demande, à reconsidérer. (4) Les écrans
    encore en v1 sous le châssis (Compta, Factures, Guide, Assistance...)
    gardent le fond `slate-50` du châssis, pas le papier.
  - **Vérifié** : `tsc` 0 erreur · `eslint` sur les 5 fichiers touchés 0
    avertissement · `vitest run` 1061/1061 (88 fichiers). **NON vérifié** :
    aucun rendu — ni `next build`, ni serveur de dev, ni Playwright (un autre
    agent travaillait dans le même dossier `.next`). À faire : 4 captures
    (site / PWA émulée × clair / sombre) sur `/dashboard`, `/dashboard/parametres`
    et une page à bandeau (compte en essai) ; vérifier que le site est
    strictement identique ; qu'un compte en essai voit bien son bandeau sans
    en-tête ; que « Plus » affiche « Support (équipe) » pour un membre de
    l'équipe et rien pour un laveur ; le compteur sur un vrai fil non lu.

- [x] **« Messages automatiques » en v2**, 2026-09-24 (hors plan de vol : demande
      d'Alexandre après la passe 8). Écrite par un agent `refonte` neuf, relue et
      commitée par l'orchestrateur. Planches `ARelancer.dc.html` (la page) et
      `Automatisme.dc.html` (le réglage). Destination neuve : troisième cas de
      `refonte.md` (comme Chiffres).
  - **Fichiers** : route `/dashboard/parametres/messages` (sous `parametres` pour
    que « Plus » reste allumé dans la barre du bas), `MessagesAutomatiques.tsx`
    (garde-fou : le site est renvoyé vers `/dashboard/parametres/tout#avis`),
    `MessagesAutomatiquesV2.tsx` (la page), `ReglageAutomatismeV2.tsx` (les deux
    feuilles de réglage), `lib/messagesAutomatiques.ts` (tout le calcul, 50 tests),
    `lib/enregistrerReglages.ts` (l'appel `PATCH /api/washer`, 6 tests). La ligne
    « Messages automatiques » de `ParametresFormV2.tsx` pointe vers la nouvelle
    route et compte ce qui part VRAIMENT (un avis « activé » sans lien Google, ou
    une relance sans message, ne part pas : le cron les traite sans rien envoyer).
    `ParametresFormV1.tsx` et les crons : intacts.
  - **Ce que la donnée permet, élément par élément** : (a) interrupteurs et résumés
    (délai, canal) : réels. (b) « Programmé » : calculable avec la règle exacte des
    crons — avis = `review_request_at` non nul et `review_request_sent_at` nul ;
    relance = dernier rendez-vous non annulé du client (regroupé par `client_email`
    à l'identique, comme le cron), confirmé/terminé, non marqué, + délai. (c)
    « Parti » : SMS d'avis = lu (`review_sms_sent_at`) ; email d'avis et relance =
    DÉDUITS (aucun accusé n'est enregistré : `review_request_sent_at` est posé aussi
    sur les demandes écartées ou en échec, `followup_sent_at` aussi sur les
    rendez-vous clos sans envoi). L'écran le dit. Résultats : « a réservé depuis »
    (rendez-vous pris après la relance) oui ; « 5 étoiles reçues » et « pas de
    réponse » non — rien ne relie une demande d'avis à l'avis reçu, ni ne
    enregistre les réponses.
  - **Coupé, faute de donnée** : le lien « passer » (aucun moyen d'annuler l'envoi
    d'un message précis) ; la section « clients écartés et pourquoi » (aucune trace
    d'opposition à être contacté : « ne souhaite plus être contacté » est
    inconstructible — **à soumettre à `legal` : aucune relance ne propose de STOP**) ;
    le canal WhatsApp ; les variables `{{prénom}}`, `{{lien}}`, `{{prestation}}`,
    `{{véhicule}}` (le cron ne remplace que `{{nom}}`) ; l'heure exacte d'une
    relance (le code ne connaît pas l'heure du cron, réglée dans cron-job.org : on
    annonce un jour, « dès jeudi »).
  - **À signaler, non corrigé** : le canal est UN SEUL réglage (`review_channel`)
    pour l'avis ET la relance — les deux feuilles le disent. Le message d'avis est
    codé en dur dans le cron : montré en lecture seule. Le cron de relance ne
    contrôle pas le plan (un compte repassé en Essentiel avec relances actives
    continue d'envoyer). Le planificateur externe de `send-followups` n'est
    documenté nulle part dans le dépôt (seul `send-reviews`, toutes les heures) :
    à vérifier dans cron-job.org, sinon « Programmé » annonce des envois qui ne
    partent jamais. Le premier passage après activation d'une relance sur un
    vieux fichier clients peut viser des centaines de clients d'un coup : l'écran
    montre « au prochain envoi » et le compte avant que ça parte.
  - **Vérifié** : `tsc` 0 ; `eslint` 0 erreur (1 avertissement `set-state-in-effect`
    sur le garde-fou, même motif que `Chiffres.tsx`) ; `vitest run --coverage`
    95 fichiers / 1 237 tests verts ; `next build` propre. Captures Playwright PWA
    390×844 clair et sombre : compte de test réel (vide), banc d'essai jetable
    (plein, vide, avis sans lien / relance sans message, Essentiel, lecture
    incomplète, interrupteur en échec réseau, feuilles de réglage, aperçu recalculé
    au changement de délai). Site : `/dashboard/parametres/messages` renvoie bien
    vers `/dashboard/parametres/tout#avis`. Toutes les écritures ont été
    interceptées (`page.route`) : aucun `PATCH` n'a atteint le compte.
  - **Non vérifié** : appareil réel ; les listes « Programmé/Parti » sur des
    données réelles non vides (le compte de test n'avait rien à montrer) ; le
    contraste de l'ambre et du rouge en sombre (jetons hérités du clair).

- [x] **« Prestations et prix » en v2**, 2026-09-24 (hors plan de vol : la maquette
      n'a aucun écran pour gérer les prestations ; demande d'Alexandre « même design,
      mêmes fonctionnalités qu'avant »). Destination neuve, troisième cas de
      `refonte.md`. Conception validée par `designer`, état vide proposé par `ideas`.
  - **Fichiers** : route `/dashboard/parametres/prestations` (le site est renvoyé vers
    `/dashboard/admin#prestations` par `Prestations.tsx`), `PrestationsV2.tsx` (liste,
    une carte par catégorie, confirmations de suppression), `FeuillePrestationV2.tsx`,
    `FeuilleCategorieV2.tsx`, `PrestationsEtatVideV2.tsx` (retirable, voir ci-dessous),
    `PrestationsUiV2.tsx`, `hooks/usePrestationsV2.ts`, `lib/prestationForm.ts` (règles
    de saisie, 59 tests) et `lib/prestationsApi.ts` (appels, 16 tests). Lien « Prestations
    et prix » de `ParametresFormV2` et « La plus demandée » d'`AccueilV2` repointés.
  - **Le site n'a pas bougé** : `PrestationsManager`, `CategoriesManager` (hors un mot,
    `export` devant `PRESETS`) et `AdminTabs` sont intacts. Règles **dupliquées** dans
    `lib/prestationForm.ts` (correspondance écrite en tête du fichier) : `changeCategory`,
    `toggleVehicle`, le prix par type, `payload()`, la fusion locale de `update()`,
    `startAdd`/`startEdit`, l'avertissement de durée, `applyPreset`. À rapprocher du v1
    (extraction faisable, diff court) quand la cliente aura validé le v2.
  - **Route `DELETE /api/services/[id]`** : une prestation déjà réservée ne se supprime
    pas (`bookings.service_id` sans `ON DELETE`, code 23503) ; la route répondait 500
    « erreur interne ». Elle répond désormais 409 avec une phrase claire (additif,
    testé). **Le site n'en dit toujours rien** (`if (res.ok)` muet) : à reprendre côté v1.
  - **Trou produit à trancher** : une prestation réservée ne peut ni être supprimée ni
    être rendue invisible (une prestation sans type est refusée, écran et serveur). Il
    manque un « archiver » (colonne `services.active` ou `archived_at`, filtrée par la
    page publique) — demandé nulle part, non construit.
  - **Types orphelins** : retirer un type d'une catégorie, ou supprimer la catégorie,
    laisse l'id dans `services.vehicle_types` ; le tunnel client l'affiche sous son id
    brut (un UUID pour un type personnalisé). Non corrigé côté données ; l'écran v2 le
    signale (avant d'enregistrer la catégorie, dans la confirmation de suppression) et
    propose « Retirer » dans la prestation concernée.
  - **Non vérifié** : appareil réel, clavier ouvert (feuille + pied fixe), 360 px de large
    (titre + « + Prestation » serrés à 390).

- [x] **« Horaires » en v2**, 2026-09-24 (même demande d'Alexandre que « Prestations et prix » :
      « même design, mêmes fonctionnalités qu'avant »). Destination neuve, troisième cas de
      `refonte.md`. Conception validée par `designer` et `ideas`.
  - **Fichiers** : route `/dashboard/parametres/horaires` (le site est renvoyé vers
    `/dashboard/admin#disponibilites` par `Horaires.tsx`), `HorairesV2.tsx` (une carte, sept
    lignes lundi → dimanche, section Congés), `FeuillePlageV2.tsx` (ajout), `FeuilleJourV2.tsx`
    (plages d'un jour, retrait), `HorairesEtatVideV2.tsx` (retirable), `hooks/useHorairesV2.ts`,
    `lib/horaires.ts` (résumé, chevauchement, échec partiel, verrou `unSeulALaFois`) et
    `lib/horairesApi.ts`. Congés : `useConges`, `CongesAVenir`, `FeuilleAjoutConge`,
    `FeuilleSuppressionConge` réutilisés tels quels. Ligne « Horaires » de Plus repointée, avec le
    résumé (« Lun–Ven 8h–18h ») en valeur.
  - **Le site n'a pas bougé** : `DisponibilitesManager`, `AdminTabs` et les routes
    `/api/availabilities` sont intacts. Seule modif côté page partagée : `parametres/page.tsx` lit
    maintenant les plages (3 colonnes) au lieu de les compter (`head`) — même barre d'avancement.
  - **Durcissements et ajouts hors « mêmes fonctionnalités »** : jours à choix multiple (un POST par
    jour, échec partiel dit jour par jour, jours en échec restent cochés) ; chevauchement de deux
    plages refusé avant l'envoi (ni la route ni la base ne l'interdisent ; `StepSlot` proposerait
    l'horaire en double) ; état vide « Quand travaillez-vous ? » à un tap (fichier isolé) ; phrase de
    résumé ; « Fermé » à la place d'« Indisponible » ; la liste « Passées » des congés disparaît
    (la liste v2 ne montre que l'à venir).
  - **Plages qui se touchent** (8–12 puis 12–14) : confirmé, une prestation ne peut plus enjamber
    midi (`generateSlots` découpe chaque plage séparément, `creneauDansOuverture` aussi côté
    serveur). Message informatif dans la feuille d'ajout, aucune fusion automatique.
  - **`useConges` (partagé avec le site), trous constatés, non corrigés** : `saveUnavail` n'affiche
    rien si le serveur refuse (seule la feuille v2 grise maintenant « Bloquer » quand fin < début) et
    reste bloqué sur « Enregistrement… » si la réponse n'est pas du JSON ; `deleteUnavail` retire le
    congé de la liste même si le DELETE a échoué (écriture optimiste : le créneau reste bloqué en
    base). À corriger dans le hook, de façon additive.
  - **Non vérifié** : appareil réel (iOS : liste native des heures, date), clavier ouvert, 360 px.

- [x] **« Apparence de ma page » en v2**, 2026-09-24 (même demande d'Alexandre : « même design,
      mêmes fonctionnalités qu'avant »). Destination neuve, troisième cas de `refonte.md`.
      Périmètre décidé par lui : les CINQ premières cartes de `IdentiteForm` seulement (Logo,
      Couleur, Fond, Message d'accueil, Présence en ligne = le site web) — voir le bloc « À NE
      PAS OUBLIER » plus bas pour les trois autres. Conception validée par `designer` et `ideas`.
  - **Fichiers** : route `/dashboard/parametres/apparence` (le site est renvoyé vers
    `/dashboard/admin#identite` par `Apparence.tsx`), `ApparenceV2.tsx` (aperçu en héros, « Voir
    ma page », carte de cinq lignes), `ApercuPageV2.tsx`, cinq feuilles `FeuilleLogoV2`,
    `FeuilleCouleurV2`, `FeuilleFondV2`, `FeuilleMessageV2`, `FeuilleSiteV2`,
    `ApparenceUiV2.tsx`, `hooks/useApparenceV2.ts` (état des envois d'image : il vit dans
    l'écran, fermer une feuille n'annule rien), `hooks/retirerLeFond.ts` (détourage imgly isolé),
    `lib/apparence.ts` et `lib/apparenceApi.ts` (testés). La page serveur n'envoie au navigateur
    que les colonnes utiles (jamais `*`). Ligne « Apparence de ma page » de Plus repointée
    (pastille gardée) ; deux lignes **PROVISOIRES** ajoutées dans Plus (« Créneaux intelligents »
    → `/dashboard/admin#creneaux`, « Google Agenda » → `#agenda`), à supprimer avec le bloc
    « À NE PAS OUBLIER ».
  - **Le site n'a pas bougé, à un remplacement d'import près** : `IdentiteForm.tsx` n'a changé
    que par `PALETTE` (24 couleurs), déplacée dans `lib/themes.ts` et réimportée (test : les 24
    valeurs et leur ordre) ; `themes.ts` exporte aussi `OVERLAY` (voile 52 %, valeur inchangée).
    Aucune route API modifiée. `prestationsApi.ts` a gagné (additif) l'action « envoyer » et
    `echecDepuisReponse`, extraite d'`appeler` pour les envois d'image.
  - **Ajouts hors « mêmes fonctionnalités »** (chacun retirable) : « Retirer le logo » (le v1 n'a
    aucun moyen d'en retirer un ; API `logo_url: null`) et confirmation avant de retirer la
    photo de fond ; avertissement de contraste du blanc sous 4,5:1 (`contrasteBlanc`, 8 couleurs
    sur 24, jamais bloquant) ; site web validé et normalisé à la saisie (`https://` ajouté, autre
    schéma refusé — le v1 acceptait « monsite.fr » puis l'ignorait sans un mot) ; compteur
    indicatif du message à 120 caractères ; annulation avec message quand le choix d'un fond
    ou d'une couleur échoue (le v1 échouait sans rien dire) ; « max 5 Mo » du v1 (faux) remplacé.
  - **Constats sur la page publique** : le logo y est en `object-cover` 48 px (un logo large est
    rogné ; l'ancien aperçu le montrait entier) ; le message d'accueil n'est ni tronqué ni
    limité (une ligne d'en-tête + description des aperçus de lien) ; un fond retire bien le
    bouton clair/sombre ; les avis du site sont lus une fois par jour (`revalidate: 86400`) et
    **une redirection les fait disparaître** (`redirect: 'error'`) : la feuille le dit.
  - **Même adresse de fichier à chaque envoi** (`<user_id>.<ext>`, `upsert`) : un logo ou un fond
    remplacé garde son URL. Les fichiers observés répondent `Cache-Control: no-cache` + ETag
    (le navigateur revalide) mais les aperçus de lien (og:image) et tout cache tiers clé sur
    l'URL peuvent garder l'ancien. L'écran ajoute `?t=` en local seulement. Non corrigé côté
    serveur ; à rapporter à `dev`.
  - **Non vérifié** : appareil réel (sélecteur de fichier iOS/Android, HEIC, clavier ouvert
    devant le pied fixe, 360 px), le vrai détourage (modèle imgly non téléchargé pendant les
    tests, remplacé par un stub — voir le compte rendu), le rendu au soleil des anneaux.

- [x] **Zone d'intervention et Créneaux intelligents dans « Prestations et prix »**,
      2026-09-25 (demande d'Alexandre : les deux réglages rejoignent l'écran v2, **avec un
      design revu**, pas un simple déplacement). Conception validée par `designer` et `ideas`.
  - **Où** : deux sections sous « + Ajouter une catégorie », titre en phrase gris, sans
    compteur — « Où vous intervenez » (`#zone`) et « Créneaux intelligents » (`#creneaux`),
    chacune une carte d'**une seule ligne à deux niveaux** qui ouvre une feuille. Aucun
    réglage sur la page elle-même. Elles sont dans le même écran que les prix parce qu'elles
    répondent à la même question que lui : ce que le client final voit et peut réserver.
  - **Fichiers neufs** : `FeuilleZoneV2.tsx`, `FeuilleCreneauxV2.tsx`, `AdresseV2.tsx`
    (autocomplétion en ligne, style v2), `lib/zoneForm.ts`, `lib/creneauxForm.ts`,
    `lib/zoneApi.ts` — les trois `lib` testés (100 % lignes/branches). Modifiés :
    `PrestationsV2.tsx` (sections + feuilles + un seul `PATCH` par feuille), `Prestations.tsx`
    (le garde-fou du site renvoie aussi `#zone`/`#creneaux` vers l'ancien écran),
    `parametres/prestations/page.tsx` (colonnes ÉNUMÉRÉES, + `zone_config`, `smart_slot_*`,
    `base_address`), `ParametresFormV2.tsx` (deux lignes retirées, sous-libellé
    « Zone, créneaux »), `AccueilV2.tsx` (lien de zone repointé, v2 seulement).
    `Interrupteur` et la ligne à deux niveaux sont remontés dans `PrestationsUiV2.tsx`,
    `Puces` est exporté de `ReglageAutomatismeV2.tsx` — mêmes composants, mêmes
    comportements, juste partagés.
  - **Le site n'a pas bougé** : aucune route API touchée, `IdentiteForm.tsx`, `AdminTabs.tsx`,
    `ParametresFormV1.tsx`, `setupProgress.ts` et `ZoneWidget` sont intacts. Les liens du site
    continuent donc d'atterrir sur `/dashboard/admin` — c'est voulu.
  - **Design revu, pas déplacé** : des mots de laveur (« En ligne droite », « Selon les
    routes ») à la place de « vol d'oiseau » / « distance routière » ; **plus de curseurs**
    (10 · 20 · 30 · 50 · 100 km + « Autre » ; 5 · 10 · 15 · 20 · 30 min + « Autre ») — un
    curseur ne se vise pas les mains mouillées ; la liste des 101 départements ne s'ouvre
    plus par défaut (pastilles retirables + recherche + `Repliable`).
  - **Durcissements** (ni le v1 ni la route ne les font) : recherche de département
    insensible aux accents et à la casse (le v1 ne trouvait pas « herault ») ; une zone
    « départements » **vide est refusée** (le v1 laissait enregistrer une zone qui bloque
    tous les clients) ; remise en pourcentage plafonnée à 50 %, remise en euros plafonnée au
    prix de la prestation la moins chère, valeur vide ou négative refusée. **Ce ne sont pas
    des protections** : voir la faille ci-dessous.
  - **Ajouts hors « mêmes fonctionnalités »** (chacun retirable) : la puce « Utiliser mon
    adresse de départ » (`base_address`, les deux adresses restent DISTINCTES, rien n'est
    fusionné) ; l'avertissement ambre « Choisissez une suggestion » quand l'adresse est tapée
    à la main (non bloquant : `verdictZone` laisse passer quand Google ne reconnaît pas
    l'adresse) ; la phrase vivante « Jusqu'à 20 km en ligne droite autour de … » ;
    l'exemple chiffré des créneaux (calculé par `smartPrice`, aucune route ajoutée) ; les
    deux points d'alerte des configurations cassées (voir juste en dessous).
  - **Ce que « proche » veut dire**, relu dans `api/slots/smart/route.ts` et écrit tel quel
    dans la feuille : un rendez-vous **du même jour** (hors annulés), un temps de voiture
    (Distance Matrix) de ce rendez-vous vers le client **≤ `smart_slot_radius_minutes`**, et
    un créneau qui tombe entre **90 min avant le début** et **90 min après la fin** du
    rendez-vous (`WINDOW_MIN = 90`, **codé en dur**, ni réglable ni stocké ; la fin tient
    compte de la durée × nombre de véhicules). Sans clé Google, sans rendez-vous ce jour-là
    ou si Distance Matrix échoue : aucun créneau optimisé, la réservation passe quand même.
  - **Deux configurations cassées, signalées et non corrigées en base** : une zone par rayon
    sans adresse de centre (point **ambre** « Adresse manquante : la limite n'est pas
    appliquée » — le géocodage ne rend rien et `verdictZone` laisse passer) ; une zone
    « départements » vide (point **rouge** « Aucun département : personne ne peut réserver »).
    L'écran les dit ; il n'écrit rien de lui-même.
  - **Trous préexistants constatés, non corrigés** : `/api/places/autocomplete` répond
    `{ suggestions: [] }` aussi bien pour « rien trouvé » que pour « Google en panne »
    (`fetchGoogleMaps` rend `null`, la route l'aplatit) — depuis le navigateur, une clé
    expirée se lit « Aucune adresse trouvée » ; le message « hors zone » du tunnel de
    réservation (`StepSlot`, « Adresse hors zone d'intervention ») est **sec** alors que
    `/api/zone/check` renvoie déjà `distance_km` et `radius_km` : il pourrait dire « à 34 km,
    votre zone s'arrête à 20 km » ; `PATCH /api/washer` n'écrête pas `zone_config` (un rayon
    à 100 000 km passe) et ne valide pas `smart_slot_discount_type`.
  - **Non vérifié** : appareil réel (clavier ouvert devant le pied fixe, sélection d'une
    suggestion au doigt), la vraie autocomplétion Google (toutes les réponses `places` ont été
    simulées, aucun appel réel), le comportement d'un compte **sans aucune prestation**
    (l'exemple retombe sur « un lavage à 80 € », non capturé sur un vrai compte vide).
  - ⚠️ **Faille connue, traitée à part par `dev` + `cyber` — pas par cette passe** :
    `POST /api/bookings` accepte `is_smart_slot` et `smart_discount` tels que le client les
    envoie (`z.number().min(0)` seulement, `bookings/route.ts` ~l. 37-38 et 398-399) : un
    visiteur peut réclamer une remise énorme et obtenir un prix à 0 €, répercuté dans l'email,
    le PDF, la facture et la compta. `PATCH /api/washer` ne plafonne pas non plus une remise en
    pourcentage à 100 %. Les garde-fous de la feuille (≤ 50 %, ≤ prix le plus bas) sont **de
    l'interface**, ils ne ferment rien.

- [ ] **À NE PAS OUBLIER — trois réglages à replacer ailleurs dans la PWA** (décision
      d'Alexandre, 2026-09-24). L'écran v2 « Apparence de ma page » ne reprend que
      Logo, Couleur de la marque, Fond, Message d'accueil et Présence en ligne. Ces
      trois cartes de l'ancien onglet Identité (`admin/IdentiteForm.tsx`) n'y sont
      **volontairement pas** : elles doivent trouver **leur propre place** dans la
      refonte, à décider avec lui. **Deux sur trois sont placées.**
  - [x] **Zone d'intervention** (`#zone`) — **placée le 2026-09-25** dans l'écran
    « Prestations et prix » (`/dashboard/parametres/prestations#zone`), section
    « Où vous intervenez ». La ligne « Zone et déplacement » a disparu de Plus.
  - [x] **Créneaux intelligents** (`#creneaux`) — **placés le 2026-09-25** dans le même
    écran (`/dashboard/parametres/prestations#creneaux`), section « Créneaux
    intelligents ». La ligne provisoire de Plus a disparu.
  - [x] **Google Agenda** (`#agenda`) — **placé dans l'Agenda**, 2026-09-25 (demande
    d'Alexandre) : ligne « Google Agenda » en bas de l'écran + feuille
    (`FeuilleGoogleAgendaV2.tsx`). La connexion part de `/api/auth/google-calendar?retour=agenda`
    et revient sur `/dashboard/calendrier?google=…` (voir `lib/googleAgendaRetour.ts`, le choix
    voyage dans le `state` OAuth). La ligne provisoire de Plus a disparu. Le site garde son
    retour sur `/dashboard/admin`, inchangé.
  - [ ] **Google Agenda — fiabiliser la connexion depuis la PWA iPhone (à faire plus tard,
    décision d'Alexandre 2026-09-25).** Deux constats du test sur la version d'essai :
    1. *Limite de l'environnement d'essai* : `GOOGLE_REDIRECT_URI` pointe vers
       `washboard.fr` (production), donc Google ramène sur le vrai site, qui n'a pas le
       retour vers l'Agenda ; le cookie `wb_gcal_state` posé sur l'adresse d'essai n'y est
       pas non plus. Pour tester avant la mise en ligne : ajouter l'adresse de retour de
       l'essai dans la console Google Cloud + régler `GOOGLE_REDIRECT_URI` (et
       `NEXT_PUBLIC_APP_URL`) sur l'environnement Preview de Vercel.
    2. *Risque réel en production, à vérifier sur iPhone* : depuis la PWA installée, iOS
       ouvre Google dans une fenêtre séparée qui ne partage pas les cookies de la PWA ;
       le contrôle du `state` (cookie httpOnly) peut alors échouer. Remède envisagé :
       `state` **signé côté serveur** (HMAC : identifiant du laveur + jeton + expiration
       courte, idéalement à usage unique), écriture du jeton sans dépendre de la session
       de la fenêtre, et page de fin « Connecté, vous pouvez revenir à WashBoard » ;
       l'Agenda rafraîchit l'état au retour au premier plan. Route sensible : `dev` +
       `cyber` (l'audit du 2026-09-05 a fixé le `state` aléatoire lié au cookie).
    3. Deux défauts préexistants du retour, au passage : `exchangeCode` non capturé (une
       erreur de code donne une page 500 au lieu d'un retour à l'Agenda) et cookie
       `wb_gcal_state` supprimé seulement en cas de succès.
  - [ ] **Export Excel des réservations — plus d'entrée dans la PWA** (2026-09-25). La ligne
    « Export et liens par réseau » de Plus est devenue « Mes liens »
    (`/dashboard/parametres/liens`, liens seulement, à la demande d'Alexandre). L'export
    (`CrmDashboard.tsx`, `handleExport`, exceljs) n'existe plus que sur le site
    (`/dashboard/crm`). À replacer en v2 si Alexandre le veut (extraire `handleExport` dans
    un module partagé sans changer le fichier Excel produit).
  - [ ] **Frais de déplacement à replacer avec la zone (passe suivante)** — ils vivent
    dans `ParametresFormV1.tsx` (~l. 294-370, « Mon profil », atteint depuis Plus par la
    ligne « Équipe ») et n'ont **aucun écran v2**. `designer` recommande qu'ils voisinent
    avec la zone : même question (« jusqu'où je vais, et à quel prix »), même endroit.
    Non construits le 2026-09-25, exprès — hors périmètre de la passe.
  - **Accès en attendant** : les trois cartes restent sur l'ancien écran
    `/dashboard/admin` (onglet Identité), toujours joignable — c'est là qu'atterrissent
    les liens du **site** (`setupProgress.ts`, `ZoneWidget`, non modifiés) et le garde-fou
    PWA de `Prestations.tsx`, qui renvoie `#zone` et `#creneaux` vers `admin#zone` et
    `admin#creneaux`. Rien n'est perdu, mais ce n'est pas le design final.

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

- **Un vrai CRM de suivi client** — Yanis (l'associé d'Alexandre) a proposé cinq écrans dans un
  canevas partagé le 2026-09-28 : Prospects (avant la première réservation), À relancer, Fiche
  client (timeline), Fiche entreprise (plusieurs sites/contacts, délai de paiement), et un menu
  d'options (tâche, fusion de doublons, « ne plus contacter », export/anonymisation RGPD).
  Discuté avec Alexandre le même jour : le vrai obstacle n'est pas l'écran, c'est qu'aujourd'hui
  un « client » n'est qu'un CALCUL (`lib/clientProfile.ts`, tiré des réservations et documents à
  la volée) — rien ne peut s'y écrire. Presque tout ce que Yanis propose suppose une fiche
  qu'on peut relire ET réécrire.
  - [x] 2026-09-28 — **Premier morceau, tranché par Alexandre : le socle + « à relancer » +
        « ne plus contacter »** plutôt que les prospects ou tout d'un coup. Table `clients`
        (SQL ci-dessus, section « à faire par Alexandre »), overlay facultatif sur
        `buildClientProfile`/`listeClients` (même principe que les documents). Onglet
        **« À relancer »** dans Clients (`lib/clientsARelancer.ts`) : réutilise TEL QUEL le calcul
        du cron (`lib/messagesAutomatiques.ts`, `relanceActive`/`momentRelance`) plutôt que de le
        refaire à côté — seul ajout, l'exclusion des clients opposés. **« Ne plus contacter »**
        dans la Fiche client (`ClientProfileModalV2.tsx`), câblé dans les DEUX crons
        (`send-followups`, `send-reviews`) : c'est le premier moyen, pour un laveur, d'exclure UN
        client précis des messages automatiques (avant, seul un interrupteur global existait).
        Écart connu et documenté en tête de `api/cron/send-followups/route.ts` et de
        `MessagesAutomatiquesV2.tsx` : `followup_sent_at` ne distingue pas « relance envoyée » de
        « client opposé, rendez-vous clos sans envoi » — l'écran Messages automatiques peut donc
        afficher un libellé trompeur pendant sa fenêtre de 7 jours, mais **aucun message n'est
        réellement envoyé** dans les deux cas.
  - [x] 2026-09-28 — **La fiche client se rapproche du canevas** (`333b91d`) : « son rythme »
        (écart moyen entre deux visites) remplace le panier moyen tant qu'il y a assez
        d'historique, timeline mélangée prestations/avis/relances (`lib/clientTimeline.ts`,
        relance reproduite exactement, avis déduit — pas de note ni d'étoile inventée, WashBoard
        n'a aucune API qui lirait un vrai avis Google), et menu « … » dans l'en-tête (une seule
        entrée pour l'instant, « ne plus contacter »).
  - [ ] **Récupérer le vrai contenu d'un avis Google, quand ce sera possible.** Aujourd'hui
        WashBoard n'est relié à AUCUNE API Google qui lirait un avis réel : `review_request_sent_at`
        prouve seulement qu'une DEMANDE est partie, jamais ce que le client a écrit ni sa note.
        C'est pour ça que la timeline de la fiche (`lib/clientTimeline.ts`) affiche « Demande
        d'avis envoyée » et rien de plus, alors que le canevas de Yanis montre « Avis Google 5
        étoiles · "Voiture nickel, ponctuel" ». Pour combler l'écart il faudrait la **Google
        Business Profile API** (lecture des avis de la fiche d'établissement du laveur) : chaque
        laveur devrait connecter SON compte Google Business (comme pour l'Agenda), et il faudrait
        relier un avis reçu à LA bonne demande envoyée — pas garanti (Google ne renvoie ni
        l'identité de l'auteur ni de référence vers la demande), donc un rapprochement par date +
        éventuellement le nom laissé sur l'avis, avec un vrai risque de faux positifs sur un
        laveur qui reçoit plusieurs avis le même jour. Pas commencé, pas scoping précis : à
        reprendre depuis zéro le jour où ça devient prioritaire.
  - [ ] **Bouton « + Rendez-vous » de la fiche client** : chantier à part, pas un ajout rapide.
        Suppose de brancher l'écran Clients sur le formulaire de rendez-vous manuel de l'Agenda
        (`RendezVousManuelV2.tsx`, `useRendezVousManuel.ts`), qui charge ses propres données
        (services, capacité d'équipe restante, avertissement de faisabilité du trajet) —
        aujourd'hui seulement disponibles sur l'écran Calendrier. `ManualBooking` a déjà tous les
        champs d'identité (`client_name`, `client_email`, `client_phone`, `address`,
        `is_professional`, `company_name`) : pré-remplir depuis une fiche est possible une fois
        le formulaire atteignable depuis Clients — reste à décider comment (navigation vers
        `/dashboard/calendrier` avec le client en paramètre, ou dupliquer une version plus légère
        du formulaire pour Clients).
  - [ ] **Relancer les devis sans réponse** — pas seulement les clients silencieux. Un devis
        `envoyé` sans réponse (`repondu_le` toujours nul) depuis N jours, c'est de l'argent qui
        dort ; la fiche entreprise du canevas le montre déjà (« Devis « 6 véhicules VO / mois »
        en retard de 2 jours » › Faire). Généralisable à toute la liste Documents, pas qu'aux
        pros. Coût de construction bas : la donnée existe déjà dans `documents`
        (`statut`, `repondu_le`, `emis_le`), même genre de calcul pur que `clientsARelancer.ts`.
  - [ ] **Prospects** : pas encore construit. Piste retenue en discussion — faire naître un
        prospect automatiquement quand un DEVIS est écrit pour quelqu'un qui n'a jamais réservé
        (`FeuilleDocumentV2.tsx`), plus une capture manuelle (« + Prospect » après un appel).
        Nécessite un vrai statut (prospect → client) et une date de conversion, que la table
        `clients` ne porte pas encore.
  - [x] 2026-09-28 — **Fiche entreprise construite** (jugée représentative par Alexandre —
        fréquent chez ses laveurs, pas un cas isolé de Yanis). Tables `entreprises`/`sites`
        (SQL ci-dessus) ; un « contact » d'entreprise EST un client (`clients.entreprise_id` +
        `role_entreprise`), pas une table à part. Agrégation (chiffre d'affaires, véhicules,
        derniers passages, devis en attente) calculée dans le navigateur à partir des mêmes
        réservations/documents que le reste de l'écran (`lib/entrepriseProfile.ts`), jamais
        d'une requête séparée — même principe que `buildClientProfile`. Nouvel écran
        `FicheEntrepriseV2.tsx`, atteint depuis le menu « … » d'un contact déjà lié, ou en
        rattachant un client existant à une entreprise (nouvelle ou existante) depuis ce même
        menu. Écarts assumés avec le canevas de Yanis, documentés en tête du fichier :
        - le chiffre d'affaires est TOUT L'HISTORIQUE (« au total »), pas « cette année » —
          aucun autre chiffre de la fiche client ne se borne à l'année en cours, introduire
          cette seule exception aurait été incohérent ;
        - l'alerte de devis dit seulement DEPUIS COMBIEN DE TEMPS il attend une réponse, jamais
          « en retard » — aucun seuil de retard n'est réglé nulle part (rejoint « Relancer les
          devis sans réponse » ci-dessus, pas encore construit) ;
        - un contact ne peut être qu'un client DÉJÀ connu (au moins une réservation ou un
          document) — créer quelqu'un qui n'a jamais rien pris reviendrait à résoudre les
          « prospects » en douce, pas encore fait.
  - [x] 2026-09-28 — **Bug relevé par Alexandre en testant, corrigé le jour même** : créer une
        entreprise puis s'y rattacher ne menait nulle part (l'écran essayait d'ouvrir la fiche
        avec l'ancienne liste d'entreprises, d'avant la création — `router.refresh()` manquant
        dans `FeuilleRattacherV2`, ClientProfileModalV2.tsx). Même occasion : **onglet
        « Entreprises »** ajouté à Clients (masqué tant qu'aucune n'existe) — avant, une
        entreprise ne se retrouvait qu'en rouvrant le contact qui avait servi à la créer, ce
        qu'Alexandre a buté dessus dans la foulée du bug ci-dessus.
  - [x] 2026-09-28 — **Guide mis à jour** avec la différence « pro » (case cochée par le client,
        par réservation) vs « entreprise » (rattachement fait à la main par le laveur) —
        `lib/guide.ts`, entrée `pro-vs-entreprise`.
  - [x] 2026-09-28 — **Supprimer une entreprise** : sans risque pour les réservations ni les
        factures — ses sites disparaissent avec elle (cascade), ses contacts redeviennent de
        simples clients (`entreprise_id` repasse à `null`). Depuis le menu « … » de sa fiche,
        ET en glissant sa ligne dans l'onglet « Entreprises » (même geste, ajouté le même jour
        — Alexandre a buté sur son absence juste après avoir testé le menu).
  - [x] 2026-09-28 — **« Supprimer » un client, en glissant sa ligne vers la gauche dans
        Clients** (demande d'Alexandre — geste natif, comme sur iPhone, même mécanique que les
        dépenses et l'Assistance : `useLigneGlissante`). En réalité un MASQUAGE
        (`clients.masque_le`), jamais une vraie suppression : un client n'est pas une ligne
        qu'on peut effacer, c'est un calcul tiré de ses réservations et de ses documents, et
        certains portent une facture dont la numérotation ne doit jamais avoir de trou, que la
        loi oblige à garder 10 ans. Il disparaît du fichier, rien d'autre ne bouge — ni ses
        réservations, ni ses documents, ni les chiffres passés. Retiré de l'écran tout de suite
        (optimiste), sans attendre le prochain chargement. Pas construit : « démasquer » un
        client (annuler la suppression) — aucun écran ne le propose aujourd'hui, seule la
        colonne existe pour ça plus tard si besoin.
  - [x] 2026-09-28 — **Même geste dans « À relancer », sens différent** (Alexandre : « il faut
        aussi pouvoir supprimer dans relance ce qui annule la relance de ce client »). Glisser
        une ligne là n'est PAS un masquage : c'est « ne plus contacter » (même réglage que le
        menu de la fiche). La ligne ne disparaît donc pas, elle passe en « Ne veut plus » — un
        client opposé reste volontairement visible dans cette liste (déjà le cas depuis la
        construction de l'onglet). Un seul mécanisme d'overlay local (`reglagesLocaux`,
        ClientsViewV2.tsx) porte maintenant les deux gestes (masquer, ne plus contacter), et
        s'applique partout où `reglages` comptait avant — la fiche ouverte juste après reflète
        déjà le changement, sans attendre `router.refresh()`.
  - [x] 2026-09-28 — **Bug relevé par Alexandre en testant : une facture comptait AVANT d'être
        payée.** `ClientDocument` (`lib/clientProfile.ts`) ne connaissait pas `paye_le` — une
        facture écrite à la main comptait dans le total d'un client dès sa création, payée ou
        non, contrairement à l'« Encaissé » de Chiffres qui n'a compté que le payé dès le
        départ. Un client dont la facture attendait encore son virement paraissait déjà avoir
        payé. Corrigé partout où `ClientDocument` circule : la fiche client (« au total »), la
        fiche entreprise (même calcul, sommé) et le fichier Clients. Au passage : la fiche
        client affiche maintenant « Encaissée »/« À encaisser » sur chaque facture, et la fiche
        entreprise gagne une alerte **factures impayées** (montant + depuis combien de temps),
        symétrique à celle des devis en attente.
  - [x] 2026-09-28 — **« + Devis » pré-rempli depuis la Fiche entreprise** (Alexandre : « il faut
        que ce soit pré rempli avec les informations de l'entreprise dans le devis »). Le lien
        transporte le nom de l'entreprise et les coordonnées du premier contact joignable en
        paramètres d'adresse (`?nouveau=1&entreprise=...&nom=...&tel=...&email=...&adresse=...`),
        lus par `DocumentsV2.tsx` — même mécanisme que `nouveau=1` lui-même. Ignoré si la feuille
        est rouverte par le « + » propre à cet écran : ce geste-là veut un formulaire vide.
  - [x] 2026-09-28 — **« délai de paiement » au lieu de « paiement »** sur la tuile-chiffre de la
        fiche entreprise (Alexandre : « ne met pas paiement mais delai de paiement pour qu'on
        comprenne du coup ») — le chiffre n'a pas changé, seul le mot au-dessus était ambigu.
  - [x] 2026-09-28 — **Alerte « factures impayées » cliquable** sur la fiche entreprise : tape
        dessus, ça ouvre la MÊME feuille d'actions que Documents et factures (télécharger,
        envoyer, marquer payée), plus un nouveau bouton **Appeler** (visible même sur une facture
        pro, pas réservé aux devis). `FeuilleActions` de `DocumentsV2.tsx` extraite en composant
        partagé `FeuilleActionsDocumentV2.tsx` pour ça — `ClientDocument` (forme minimale de la
        fiche) n'a pas de quoi construire le message WhatsApp, donc la fiche entreprise charge le
        `Document` complet à la demande (`lireDocuments()`, mis en cache) plutôt que de forcer
        `ClientDocument` à porter des champs qu'il n'a jamais eus.
  - [x] 2026-09-28 — **Véhicules et notes sur la fiche client** (Alexandre : « j'aimerais qu'on
        mette dans la fiche client de particulier / pro / entreprise les modeles de voitures
        comme ca on sait les voitures des gens »). Deux champs texte libre sur `clients`
        (`vehicules` neuf, `notes` déjà posé le 2026-09-28 mais jamais câblé) : SQL —
        ```sql
        alter table public.clients add column if not exists vehicules text;
        ```
        Modifiables depuis le menu « … » de la fiche (particulier/pro), « Modifier la fiche » ;
        affichés dans le corps de la fiche quand non vides. Côté entreprise, le véhicule de
        chaque contact apparaît sous son nom dans la liste Contacts — pas de note d'entreprise
        (une entreprise n'a pas de fiche propre, seulement ses contacts, voir plus haut).
        Optimiste comme le reste de l'écran (`router.refresh()` avant de refermer la feuille).
        **Corrigé le même jour, relevé par Alexandre** (« si justement on a dans le lien de
        réservation demandé le modèle au client ») : la réservation publique demande DÉJÀ le
        modèle au client (`StepService.tsx`, un champ texte libre par véhicule, stocké dans
        `bookings.vehicles_detail`) — le champ manuel ci-dessus, seul, obligeait à retaper une
        donnée déjà donnée par le client. `ClientProfile.vehiculesReserves` (nouveau,
        `clientProfile.ts`) reprend ces modèles depuis l'historique de réservations, du plus
        récent, sans doublon ; la fiche les affiche EN PREMIER, le champ manuel restant un
        complément (plaque, couleur) ou un secours pour un client sans réservation (né d'un
        devis). `COLONNES` de `clients/page.tsx` élargi à `vehicles_detail` pour ça.
        **Même jour, même logique étendue aux devis/factures écrits à la main** (Alexandre :
        « demandé le véhicule dans les devis du coup quand on les fait à la main ») : un devis
        n'a pas de réservation derrière, donc pas de `vehicles_detail` à reprendre — la feuille
        `FeuilleDocumentV2.tsx` demande maintenant le véhicule au même endroit que le reste du
        client (sous l'adresse), champ facultatif `clientVehicule` sur `SaisieDocument`, gardé
        dans `FactureContenu.client.vehicule` (`lib/facture.ts`, `lib/documents.ts`).
        `vehiculesReserves` mêle les deux sources par date (réservation ou document, la plus
        récente d'abord) plutôt que de les empiler sans ordre.
  - [x] 2026-09-28 — **Menu « Options » de la fiche refait** (canevas de Yanis, « Fiche >
        Options ») : passé d'une petite liste de mots à une vraie feuille (icône + titre +
        sous-titre par action), avec six actions. `lib/guide.ts`, entrée `menu-fiche-client`.
    - **Modifier la fiche étendue** : portait seulement notes/véhicules, porte maintenant aussi
      nom et téléphone (`ClientReglages.nom`/`.telephone`, `clientProfile.ts`) — une CORRECTION
      qui prime sur le calcul habituel (le plus récent d'une réservation ou d'un document),
      jamais une réécriture de l'historique.
    - **Ajouter une tâche** : pense-bête court, table `client_taches` (SQL ci-dessous),
      `/api/clients/[cle]/taches` (GET/POST), `/api/taches/[id]` (PATCH/DELETE). Chargée à
      l'ouverture de la fiche, pas dans `clients/page.tsx` — la plupart des fiches n'en ont
      aucune. Cochée = disparaît (pas d'historique des tâches faites, pas demandé).
    - **Fusionner un doublon** : repéré par `lib/doublons.ts` (même téléphone, sinon même nom
      sans accent ni casse — jamais l'email, c'est justement ce qui diffère entre deux fiches
      de la même personne). N'apparaît dans le menu QUE si un doublon est trouvé. La fusion
      elle-même (`/api/clients/fusionner`, fonction SQL `fusionner_clients` ci-dessous)
      réassigne réservations et documents de la fiche source vers la fiche cible (email/
      téléphone réécrits), combine leurs réglages (notes, véhicules, ne plus contacter — la
      cible garde les siens en priorité), puis supprime la ligne de réglages de la source.
      Irréversible.
    - **Exporter ses données (RGPD, article 15)** : libellé et mécanique revus par l'agent
      `legal` avant construction (voir le compte rendu de la conversation du 2026-09-28). Un
      fichier texte lisible directement, PAS un JSON brut (`lib/exportClient.ts`,
      `texteExportClient`), généré entièrement dans le navigateur depuis la fiche déjà
      chargée — aucune requête pour construire le fichier. `/api/clients/[cle]/rgpd` ne fait
      que journaliser l'action (table `client_rgpd_journal`, SQL ci-dessous), pour la
      responsabilité du laveur en cas de contrôle (article 5.2) — jamais le contenu exporté.
    - **Anonymiser la fiche (RGPD, article 17, exception comptable 17.3.b)** : remplace nom,
      email, téléphone et adresse par des valeurs anonymes sur TOUTES les réservations et TOUS
      les documents de ce client — jamais montants, dates ni numéros de facture (fonction SQL
      `anonymiser_client` ci-dessous, même mécanique que `fusionner_clients`). Confirmation
      avec case à cocher obligatoire (texte exact fourni par l'agent `legal`), bouton
      désactivé tant qu'elle n'est pas cochée. Irréversible, ferme la fiche après coup.
      **Limite connue, signalée par `legal`** : les champs libres (notes, véhicules) qui
      mentionneraient le nom du client en toutes lettres ne sont PAS balayés automatiquement —
      la confirmation le dit, mais rien ne le vérifie. Hors périmètre également : toute autre
      table qui porterait les coordonnées de ce client (funnel d'abandon de réservation, par
      exemple) — seules réservations et documents sont couverts.

      SQL à exécuter dans Supabase (idempotent, un seul passage) :
      ```sql
      alter table public.clients add column if not exists nom text;
      alter table public.clients add column if not exists telephone text;

      create table if not exists public.client_taches (
        id uuid primary key default gen_random_uuid(),
        washer_id uuid not null references public.washers(id) on delete cascade,
        cle text not null,
        texte text not null,
        faite_le timestamptz,
        created_at timestamptz not null default now()
      );
      create index if not exists client_taches_washer_cle_idx on public.client_taches(washer_id, cle);
      alter table public.client_taches enable row level security;
      drop policy if exists "client_taches_all" on public.client_taches;
      create policy "client_taches_all" on public.client_taches for all
        using (washer_id in (select id from public.washers where user_id = auth.uid()))
        with check (washer_id in (select id from public.washers where user_id = auth.uid()));
      grant select, insert, update, delete on public.client_taches to authenticated;
      grant all on public.client_taches to service_role;

      create table if not exists public.client_rgpd_journal (
        id uuid primary key default gen_random_uuid(),
        washer_id uuid not null references public.washers(id) on delete cascade,
        cle text not null,
        action text not null,
        utilisateur_id uuid,
        created_at timestamptz not null default now()
      );
      alter table public.client_rgpd_journal enable row level security;
      drop policy if exists "client_rgpd_journal_all" on public.client_rgpd_journal;
      create policy "client_rgpd_journal_all" on public.client_rgpd_journal for all
        using (washer_id in (select id from public.washers where user_id = auth.uid()))
        with check (washer_id in (select id from public.washers where user_id = auth.uid()));
      grant select, insert on public.client_rgpd_journal to authenticated;
      grant all on public.client_rgpd_journal to service_role;

      -- Fusionner un doublon : la fiche SOURCE disparaît, ses réservations et documents
      -- prennent l'email/téléphone de la fiche CIBLE. Sous un verrou (deux fusions du même
      -- laveur en même temps ne doivent pas se marcher dessus).
      create or replace function public.fusionner_clients(
        p_washer_id uuid, p_cle_source text, p_email_cible text, p_telephone_cible text
      ) returns void
      language plpgsql security definer set search_path = public as $$
      begin
        perform pg_advisory_xact_lock(hashtext(p_washer_id::text || ':clients'));

        update public.bookings
        set client_email = nullif(p_email_cible, ''),
            client_phone = coalesce(nullif(p_telephone_cible, ''), client_phone)
        where washer_id = p_washer_id
          and (
            lower(trim(client_email)) = p_cle_source
            or (
              (client_email is null or trim(client_email) = '')
              and ('tel:' || regexp_replace(client_phone, '\D', '', 'g')) = p_cle_source
            )
          );

        update public.documents
        set contenu = jsonb_set(
              jsonb_set(contenu, '{client,email}', to_jsonb(nullif(p_email_cible, ''))),
              '{client,telephone}', to_jsonb(nullif(p_telephone_cible, ''))
            )
        where washer_id = p_washer_id
          and (
            lower(trim(contenu->'client'->>'email')) = p_cle_source
            or (
              (contenu->'client'->>'email' is null or trim(contenu->'client'->>'email') = '')
              and ('tel:' || regexp_replace(contenu->'client'->>'telephone', '\D', '', 'g')) = p_cle_source
            )
          );

        delete from public.clients where washer_id = p_washer_id and cle = p_cle_source;
      end;
      $$;
      grant execute on function public.fusionner_clients(uuid, text, text, text) to authenticated;

      -- Anonymiser (droit à l'effacement, article 17) : remplace nom/email/téléphone/adresse
      -- partout, jamais montants ni numéros de facture. Même verrou que la fusion.
      create or replace function public.anonymiser_client(p_washer_id uuid, p_cle text) returns void
      language plpgsql security definer set search_path = public as $$
      begin
        perform pg_advisory_xact_lock(hashtext(p_washer_id::text || ':clients'));

        update public.bookings
        set client_name = 'Client anonymisé', client_email = null, client_phone = null, address = 'Adresse supprimée'
        where washer_id = p_washer_id
          and (
            lower(trim(client_email)) = p_cle
            or (
              (client_email is null or trim(client_email) = '')
              and ('tel:' || regexp_replace(client_phone, '\D', '', 'g')) = p_cle
            )
          );

        update public.documents
        set contenu = jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(contenu, '{client,nom}', to_jsonb('Client anonymisé'::text)),
                  '{client,email}', 'null'::jsonb
                ),
                '{client,telephone}', 'null'::jsonb
              ),
              '{client,adresseFacturation}', to_jsonb('Adresse supprimée'::text)
            )
        where washer_id = p_washer_id
          and (
            lower(trim(contenu->'client'->>'email')) = p_cle
            or (
              (contenu->'client'->>'email' is null or trim(contenu->'client'->>'email') = '')
              and ('tel:' || regexp_replace(contenu->'client'->>'telephone', '\D', '', 'g')) = p_cle
            )
          );

        delete from public.clients where washer_id = p_washer_id and cle = p_cle;
      end;
      $$;
      grant execute on function public.anonymiser_client(uuid, text) to authenticated;
      ```

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

## 🔍 Contenu & tarifs (SEO-GEO)

> Suite de la revue du 2026-10-01 (`seo-geo`, Opus) : blog + FAQ + pages pilier passés en revue
> suite au recentrage à 4 offres (Découverte/Starter/Pro/Business). Plusieurs vrais bugs de
> contenu trouvés et corrigés (prix de Business publié dans le JSON-LD alors qu'il est sur
> devis, avis Google par email présenté comme gratuit partout, badges Pro/Business faux sur la
> landing). Trois points restent ouverts, pas corrigés :

- [ ] **(priorité basse) Cron d'envoi d'avis (`api/cron/send-reviews`) : à vérifier qu'il
      revérifie bien `MIN_PLAN.avis_email` au moment de l'envoi**, pas seulement à l'activation.
      Soupçon soulevé par `seo-geo` en comparant le contenu au code, non vérifié en conditions
      réelles : un compte rétrogradé sous Pro qui avait activé les avis pourrait continuer à en
      envoyer. Rien d'urgent (pas de signalement client), à prendre quand `dev` a du temps.
      Agent : `dev`.
- [ ] **À décider : deux blocs de la landing ne précisent pas qu'ils sont réservés à la formule
      Pro.** L'encart « La facturation, sans outil en plus » et la section « Créneaux groupés »
      ne disent pas qu'il s'agit de fonctions Pro (contrairement à la grille « Et tout le reste »
      juste en dessous, qui elle affiche le badge). Pas une erreur factuelle, un choix éditorial
      — à trancher avec `growth` : le dire clairement partout, ou laisser ces deux blocs vendre
      la fonction sans mentionner le palier.
- [x] 2026-10-01 — **Page `/optimisation-tournee-lavage-auto` : le titre disait « Deux
      mécanismes » alors que la section en liste trois** (le 3e, les frais de déplacement au
      trajet réel, est un vrai différenciateur, pas un oubli à retirer). Corrigé en « Trois
      mécanismes, un seul calcul de trajet réel ».

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
