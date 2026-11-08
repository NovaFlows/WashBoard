# Kit contenu — posts Instagram / TikTok de WashBoard

Ce dossier permet à chaque membre de l'équipe (Alexandre, Ryan…) de fabriquer et publier les posts de
**@washboard.fr** (Instagram, partagé sur Facebook) et **@wash_board.fr** (TikTok) avec **son** personnage
(stickers façon Bitmoji) et **sa** voix clonée ElevenLabs, en gardant les mêmes règles et le même style.

L'agent Claude Code qui s'en sert : **`contenu`** (`.claude/agents/contenu.md`). Dis-lui par exemple :
« fais un Reel sur l'acompte pour jeudi » ou « publie le post du jour ».

## Ce qu'il y a dedans

| Dossier | Contenu |
|---|---|
| `routine/creation.md` | Toutes les règles pour créer un Reel, un carrousel ou un post (leçons d'Alexandre comprises). **À lire avant chaque post.** |
| `routine/publication.md` | Comment publier sur Instagram et TikTok avec Claude in Chrome, sans erreur de recadrage ni doublon. |
| `modeles/reel/` | Moteur des Reels : iPhone réaliste, vrais écrans WashBoard, sous-titres, couverture (`video/`), captures des vrais écrans (`captures/`), voix en une prise (`vo/`), mixage (`audio/`). Exemple : le Reel « Un garage te confie 3 véhicules ? » du 7 nov. |
| `modeles/carrousel/` | Modèle de carrousel validé (style « papier », Archivo), versions Instagram 4:5 et TikTok 9:16. |
| `stickers/<personne>/` | Les stickers détourés de chacun, mêmes noms de poses (`stickers/poses.json`). |
| `personnes/<personne>.json` | Voix ElevenLabs (voice ID + réglages) et dossier de stickers de chacun. |
| `publications.json` | **Journal commun** : ce qui est publié ou réservé, par qui, sujet, couverture claire/sombre, noms fictifs déjà utilisés. |
| `outils/journal.mjs` | Lit et met à jour ce journal (avec `git pull` / `git push`). |

`contenu/.env`, `contenu/travail/` (copies de travail) et `contenu/out/` (vidéos et images finales) restent
sur ton PC : ils ne sont jamais dans Git.

## Installation (une fois)

1. Dépôt WashBoard à jour : `git pull`.
2. Outils : **Node 22 ou plus**, **Python 3** avec `pip install numpy scipy pillow`, **ffmpeg** et ffprobe dans le PATH.
3. Dans `washboard/` : `npm install` puis `npx playwright install chromium` (le Chromium sert aux captures et au rendu).
   Pour les captures des vrais écrans, washboard doit pouvoir démarrer en local (`washboard/.env.local`, demande-le à Alexandre).
4. Copie `contenu/.env.exemple` en `contenu/.env` et remplis-le : ta clé ElevenLabs, `CONTENU_PERSONNE=ryan`, ton adresse mail.
5. Dans `personnes/ryan.json`, remplace `voix_elevenlabs` par le **Voice ID** de ta voix clonée
   (ElevenLabs → Voices → ta voix → « Copy voice ID »).
6. Mets tes stickers dans `stickers/ryan/` en suivant `stickers/ryan/LISEZMOI.md`, puis
   `python contenu/outils/alleger-stickers.py ryan`, et pousse-les (`git add contenu/stickers/ryan contenu/personnes/ryan.json`).
7. Pour publier : Chrome ouvert avec l'extension Claude in Chrome, connecté à Instagram @washboard.fr et TikTok @wash_board.fr.

Vérification rapide : `node contenu/outils/journal.mjs etat` doit afficher le dernier post et le prochain thème de couverture.

## Les règles d'équipe à ne jamais oublier

- **Un seul post par jour** sur les comptes, et **jamais un sujet déjà traité**, par toi ou par l'autre :
  `node contenu/outils/journal.mjs sujets`, puis `reserver` dès que tu as choisi ton sujet et ton jour.
- **Couverture claire / sombre en alternance**, d'un post à l'autre, quel que soit l'auteur : `prochain_theme` de `journal.mjs etat`.
- **Après publication** : `journal.mjs publier …`, sinon le suivant se trompe de couverture ou refait ton sujet.
- **Noms fictifs neufs** à chaque vidéo (`journal.mjs noms`), jamais une vraie marque ni un vrai client (jamais « Kookii Clean »).
- **Vrais écrans WashBoard** et **vrais iPhone**, jamais de maquette inventée ; aucune fonctionnalité qui n'existe pas dans le code.
- La clé ElevenLabs reste dans `contenu/.env` : ne l'affiche jamais, ne la committe jamais (ce dépôt est public).
