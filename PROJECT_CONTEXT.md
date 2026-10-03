# Contexte partagé — WashBoard

Dernière mise à jour : 2026-10-03.

## Continuité de travail
L'utilisateur développe ce projet depuis plusieurs mois et alterne entre Claude Code (deux comptes) et Codex selon les crédits disponibles. Il souhaite que les assistants entretiennent le contexte dans les fichiers du projet pour faciliter les reprises.

## Repères vérifiés
- `washboard/` contient l'application et son `package.json`.
- Le `CLAUDE.md` racine décrit WashBoard comme un SaaS B2B pour laveurs auto mobiles, avec Next.js, Supabase, Vercel, Google Maps, Resend et Stripe. Ce sont des indications documentaires ; la configuration actuelle n'a pas encore été auditée.
- `regle_du_jeu.md` contient les règles produit, architecture et développement.
- `washboard/CLAUDE.md` importe `washboard/AGENTS.md`, qui contient les consignes Next.js générées.
- `washboard-design/` et `peekly-design/` ont leur propre `CLAUDE.md` ; `.claude/agents/` contient des descriptions de rôles.

## Dernier travail
Ajout d'un `AGENTS.md` racine et de cette mémoire partagée, avec des références depuis les fichiers Claude existants. Aucun changement de code applicatif ; aucun test applicatif exécuté.

## À confirmer à la prochaine tâche
- L'état fonctionnel actuel, les priorités et les décisions récentes ne sont pas encore reconstitués. Les sections V1 du `CLAUDE.md` racine peuvent être historiques.
- L'historique des conversations des comptes Claude n'a pas été importé. Reprendre à partir des fichiers disponibles et des indications de l'utilisateur.
