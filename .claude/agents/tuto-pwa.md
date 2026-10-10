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
- **Flèche** (`.wb-visite-fleche`) — un triangle sur le bord de la carte le plus proche de
  la cible (haut ou bas, voir « Carte collée à la cible » ci-dessous), position
  horizontale alignée sur le centre de la cible et bornée pour ne jamais sortir de la
  carte (`positionFleche()` dans VisiteGuidee.tsx). Vit DANS la carte (qui a son propre
  `view-transition-name: wb-visite-carte`) — jamais sur `wb-visite-spot` (découpe/halo),
  pour ne pas lui disputer son nom de transition.
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
- **Suivi au défilement : jamais la même transition que le déplacement entre arrêts.**
  Corrigé le 2026-10-10 après que Ryan a décrit un décalage précis : « quand je scrolle,
  il y a un temps de latence entre le cadre et ce qui surligne... ça fait un peu
  saccadé » (et le percevait aussi comme « le bandeau en bas peut bouger » sur un arrêt
  qui vise la barre du bas — même cause). La transition `top/left/width/height` de
  `.wb-visite-decoupe`/`.wb-visite-halo`, pensée pour le glissement d'un arrêt à l'autre,
  s'appliquait à TOUTE mise à jour du rectangle — chaque défilement relançait un
  rattrapage animé de 500ms par-dessus le précédent, jamais terminé. `surligner()`
  (VisiteGuidee.tsx) distingue maintenant deux origines : une nouvelle cible (changement
  d'arrêt, ou PrestationsV2 qui bascule de vue) garde l'animation ; un défilement ou un
  redimensionnement de fenêtre passe en `transition: none` posé en ligne, suivi 1:1,
  aucun retard. Vérifié par mesure directe (écart cible/découpe) pendant un défilement
  progressif simulé : 0px d'écart à chaque palier.
  **Piège à ne pas refaire** : ne jamais lire cet état via un `ref` pendant le rendu
  (`react-hooks/refs` le refuse à raison, et React ne garantit pas que la valeur soit à
  jour) — `rect` et l'indicateur « instantané » vivent dans le MÊME `useState`, mis à
  jour ensemble.

## Carte collée à la cible, pas fixe en bas d'écran

Changement du 2026-10-10, sur référence CONCRÈTE de Ryan plutôt que sur description
verbale : cinq captures de l'onboarding d'une autre app (« Folyo », un porte-folio —
« c'est pas le même sujet nous ici c'est laveur mais comme ça tu captes »). Dans ces
captures, la carte colle TOUJOURS à l'élément visé (juste au-dessus ou juste en-dessous,
selon la place), flèche courte — jamais plantée en bas d'écran avec une flèche qui
traverse tout l'écran, ce que ce tuto faisait encore juste après la refonte du
2026-10-09.

`calculerDisposition()` (VisiteGuidee.tsx) décide : sous la cible si ça tient à peu près
(170px) OU s'il y a plus de place en bas qu'en haut, sinon au-dessus. `limiteBasse` est
mesurée en vrai sur l'élément réel de la barre du bas (`[data-visite-cible="barre-bas"]`)
plutôt que recalculée à la main depuis les mêmes constantes CSS que `DashboardShell` une
deuxième fois. Pas de cible (arrêt narratif pur) : carte centrée verticalement via
`top:0; bottom:0; margin:auto 0` — **jamais `transform: translateY(-50%)`**, l'animation
d'entrée (`wb-visite-entree`) utilise déjà `transform` et la dernière valeur de
l'animation écraserait un positionnement posé par ce biais.

La flèche suit : `.wb-visite-fleche` (par défaut, carte en-dessous → flèche en haut,
pointe vers le haut) et `.wb-visite-fleche--bas` (carte au-dessus → flèche en bas, pointe
vers le bas, couleurs de bord/fond inversées pour coller au dégradé `--v2-verre-*` à cet
endroit précis de la carte).

Vérifié par capture Playwright sur un compte jetable (24 arrêts PWA, cibles à hauteurs
variées) : les deux directions de flèche apparaissent bien selon la position de la cible,
aucun chevauchement carte/cible mesuré une fois les rattrapages différés de `surligner()`
stabilisés (jusqu'à 3s — mesurer plus tôt capture parfois une frame transitoire, à ne pas
confondre avec un vrai bug de positionnement).

**Piège rencontré tout de suite après, en capture de Ryan** : `CARTE_CENTREE` posait
`top:0; bottom:0; marginTop:'auto'; marginBottom:'auto'` SANS `height` — en pensant que
« hauteur non précisée = hauteur de contenu, les marges auto centrent ça ». FAUX pour un
élément en position absolue : quand `top` ET `bottom` sont tous les deux fixés mais que
`height` reste `auto`, la spec CSS ne centre pas une boîte de la taille de son contenu —
elle ÉTIRE la boîte pour remplir tout l'espace top→bottom, et les marges `auto` tombent à
0 (elles ne servent à rien dans ce cas précis). Résultat vu en prod : une carte étirée sur
quasi tout l'écran, fond flouté géant, texte collé tout en haut — exactement les captures
que Ryan a envoyées (« plusieurs pages du tuto sont comme celle-là »). Correctif :
`height: 'fit-content'` en plus — sort du cas « hauteur auto », redonne aux marges leur
rôle de centrage. Au moindre nouveau centrage absolu top+bottom+marge-auto dans ce
fichier, vérifier que `height` est bien fixé à autre chose que `auto`.

