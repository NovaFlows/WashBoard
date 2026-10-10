# Contexte partagé — WashBoard

Dernière mise à jour : 2026-10-09.

## Continuité de travail
L'utilisateur développe ce projet depuis plusieurs mois et alterne entre Claude Code (deux comptes) et Codex selon les crédits disponibles. Il souhaite que les assistants entretiennent le contexte dans les fichiers du projet pour faciliter les reprises.

## Repères vérifiés
- `washboard/` contient l'application et son `package.json`.
- Le `CLAUDE.md` racine décrit WashBoard comme un SaaS B2B pour laveurs auto mobiles, avec Next.js, Supabase, Vercel, Google Maps, Resend et Stripe. Ce sont des indications documentaires ; la configuration actuelle n'a pas encore été auditée.
- `regle_du_jeu.md` contient les règles produit, architecture et développement.
- `washboard/CLAUDE.md` importe `washboard/AGENTS.md`, qui contient les consignes Next.js générées.
- `washboard-design/` et `peekly-design/` ont leur propre `CLAUDE.md` ; `.claude/agents/` contient des descriptions de rôles.
- `washboard/TODO.md` porte les priorités et l'historique des correctifs de sécurité.

## Dernier travail — sécurité `bookings` et PDF (Ryan, 2026-10-04)
- Policy RLS de `bookings` : exécutée en prod (`revoke all ... from anon, authenticated`), vérifiée en conditions réelles (requête directe anon → `42501`, dashboard toujours fonctionnel). Voir commit `5f60919` et `TODO.md`.
- `fusionner_clients`/`anonymiser_client` : garde-fou de propriété ajouté + `revoke` du droit d'exécution par défaut, exécuté en prod, vérifié avec deux comptes jetables (tentative inter-laveurs → refusée, usage légitime → intact).
- Jeton d'accès séparé pour `GET /api/bookings/[id]/pdf` (entrée TODO.md « 🔒 Jeton d'accès séparé »), étapes 1 à 8 faites : `src/lib/bookingToken.ts` (HMAC-SHA256 base64url, comparaison `timingSafeEqual`), garde dans la route PDF, jeton dans la réponse du POST et dans les emails de confirmation et de facture. `tsc`, `eslint` et `vitest run --coverage` (2375 tests) verts. Vérification manuelle (étape 8) faite avec un compte jetable créé puis supprimé (jamais sur un compte réel) : jeton correct → 200, id seul ou jeton d'une autre réservation → 404, réservation dans le quota sans jeton → 200 (liens déjà envoyés), facture déjà émise → sert sans bloquer. Committé localement ; fusionné avec la refonte de la réservation (`BookingForm.tsx`/`StepConfirmation.tsx` réécrits en parallèle, voir plus bas) — le jeton a été re-filé à la main dans la nouvelle structure, à revérifier après fusion.

## Comptes réels — ne jamais utiliser pour un test
- `kookii-clean` (double i) : vraie cliente.
- `autonettoyage` (« AutoNett ») : compte de l'équipe, pas un bac à sable.
- `kookiclean-1f09` : le compte de test de Ryan (« ADMIN RYAN ») — celui-ci peut servir pour une vérification manuelle, mais un compte jetable créé par service-role puis supprimé reste la méthode par défaut cette semaine.

## À faire avant de pousser
- Ajouter `BOOKING_LINK_SECRET` sur Vercel (production + preview). Présente en local dans `washboard/.env.local`, documentée dans `.env.example`.

