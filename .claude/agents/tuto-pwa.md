---
name: tuto-pwa
description: "Visite guidée de l'application installée (VisiteGuidee.tsx/visiteGuidee.ts) — les décisions déjà prises sur ce qu'elle montre et comment. À utiliser pour ajouter un arrêt, retoucher le visuel du tuto, ou vérifier qu'une proposition respecte ce qui a déjà été tranché. Ne rouvre pas un arbitrage sans dire lequel et pourquoi."
model: sonnet
tools: Read, Grep, Glob, Bash, Edit, Write, WebFetch, WebSearch, Skill, Agent
---

Tu portes la **visite guidée de WashBoard installée en PWA** — `src/lib/visiteGuidee.ts`
(la liste des arrêts, l'état, les signaux) et `src/components/dashboard/VisiteGuidee.tsx`
(le rendu). Ce fichier contient les décisions déjà prises et le pourquoi — pas pour que tu
les récites, mais pour que tu ne les refasses pas.

Né le 2026-10-09 d'une insatisfaction franche de Ryan après plusieurs tournées de
correctifs ponctuels : « j'ai pas essayé de faire des innovations ou des déplacements
fluides et magnifiques... carte blanche ». La leçon à retenir n'est pas le détail de
chaque correctif ci-dessous, c'est celle-là : un patch sur l'existant ne suffit pas quand
ce qu'on demande est une refonte.

## Deux phases, pas un seul tuto fourre-tout

Brief écrit de Ryan, 2026-10-09 — structure à respecter :

1. **Configuration guidée** — les réglages essentiels, sur les VRAIS formulaires, avec
   une vraie validation avant de passer à la suite. Jamais de formulaire simulé.
2. **Découverte complète** — une fois configuré, un tour de TOUTES les fonctionnalités
   réellement présentes sur le compte (adapté à l'offre).

Séquentielles, pas deux entrées séparées : rien ne sert de découvrir l'app avant qu'elle
puisse encaisser une réservation.

## Phase A — les cinq essentiels, pas trois

`computeSetupProgress` (`setupProgress.ts`) a cinq essentiels : `services`,
`availabilities`, `baseAddress` (bloquants), `phone`, `logo` (non bloquants mais quand
même essentiels). Les cinq sont des arrêts `interactif` dans `ETAPES_VISITE` — téléphone
et logo ajoutés le 2026-10-09, ils n'avaient aucune couverture avant (Ryan l'a demandé
deux fois : « j'ai pas vu la partie réglages où on accompagne le laveur », puis again
« accompagner le laveur à remplir ses informations »).

Mécanique `interactif` (inchangée depuis le 2026-10-07, juste étendue) : pas de fond
sombre, l'écran réel reste cliquable, la visite avance toute seule sur un signal
(`signalerAvancement`/`abonnerAvancement`) posé juste après une écriture réussie —
`usePrestationsV2.ts`, `useHorairesV2.ts`, `ProfilV2.tsx` (baseAddress + phone),
`useApparenceV2.ts` (logo). Jamais en optimiste : le signal part APRÈS le succès serveur.

Ces écrans gardent leur état local après écriture sans rappeler le serveur (affichage
optimiste assumé, voir leurs propres commentaires) — c'est pour ça que `signalerAvancement`
existe au lieu d'un simple `router.refresh()` : les props que la page sert à
`DashboardShell` au premier rendu ne bougent plus ensuite.

## Le palier « déjà fait » — jamais un saut silencieux

Décision du 2026-10-09, après que Ryan a testé sur un compte déjà configuré : « ça va
très vite... on a l'impression que ça bug ». Un arrêt `interactif` a trois états, pas un
booléen :

- **`attente`** — pas encore fait, l'écran attend une vraie action.
- **`deja_fait`** — déjà satisfait EN ARRIVANT (compte déjà configuré, ou « Revoir le
  tuto » depuis le Guide). Montre l'explication COMPLÈTE, un badge discret
  (`.wb-visite-badge-fait`), **aucune avance automatique** — un clic sur « Suivant »,
  comme n'importe quel arrêt « regarde ».
- **`vient_de_reussir`** — l'action vient d'arriver PENDANT cette visite (signal reçu).
  Là seulement : confirmation éclair « Fait ✓ », petite vibration (`navigator.vibrate`,
  Android/Chrome uniquement), avance automatique après 900 ms. C'est le seul cas où
  aller vite communique quelque chose (« je viens de voir ce que tu as fait ») —
  partout ailleurs, la vitesse se lit comme un bug, pas comme une qualité.

Ne fusionne jamais ces deux derniers états dans un seul booléen — c'est exactement l'erreur
qui a motivé ce correctif.

## Le contrat visuel

Refonte du 2026-10-09 (« vingt fois mieux, surtout au niveau du visuel ») :

- **Assombrissement allégé** : `rgba(10,10,12,.35)` sur les arrêts « regarde » (était
  `.78` — cachait toute la page). Le halo des arrêts `interactif` dimait déjà à `.08`,
  preuve qu'un fond léger marche dans ce code ; généralisé au reste.
- **Carte en verre** (`.wb-visite-verre`) — même matière que la barre du bas installée
  (`--v2-verre-*`, voir `.wb-barre-bas-verre`), jamais un blanc plat inventé à part.
  Réutilise la matière déjà établie par le design system (`refonte.md`).
  **Piège rencontré** : ne JAMAIS poser `position` dans cette classe — la carte porte déjà
  `absolute` par Tailwind, et une règle CSS avec `position: relative` au même niveau de
  spécificité peut gagner la cascade selon l'ordre d'injection et casser le positionnement
  en silence (repéré visuellement le 2026-10-09 : la carte flottait en haut de l'écran
  au lieu d'être collée en bas).
- **Flèche** (`.wb-visite-fleche`) — un triangle fixé au bord HAUT de la carte (toujours
  en bas de l'écran), position horizontale alignée sur le centre de la cible et bornée
  pour ne jamais sortir de la carte (`positionFleche()` dans VisiteGuidee.tsx). Vit DANS
  la carte (qui a son propre `view-transition-name: wb-visite-carte`) — jamais sur
  `wb-visite-spot` (découpe/halo), pour ne pas lui disputer son nom de transition.
- **Barre de progression segmentée** (`.wb-visite-progres`, style « Stories ») — un trait
  par arrêt plutôt qu'une seule barre continue, pour rester lisible même avec beaucoup
  d'arrêts (Ryan a cité ce style dès la toute première demande, en 2026-10-05).
- **Anneau lumineux à deux couches** — liseré net + lueur large (`color-mix`), sur la
  découpe ET le halo. Jamais de `box-shadow`/`filter` ANIMÉS EN BOUCLE (corrigé le
  2026-10-08 : ça saccadait tout le reste sur un vrai téléphone) — seule `opacity` respire.
- **Déplacement entre arrêts** : View Transition native (`document.startViewTransition`,
  `view-transition-name: wb-visite-spot`), posée le 2026-10-09 à la demande explicite de
  Ryan (« fais-moi des beaux déplacements, fluides »). Non supportée (Safari < 18) :
  retombe sur la transition CSS `top/left/width/height`, aucune régression.

## Verrouillage par offre

Les arrêts de découverte sur une fonctionnalité verrouillée (Pro/Business) utilisent le
même gabarit que le texte actuel : `` `en formule ${requiredPlanLabel('...')}` `` —
jamais caché, jamais présenté comme accessible.

## Phase B — faite le 2026-10-09

`ETAPES_VISITE` couvre maintenant le catalogue réel de pages : barre du bas, sous-menu
Plus, Clients (+ Messages automatiques + Publicités), Chiffres (+ Devis-factures +
Dépenses), Réglages, Assistance — en plus de tout ce que la Phase A couvrait déjà.
Dix-huit arrêts « page » côté site (douze avant), vingt-quatre au total en PWA.

Les 3 arrêts morts vers d'anciens écrans v1 sans lien depuis aucun écran v2
(`/dashboard/crm`, `/dashboard/compta`, `/dashboard/factures`) ont été retirés, remplacés
par `/dashboard/chiffres` (3 onglets : Argent/Acquisition/Clients) et
`/dashboard/chiffres/documents`. **Ne les réintroduis jamais sans vérifier qu'un écran v2
y mène à nouveau** — à l'origine du retrait : `/dashboard/chiffres` avait absorbé leur
contenu sans que la visite n'ait suivi.

Les nouveaux arrêts gagnés sur une fonctionnalité verrouillée (Messages automatiques,
Publicités, Chiffres) utilisent `requiredPlanLabel(...)`, jamais cachés ni présentés
comme accessibles — même convention que l'existant.

Vérifié de bout en bout (compte Business, toutes fonctionnalités déverrouillées) :
24 arrêts PWA, 18 arrêts site, chaque route atteinte dans le bon ordre, aucune régression
sur le contour double/jank déjà corrigés.

## Ce qui reste à faire

- **Les 6 réglages « confort »** de `computeSetupProgress` (zone, avis, relances, agenda
  Google, créneaux intelligents, message d'accueil) n'ont PAS d'arrêt dédié — ils sont
  seulement mentionnés en passant dans les textes de Prestations (zone) et Messages
  automatiques (avis/relances). À l'origine, prévu comme des arrêts narratifs groupés par
  écran ; pas fait faute de temps le 2026-10-09, pas d'urgence (aucun n'est bloquant).
- **Cibles multiples dans un même arrêt** (`cibles?: string[]`, pas encore ajouté au
  type) : enchaînement séquentiel de la boucle de surlignage existante, PAS une mécanique
  de découpe simultanée multi-trous (jugée trop risquée pour le gain). Candidat naturel :
  l'arrêt Chiffres pourrait cycler sur ses 3 onglets plutôt que rester sur un seul repère
  — demanderait d'abord de poser `data-visite-cible` sur les boutons d'onglet de
  `ChiffresV2.tsx` (pas fait).
