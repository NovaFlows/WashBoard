# WashBoard — continuité entre Codex et Claude Code

## Reprendre le projet
- Répondre en français. Le projet existe depuis plusieurs mois : partir de l'existant.
- Lire le `CLAUDE.md` à la racine, puis `PROJECT_CONTEXT.md`, et les instructions du dossier concerné avant de modifier ses fichiers.
- Consulter `regle_du_jeu.md` pour les règles du projet. Vérifier les anciennes descriptions de V1 contre le code et les décisions récentes de l'utilisateur ; ne pas supposer qu'elles décrivent encore tout le produit.
- Examiner l'état Git et les fichiers utiles à la tâche. Préserver les modifications existantes.
- L'application se trouve dans `washboard/`. Les dossiers de design possèdent leurs propres `CLAUDE.md`.

## Entretenir le contexte partagé
- Après un travail significatif, mettre à jour `PROJECT_CONTEXT.md` avec les décisions confirmées, les changements utiles à la reprise, les vérifications réalisées et ce qui reste à faire.
- Garder cette mémoire courte et actuelle : remplacer les informations périmées plutôt qu'accumuler les comptes rendus.
- Mettre à jour le `CLAUDE.md` concerné lorsque les règles durables, l'architecture ou les commandes changent. Garder `AGENTS.md` pour les consignes de travail ; éviter les copies contradictoires.
- Distinguer faits vérifiés, contexte historique et points à confirmer. Ne jamais inventer l'historique des sessions Claude ni présenter un test non exécuté comme réussi.
- Ne conserver aucun secret, jeton, mot de passe ni donnée personnelle de client dans la mémoire.
- Terminer les tâches en indiquant le résultat, la validation et les éventuels blocages pour faciliter le passage à l'autre outil.
