# Contexte partagé — WashBoard

Dernière mise à jour : 2026-10-04.

## Continuité de travail
L'utilisateur développe ce projet depuis plusieurs mois et alterne entre Claude Code (deux comptes) et Codex selon les crédits disponibles. Il souhaite que les assistants entretiennent le contexte dans les fichiers du projet pour faciliter les reprises.

## Repères vérifiés
- `washboard/` contient l'application et son `package.json`.
- Le `CLAUDE.md` racine décrit WashBoard comme un SaaS B2B pour laveurs auto mobiles, avec Next.js, Supabase, Vercel, Google Maps, Resend et Stripe. Ce sont des indications documentaires ; la configuration actuelle n'a pas encore été auditée.
- `regle_du_jeu.md` contient les règles produit, architecture et développement.
- `washboard/CLAUDE.md` importe `washboard/AGENTS.md`, qui contient les consignes Next.js générées.
- `washboard-design/` et `peekly-design/` ont leur propre `CLAUDE.md` ; `.claude/agents/` contient des descriptions de rôles.
- `washboard/TODO.md` porte les priorités et l'historique des correctifs de sécurité.

## Dernier travail
2026-10-04 — Jeton d'accès séparé pour `GET /api/bookings/[id]/pdf` (entrée TODO.md « 🔒 Jeton d'accès séparé »), étapes 1 à 8 faites : `src/lib/bookingToken.ts` (HMAC-SHA256 base64url, comparaison `timingSafeEqual`), garde dans la route PDF, jeton dans la réponse du POST et dans les emails de confirmation et de facture. `tsc`, `eslint` et `vitest run --coverage` (2375 tests) verts. Vérification manuelle (étape 8) faite avec un compte jetable créé puis supprimé (jamais sur un compte réel) : jeton correct → 200, id seul ou jeton d'une autre réservation → 404, réservation dans le quota sans jeton → 200 (liens déjà envoyés), facture déjà émise → sert sans bloquer. Committé localement, PAS poussé.

## Comptes réels — ne jamais utiliser pour un test
- `kookii-clean` (double i) : vraie cliente.
- `autonettoyage` (« AutoNett ») : compte de l'équipe, pas un bac à sable.
- `kookiclean-1f09` : le compte de test de Ryan (« ADMIN RYAN ») — celui-ci peut servir pour une vérification manuelle, mais un compte jetable créé par service-role puis supprimé reste la méthode par défaut cette semaine.

## À faire avant de pousser
- Ajouter `BOOKING_LINK_SECRET` sur Vercel (production + preview). Présente en local dans `washboard/.env.local`, documentée dans `.env.example`.

## À confirmer à la prochaine tâche
- L'historique des conversations des comptes Claude n'a pas été importé. Reprendre à partir des fichiers disponibles et des indications de l'utilisateur.