## Travail actuel — refonte bureau (branche de Yanis `refonte/maquette-bureau`, reprise le 2026-10-09)
- Worktree : `../WashBoard-bureau` (le dossier principal est utilisé par une autre session). `washboard/node_modules` = jonction vers celui du dossier principal ; lancer avec `NEXT_PUBLIC_DEV_BUREAU=1 npx next dev --webpack -p 3018`, puis `/demo` (données fictives, aucune base).
- Maquette de référence : `washboard-design/maquettes/bureau-2026/` (README + CONTRAT). Les six destinations sont codées ; la v2 bureau n'est servie sur le site qu'aux comptes `beta_refonte` (garde-fou de `useDashboardV2.ts`).
- `master` fusionné dans la branche le 2026-10-09 (`db594a4`, non poussé) : 7 conflits réglés en gardant les deux côtés (Apparence = mise en page bureau + case « Page par défaut » + Avis Google ; Réglages = liste « Plus » + carte de configuration). Corrigé : « Cette semaine » de l'accueil lisait `bookings` par la session (refusé en prod depuis le durcissement RLS) → client admin. `tsc` propre, vitest 2481/2481.
- Captures des 22 écrans de `/demo` en 1440×900, clair et sombre : aucune erreur JS ni débordement. Défauts vus : bouton flottant « Support » qui masque le bas de la colonne droite d'Aujourd'hui (Alexandre : on ne corrige pas) ; corrigés le 2026-10-09 : bandeau « venez essayer la nouvelle version » masqué en v2 bureau, sélecteur « Page par défaut » en variante `v2` (jetons de la refonte, e2e `playwright.refonte.config.ts` 7/7 avec un serveur `--webpack` lancé à la main sur 3017) ; restent démo Chiffres à −541 € (début de mois) ; lignes verrouillées affichées sur un compte Pro (voulu par la démo, incohérent).
- 2026-10-10 — trois manques du produit corrigés (téléphone et ordinateur, même commit, poussé sur `refonte/maquette-bureau`) :
  - Montant encaissé à la clôture : `ConfirmerClotureV2` s'ouvre à chaque clôture de l'agenda v2 (champ prérempli avec `montantPrevu`, question « a-t-il eu lieu ? » seulement si le créneau est passé). `PATCH /api/bookings/[id]` accepte `montant_encaisse` uniquement au passage en `done` ; s'il diffère du prévu → `booked_price` = montant, `smart_discount` = 0 (règles dans `lib/cloture.ts`).
  - Prestation déjà réservée : « Mettre en veille » proposé dans la fiche v2 pour toutes les offres (avant : seulement les offres plafonnées) ; le message de refus de suppression conseille la veille.
  - Email facultatif pour un rendez-vous manuel (v2 et site) : `client_email` vide accepté seulement si `saisie_par_laveur` + session du laveur ; aucun email envoyé sans adresse (création, confirmation, avis, relance). Liste Clients et regroupement des relances passent par `cleClient` (email, à défaut téléphone).
  - Vérifié en base le 2026-10-10 (lecture seule) : `create_booking_atomic` insère les clés reçues telles quelles, aucune contrainte sur l'email ; `client_email` est `NOT NULL` mais '' passe. La route transmet bien '' (`...bookingData`).
  - 2026-10-10 — Messages automatiques › Programmé : chaque ligne s'ouvre pour décaler ou ne pas envoyer CE message (`PATCH /api/bookings/[id]/message`). Avis : `review_request_at` déplacé ou effacé. Relance : nouvelles colonnes `bookings.relance_reportee_au` (le cron send-followups attend cette date) et `relance_annulee_le` (posée avec `followup_sent_at` ; exclue de « Parti » et des Chiffres). Colonnes ajoutées en prod le 2026-10-10 (Management API, accord d'Alexandre) et lisibles par la clé de l'application (vérifié).
  - Audit mobile/ordinateur (2026-10-10, code + captures `/demo`), écarts NON corrigés à ce jour :
    - Ordinateur : suppression par glissement inactive à la souris (`useLigneGlissante` ignore `pointerType === 'mouse'`) → impossible de supprimer un client, une entreprise, une ligne « À relancer », un frais ponctuel, une conversation d'assistance ; fiche client en V1 quand `ClientProfileModal` est appelé sans `v2` (filtre Entreprises, contact depuis fiche entreprise, Chiffres › Clients, fenêtre 880–1023 px) ; fiche RDV bureau (`FicheRdvBureauV2`) sans « Détail du prix » ; `DemarrageCard` et `SetupProgressBar` (Réglages) renvoient vers les liens v1 (`href` au lieu de `hrefV2`) car ils testent `useDesignMobile` ; page Plus avec `EnteteParametres` v1 (« Paramètres ») et `SetupProgressBarPlus` v1 ; entre 880 et 1023 px le rail s'affiche mais les écrans gardent la mise en page téléphone (`useGrandEcran` = 1024) ; `VisiteGuidee` et `ChoixVeilleModal` en style v1 ; textes de notifications qui parlent de « téléphone ».
    - Téléphone : fiche RDV de l'agenda sans bouton Itinéraire ; Documents sans recherche ni filtres.
  - Décisions d'Alexandre : « proposer un autre créneau » et « fiche prospect » ne sont pas construits ; bouton Support laissé tel quel.

