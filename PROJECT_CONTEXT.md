# Contexte partagé — WashBoard

Dernière mise à jour : 2026-10-03.

## Continuité de travail
L'utilisateur développe ce projet depuis plusieurs mois. Claude Code reste son outil principal ; Codex prend le relais quand les crédits de ses deux comptes Claude sont épuisés. Les assistants entretiennent les fichiers de contexte pour faciliter les reprises.

## Repères vérifiés
- `washboard/` contient l'application et son `package.json`.
- Le `CLAUDE.md` racine décrit WashBoard comme un SaaS B2B pour laveurs auto mobiles, avec Next.js, Supabase, Vercel, Google Maps, Resend et Stripe. Ce sont des indications documentaires ; la configuration actuelle n'a pas encore été auditée.
- `regle_du_jeu.md` contient les règles produit, architecture et développement.
- `washboard/CLAUDE.md` importe `washboard/AGENTS.md`, qui contient les consignes Next.js générées.
- `washboard-design/` et `peekly-design/` ont leur propre `CLAUDE.md` ; `.claude/agents/` contient des descriptions de rôles.

## Travail actuel — refonte de la réservation
- Branche : `refonte/page-reservation`, dans le worktree `.claude/worktrees/agent-a47fc20e5d6aa3f99`. Le dossier principal reste sur `master`.
- Le contexte partagé a été commité et poussé sur `master` dans `0d38490`. Les instructions et la mémoire sont également présentes sur la branche de refonte.
- Base : commit Claude `c39eaf0` du 2 octobre 2026. L'utilisateur a ensuite fourni huit captures de l'artefact Claude et demandé d'en reproduire le rendu.
- Nouvelle présentation : en-tête coloré, trois cartes compactes, types et quantités avant les prestations, options directement sous la prestation, barre fixe avec total et bouton principal, détail du prix dans un dialogue, jours horizontaux et horaires avec remise en vert.
- `StepPrestation` remplace le parcours séparé service/options dans `BookingForm`. Les options restent propres à chaque véhicule et les paniers de types différents sont conservés. `ContactDetails` rassemble les coordonnées et modèles des véhicules.
- Les cartes restent montées quand elles se replient : les choix et coordonnées sont conservés. Changer la prestation/quantité/options invalide le créneau. Les réponses réseau périmées sont ignorées et les erreurs de zone/horaires/déplacement bloquent la progression avec possibilité de réessayer.
- Écarts intentionnels avec les données fictives des captures : aucune promesse « Demain, 10 h » ou « sous 48 h » sans données ; l'en-tête affiche « À votre domicile ». Les notes/avis n'apparaissent que si réellement récupérés. Email, modèle véhicule et SIRET professionnel restent requis par le parcours existant ; les règles de validation de réservation restent celles du produit.

## Choix de la page du laveur (2026-10-03)
- Demande utilisateur : nouvelle page automatiquement à l'inscription ; choix « Page par défaut » / « Faire ma propre page » dans la personnalisation, sur le web et la PWA. Les réglages ne sont pas effacés à la bascule.
- washers.booking_page_mode vaut default ou custom. Inscription et défaut SQL : default. PATCH /api/washer valide ce choix pour l'utilisateur connecté, sans changer les droits des réglages payants.
- Hypothèse annoncée, faute de réponse à la question facultative : les comptes déjà existants conservent la page classique. Le backfill SQL leur attribue custom ; ne pas présenter ce choix comme une décision explicitement confirmée par l'utilisateur.
- La route publique partage ses lectures et contrôles entre les présentations. LegacyBookingPage/Form/StepSlot/StepConfirmation restaurent la présentation d'avant c39eaf0. La page par défaut garde le bleu/fond neutre/message standard, avec le nom et le logo autorisé du laveur ; ses anciens couleurs/fond/message restent enregistrés pour le mode classique.
- **Avant déploiement** : tester puis appliquer washboard/supabase/migrations/010_booking_page_mode.sql sur la base ciblée, avant le code. Migration non exécutée ici ; aucun test Supabase réel. Le code dépend de la nouvelle colonne. Un rollback du code peut laisser la colonne en place.

## Validation et reprise
- 216 tests unitaires passent : choix de page, routes existantes profil/inscription, prix, résumés, créneaux, fenêtre de réservation, ICS et source de découverte. Les anciennes suites API simulent Supabase ; elles ne prouvent pas la migration réelle.
- Sept tests navigateur dédiés passent (quatre du parcours et trois nouveaux du choix de page). Ils vérifient aussi la sauvegarde/erreur du sélecteur web/PWA, la conservation des réglages et le passage prestation → options → créneau classique. Ils couvrent le parcours jusqu'à confirmation simulée, les prix/remises, les retours, les options par véhicule, les types mixtes, les erreurs réseau, le mode sombre et les largeurs 320/390/1440 px. Captures inspectées. Les API sont interceptées : aucune réservation réelle ni écriture Supabase.
- Commande depuis `washboard/` : `node node_modules/@playwright/test/cli.js test --config playwright.refonte.config.ts`. Cette configuration lance le serveur local sur 3017 avec `BOOKING_UI_PREVIEW=1`.
- Banc d'essai `/dev/booking-preview`, uniquement en développement avec cette variable ; renvoie 404 en production. Les anciens sélecteurs de `e2e/client-booking.spec.ts` ont été adaptés au nouveau parcours ; cette suite sur base réelle n'a pas été lancée.
- TypeScript vérifié après régénération des types Next (`next typegen`) : les fichiers générés `.next/dev/types/routes.d.ts` et `validator.ts` avaient été corrompus pendant le développement et ont été supprimés puis régénérés. Lint ciblé sans erreur ; neuf avertissements hérités sur les images et effets du parcours classique/réglages.
- À vérifier sur téléphone physique : clavier virtuel, zones de sécurité et ressenti tactile. Les tests navigateur ne remplacent pas ce contrôle.
- Pas de déploiement ni de modification de base effectués. La refonte visuelle précédente est poussée dans 37edb1e ; le choix des deux pages est une évolution distincte.

## À confirmer à la prochaine tâche
- La colonne `bookings.source_decouverte`, utilisée par le commit Claude précédent, n'a pas de migration dans ce commit. Vérifier sa présence avant déploiement ; aucune vérification distante effectuée.
- Le reste du produit n'a pas été audité. Les sections V1 du `CLAUDE.md` racine peuvent être historiques.
- L'historique des conversations des comptes Claude n'a pas été importé. Reprendre à partir des fichiers disponibles et des indications de l'utilisateur.