## Le gel de 1,5s à chaque navigation — architecture cassée, pas un réglage à ajuster

Trouvé le 2026-10-10 après que Ryan a décrit (deux fois, avec des mots différents) une
saccade au passage d'un arrêt à l'autre ET au clic sur Suivant : « c'est pas fluide...
mode saccadé... que ce soit pour passer au bandeau d'après, ou bien quand on a un clic
sur suivant ». Diagnostiqué par CAPTURE DE FRAMES (`requestAnimationFrame`, position de
la découpe/carte à chaque frame), pas par `longtask` (`PerformanceObserver` n'a rien vu —
le gel n'est pas du JS qui bloque, c'est un écran qui refuse de se mettre à jour).

Deux bugs DISTINCTS trouvés, à ne pas confondre si ça revient :

**1. `router.push(route)` vers la page déjà affichée.** L'arrêt d'ouverture (`barre-bas`,
sans route) suivi d'un arrêt SUR `/dashboard` (sa propre route) déclenchait quand même un
vrai `router.push('/dashboard')` en étant déjà sur `/dashboard` — refait toute une
navigation (re-rendu du contenu serveur) pour rien. Gel mesuré : ~150-400ms. Corrigé :
`avancer()` compare `route !== pathname` (`routeBougera`) avant d'appeler `naviguer()`.

**2. Le vrai bug, plus sérieux : la View Transition d'une navigation cross-page ne se
résolvait JAMAIS autrement que par son filet de secours de 1,5s — SYSTÉMATIQUEMENT, pas
occasionnellement.** L'ancien code enveloppait `router.push` dans
`document.startViewTransition(() => new Promise(résoudre => { ...; setTimeout(résoudre,
1500) }))`, en attendant qu'un `useEffect` qui observe `navigation` (l'indicateur de
`useTransition`) redevienne faux pour résoudre la promesse plus tôt. Problème
architectural : **cette instance de VisiteGuidee ne survit pas à la navigation**
(`DashboardShell` est rendu par chaque page séparément, pas un layout partagé — déjà noté
plus haut dans ce fichier). L'instance qui portait la référence vers `résoudre` est donc
démontée EN COURS de navigation, avant que son propre effet n'ait pu observer
`navigation` repasser à faux. Résultat : peu importe la vitesse réelle du chargement de
la page suivante, la transition attendait TOUJOURS le plein 1,5s avant de rendre la main
— un écran figé une seconde et demie à CHAQUE clic sur Suivant qui change de page.
Vérifié par mesure : deux navigations différentes, deux gels à 1536ms et 1538ms (bien
trop proches de 1500 pour être une coïncidence de timing réel).

Corrigé en retirant la View Transition pour les navigations cross-page : `avancer()`
appelle `appliquer()` directement dans ce cas (pas de `document.startViewTransition` du
tout). Le spinner déjà affiché sur le bouton pendant `navigation` (useTransition) suffit
comme retour pendant le chargement réel. La View Transition reste en place UNIQUEMENT
pour les cas sans navigation (`synchroVue`, résolution synchrone via `flushSync` — fermer
le tuto, passer, terminer, ou avancer vers un arrêt sans route ou sur la même page) : ces
cas-là ont été vérifiés fluides par la même méthode (capture de frames, aucun gel mesuré
sur des dizaines de transitions, écart de frame maximal ~19ms sur tout un parcours de 5
arrêts y compris une vraie navigation cross-page après correctif).

**Piège à ne pas refaire** : ne JAMAIS faire dépendre la résolution d'une
`document.startViewTransition` d'un signal porté par une instance de composant qui peut
être démontée avant que ce signal n'arrive — en particulier ici, tout ce qui traverse une
navigation Next.js dans une page sans layout partagé.

## La carte qui bascule de côté en boucle pendant un défilement

Trouvé le 2026-10-10, juste après le correctif du gel de 1,5s — Ryan, content de la
vitesse retrouvée, a décrit un AUTRE problème : « quand tu scrolles... le bandeau suit le
défilement... les contours et le bandeau saccadent... c'est pas bien accroché ».

Cause : `calculerDisposition()` (devenu `decidreCote()`, voir « Carte collée à la cible »
plus haut) DÉCIDAIT dessus/dessous à partir de `rect`, et `rect` se met à jour à CHAQUE
frame de défilement (voir `surligner()`). Juste au seuil de bascule — la cible à peu près
à mi-hauteur d'écran — un défilement qui s'attarde près de ce point fait repasser la
décision d'un côté à l'autre À CHAQUE frame qui franchit le seuil. Pas un ralentissement,
une carte qui change de côté en boucle pendant qu'on scrolle lentement dessus.