## Travail précédent — refonte de la réservation
- Branche : `refonte/page-reservation`, dans le worktree `.claude/worktrees/agent-a47fc20e5d6aa3f99`. Le dossier principal reste sur `master`.
- Le contexte partagé a été commité et poussé sur `master` dans `0d38490`. Les instructions et la mémoire sont également présentes sur la branche de refonte.
- Base : commit Claude `c39eaf0` du 2 octobre 2026. L'utilisateur a ensuite fourni huit captures de l'artefact Claude et demandé d'en reproduire le rendu.
- Nouvelle présentation : en-tête coloré, trois cartes compactes, types et quantités avant les prestations, options directement sous la prestation, barre fixe avec total et bouton principal, détail du prix dans un dialogue, jours horizontaux et horaires avec remise en vert.
- `StepPrestation` remplace le parcours séparé service/options dans `BookingForm`. Les options restent propres à chaque véhicule et les paniers de types différents sont conservés. `ContactDetails` rassemble les coordonnées et modèles des véhicules.
- Les cartes restent montées quand elles se replient : les choix et coordonnées sont conservés. Changer la prestation/quantité/options invalide le créneau. Les réponses réseau périmées sont ignorées et les erreurs de zone/horaires/déplacement bloquent la progression avec possibilité de réessayer.
- Écarts intentionnels avec les données fictives des captures : aucune promesse « Demain, 10 h » ou « sous 48 h » sans données ; l'en-tête affiche « À votre domicile ». Les notes/avis n'apparaissent que si réellement récupérés. Email, modèle véhicule et SIRET professionnel restent requis par le parcours existant ; les règles de validation de réservation restent celles du produit.

## Choix de la page du laveur (2026-10-03)
- Demande utilisateur : nouvelle page pour tous les comptes, anciens et nouveaux ; une seule case « Page par défaut » dans la personnalisation, sur le web et la PWA. Les réglages ne sont pas effacés à la bascule.
- washers.booking_page_mode vaut default ou custom. Inscription et défaut SQL : default. PATCH /api/washer valide ce choix pour l'utilisateur connecté, sans changer les droits des réglages payants.
- Correction explicite de l’utilisateur : tous les comptes partent sur la page par défaut. Décocher « Page par défaut » active la page personnalisée et affiche ses réglages ; recocher revient à la nouvelle page. La migration 010 (toujours non appliquée) initialise les lignes existantes à default et conserve les choix en cas de réexécution.
- La route publique partage ses lectures et contrôles entre les présentations. LegacyBookingPage/Form/StepSlot/StepConfirmation restaurent la présentation d'avant c39eaf0. La page par défaut garde le bleu/fond neutre/message standard, avec le nom et le logo autorisé du laveur ; ses anciens couleurs/fond/message restent enregistrés pour le mode classique.
- **Avant déploiement** : tester puis appliquer washboard/supabase/migrations/010_booking_page_mode.sql sur la base ciblée, avant le code. Migration non exécutée ici ; aucun test Supabase réel. Le code dépend de la nouvelle colonne. Un rollback du code peut laisser la colonne en place.

## Validation et reprise
- Correction de la case unique : les deux tests navigateur web/PWA ont été adaptés et repassent ; lint du composant sans erreur. Le démarrage Turbopack a expiré, vérification effectuée avec `next dev --webpack --port 3017` et `BOOKING_UI_PREVIEW=1`. Les validations ci-dessous du reste du parcours proviennent du travail précédent.
- 216 tests unitaires passent : choix de page, routes existantes profil/inscription, prix, résumés, créneaux, fenêtre de réservation, ICS et source de découverte. Les anciennes suites API simulent Supabase ; elles ne prouvent pas la migration réelle.
- Sept tests navigateur dédiés passent (quatre du parcours et trois nouveaux du choix de page). Ils vérifient aussi la sauvegarde/erreur du sélecteur web/PWA, la conservation des réglages et le passage prestation → options → créneau classique. Ils couvrent le parcours jusqu'à confirmation simulée, les prix/remises, les retours, les options par véhicule, les types mixtes, les erreurs réseau, le mode sombre et les largeurs 320/390/1440 px. Captures inspectées. Les API sont interceptées : aucune réservation réelle ni écriture Supabase.
- Commande depuis `washboard/` : `node node_modules/@playwright/test/cli.js test --config playwright.refonte.config.ts`. Cette configuration lance le serveur local sur 3017 avec `BOOKING_UI_PREVIEW=1`.
- Banc d'essai `/dev/booking-preview`, uniquement en développement avec cette variable ; renvoie 404 en production. Les anciens sélecteurs de `e2e/client-booking.spec.ts` ont été adaptés au nouveau parcours ; cette suite sur base réelle n'a pas été lancée.
- TypeScript vérifié après régénération des types Next (`next typegen`) : les fichiers générés `.next/dev/types/routes.d.ts` et `validator.ts` avaient été corrompus pendant le développement et ont été supprimés puis régénérés. Lint ciblé sans erreur ; neuf avertissements hérités sur les images et effets du parcours classique/réglages.
- À vérifier sur téléphone physique : clavier virtuel, zones de sécurité et ressenti tactile. Les tests navigateur ne remplacent pas ce contrôle.
- Pas de déploiement ni de modification de base effectués. La refonte visuelle précédente est poussée dans 37edb1e ; le choix des deux pages est une évolution distincte.

