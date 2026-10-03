@AGENTS.md

Lire aussi `../AGENTS.md` et `../PROJECT_CONTEXT.md` pour reprendre le travail partagé entre Claude Code et Codex.

## Présentation publique de réservation
- `washers.booking_page_mode` : `default` pour le parcours compact (tous les comptes initialement), `custom` pour la présentation classique personnalisable.
- Une seule case « Page par défaut » : cochée = default, décochée = custom avec les réglages visibles. Le choix est commun à `IdentiteForm` (web) et `ApparenceV2` (PWA), via `BookingPageModePicker` et PATCH /api/washer. Changer le mode ne supprime jamais les réglages d'apparence.
- La route `/book/[slug]` charge et contrôle les données une seule fois, puis rend `BookingForm` ou `LegacyBookingPage`. Garder les listes explicites des champs envoyés aux composants clients.
- Migration 010 requise avant le déploiement de ce code ; état d'application et validations dans `../PROJECT_CONTEXT.md`.