Vérifié par mesure (pas par supposition) : lecture directe de `carte.style.top` /
`carte.style.bottom` (jamais `getComputedStyle` ici — la valeur CALCULÉE résout toujours
`top` en pixels même quand seul `bottom` a été posé, l'autre bord se déduisant de la mise
en page ; `getComputedStyle` aurait donné l'impression que les deux côtés sont identiques
en permanence, un piège de mesure à ne pas refaire) pendant un défilement qui traverse le
seuil connu dans les deux sens : **6 bascules** mesurées dans l'ancien code sur un seul
aller-retour de défilement, **0** après correctif.

Correctif : le côté (dessus/dessous) est maintenant décidé par `decidreCote()` UNE SEULE
FOIS par cible — seulement quand `instantane` vaut faux dans `surligner()` (une vraie
NOUVELLE cible, pas un défilement). `coteCarte` (state séparé) reste figé pendant tout
l'arrêt. Le DÉCALAGE réel (top/bottom en pixels), lui, continue de suivre `rect` en direct
à chaque frame via `positionnerCarte()` — la carte glisse donc toujours avec la cible
pendant qu'on scrolle, seul le CÔTÉ ne change plus en boucle.

**Piège à ne pas refaire** : toute logique de positionnement qui CHOISIT entre deux états
(ici dessus/dessous) à partir d'une valeur qui varie en continu (ici `rect` pendant un
défilement) doit séparer la DÉCISION (figée, décidée une fois par évènement stable) du
CALCUL qui en découle (qui, lui, peut suivre la valeur en direct sans problème). Mélanger
les deux fait resurgir une bascule en boucle pile au seuil.

## La flèche gardait sa propre transition non protégée

Le correctif du scroll (ci-dessus) gérait `.wb-visite-decoupe`/`.wb-visite-halo`, mais PAS
`.wb-visite-fleche` : sa `transition: left .5s` restait inconditionnelle. Même classe de
bug, juste sur l'axe horizontal plutôt que vertical — corrigé le 2026-10-10 en même temps
qu'un passage systématique des 24 arrêts (demandé par Ryan : « penses-tu que tu peux mieux
faire ? »). `transition: instantane ? 'none' : undefined` posé en ligne sur le même
élément, exactement le même traitement que la découpe.

## Passage systématique des 24 arrêts — ce qu'un échantillon ne montre pas

Après le correctif ci-dessus, Ryan a demandé explicitement un VRAI passage des 24 arrêts
(pas un échantillon) — vérification automatisée (chevauchement carte/cible, carte hors
écran) + capture d'une image par arrêt sur un compte Business jetable. A trouvé un
problème que les vérifications ponctuelles précédentes avaient raté : l'arrêt « lien »
(Mes liens) rognait 24px sous le bas de l'écran.

**Deux correctifs, pas un seul** :

1. **`HAUTEUR_CARTE_ESTIMEE` relevée de 170 à 210px** — `decidreCote()` doit deviner la
   hauteur de la carte AVANT qu'elle existe dans le DOM ; 170px collait trop juste aux
   hauteurs réelles mesurées (154-174px pour une carte interactive classique).
2. **Filet de sécurité par mesure réelle** (nouvel effet, juste après la pose de
   `carteRef`) : une fois la carte VRAIMENT dans le DOM, mesure sa hauteur réelle et
   bascule de côté si elle déborde — corrige n'importe quelle estimation fausse, pas
   seulement celle observée.

**Piège rencontré EN CORRIGEANT le filet de sécurité, à ne jamais refaire** : la toute
première version mesurait immédiatement après le rendu (`useEffect` sans délai). Un essai
sur le parcours réel a semblé corriger le débordement ; un second essai IDENTIQUE a montré
le MÊME débordement non corrigé. La seule différence entre les deux essais : un
`console.log` de debug qui retardait la mesure de quelques millisecondes. Ce n'était PAS
un hasard de cache de build (chassé à tort pendant un moment — `rm -rf .next` répété n'a
rien changé) : la vraie cause est une course avec `scrollIntoView` (dans `surligner()`) —
mesurer juste après le rendu peut tomber pendant que la cible est encore en train de
glisser vers sa position finale, et un débordement qui n'apparaît qu'une fois stabilisée
passe inaperçu. Corrigé avec un `setTimeout(…, 400)` redémarré (cleanup + nouveau minuteur)
à chaque changement de `rect`/`coteCarte` — un vrai débounce « rien ne bouge depuis 400ms »,
pas un délai fixe après un seul évènement. Vérifié stable sur 3 passages complets des 24
arrêts d'affilée après ce correctif (contre un résultat incohérent avant).

**Leçon generale** : si un correctif qui mesure le DOM après un rendu semble marcher par
intermittence sans changement de code évident, suspecter une course avec une animation en
cours (ici `scrollIntoView` smooth) avant de suspecter le cache de build.

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