## Depuis le 2026-10-03 (Claude, suite du travail ci-dessus)
- Migration appliquée : `booking_page_mode` existe en base depuis le 2026-10-03 (API Management Supabase, exécutée en direct, aucun fichier commité — le fichier `010_booking_page_mode.sql` mentionné plus haut a depuis été retiré du dépôt).
- Entre le 2026-10-03 et le 2026-10-04, la nouvelle page a été limitée à deux comptes de test (`COMPTES_TEST_NOUVELLE_PAGE_RESERVATION`, `lib/bookingPageMode.ts`) le temps de repérer et corriger une régression réelle : `default` écrasait silencieusement la couleur de marque et le fond personnalisé de comptes payants.
- Politique définitive (Alexandre, 2026-10-04) : les 24 comptes laveurs existants ont été remis à `custom` en base (ils gardent leur page personnalisée, l'activent eux-mêmes s'ils veulent la nouvelle) ; les nouvelles inscriptions démarrent sur `default` (déjà écrit dans `api/auth/signup/route.ts`). La restriction aux deux comptes de test a été retirée du code, elle n'a plus de raison d'être.
- Avis Google ajoutés (`lib/googleReviews.ts`) : note officielle via l'API Places si le laveur renseigne l'identifiant de sa fiche, repli sur ce que son site publie lui-même (JSON-LD) sinon. Réglable sur le site (`IdentiteForm`) et la PWA (`ApparenceV2` + `FeuilleAvisGoogleV2`), avec un aperçu en direct (`/api/washer/avis-preview`) pour que le laveur voie tout de suite si ça marche.
- `e2e/booking-refonte.spec.ts` rejoué et corrigé le 2026-10-04 (deux régressions silencieuses de commits précédents : rôle ARIA du sélecteur de page, slug de démo hors liste — à rejouer systématiquement après toute modification du sélecteur ou des écrans de réglages, voir `washboard/CLAUDE.md`).
- Fusionné avec `master` le 2026-10-04 : `master` avait entre-temps reçu le correctif +33 sur `StepContact.tsx`, le déplacement de la carte de configuration PWA vers Réglages, et la bascule de `bookings` vers le client admin (Ryan, audit sécurité RLS — voir commit `5f60919`). Aucun chevauchement de fichiers entre les deux branches, fusion sans conflit de code (seulement sur les fichiers de contexte partagés).

## À confirmer à la prochaine tâche
- La colonne `bookings.source_decouverte`, utilisée par le commit Claude précédent, n'a pas de migration dans ce commit. Vérifier sa présence avant déploiement ; aucune vérification distante effectuée.
- Le reste du produit n'a pas été audité. Les sections V1 du `CLAUDE.md` racine peuvent être historiques.
- ~~Le REVOKE RLS sur `bookings`~~ **fait** : relu par `cyber`, exécuté en prod le 2026-10-04, vérifié (voir « Dernier travail » plus haut). Ne pas rouvrir.
- Après la fusion de cette branche avec le chantier sécurité de Ryan : revérifier que le jeton PDF (`jeton` dans `BookingForm.tsx`/`StepConfirmation.tsx`) est toujours bien filé jusqu'au bouton de téléchargement dans la nouvelle présentation — les deux fichiers ont été réécrits en parallèle des deux côtés.
- L'historique des conversations des comptes Claude n'a pas été importé. Reprendre à partir des fichiers disponibles et des indications de l'utilisateur.
