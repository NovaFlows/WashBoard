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

## « Revoir le tuto » : premier clic sans effet, deuxième qui marche

Trouvé le 2026-10-10, signalé par Ryan sur son compte test déjà configuré : « quand je vais
pour revisionner le tuto, la première fois ça me ramène à la page d'accueil, je suis obligé
d'y retourner une deuxième fois ». Diagnostiqué par capture réseau + lecture directe de la
base (pas en devinant) : `redemarrerVisite()` lançait son `fetch(DELETE)` vers
`/api/washer/visite-guidee` SANS l'attendre, puis l'appelant (`GuideV2.tsx`/
`GuideContent.tsx`) enchaînait `router.push('/dashboard')` tout de suite derrière. Vérifié
que la base était DÉJÀ à `null` juste après le premier clic — donc pas un retard côté
serveur/base. La vraie cause : Next.js resservait une version du cache routeur
(client-side) de `/dashboard` capturée AVANT la remise à zéro (la page visitée juste après
la connexion) au lieu d'aller relire des données fraîches.

**Corrigé** : `redemarrerVisite()` est maintenant `async` et renvoie une promesse — les deux
appelants (`GuideV2.tsx`, `GuideContent.tsx`) l'attendent AVANT de naviguer, puis appellent
`router.refresh()` juste après `router.push('/dashboard')` pour forcer une lecture fraîche
plutôt que de faire confiance au cache. Vérifié par 6 essais consécutifs sur un compte
jetable déjà configuré : premier clic suffisant à chaque fois, une seule requête DELETE
(pas de doublon).

**Le « faux lancement »** (Ryan, même message : « au premier tour... les trucs se font deux
fois ») n'a pas été reproduit séparément — hypothèse retenue : c'était un symptôme du MÊME
bug (la page en cache s'affichait d'abord, sans tuto, puis Next.js la remplaçait en silence
par la version fraîche une fraction de seconde après, réamorçant le premier arrêt). Capture
fine (texte de la carte échantillonné toutes les 100ms pendant la bascule) ne montre plus
aucune duplication après le correctif. À confirmer par Ryan sur son compte si ça revient —
si ça persiste malgré ce correctif, ce serait un troisième bug distinct, pas une
réapparition de celui-ci.

## « Passer » redéclenchait le tuto en revenant sur « Aujourd'hui »

Signalé par Ryan le 2026-10-10, juste après le correctif de « Revoir le tuto » ci-dessus :
sur un compte fraîchement créé, le tuto s'est lancé tout seul (normal, pas signalé comme un
problème), il a fait « Passer » au premier arrêt, changé de page, puis en revenant sur
« Aujourd'hui » (qui recharge `/dashboard` depuis zéro) — le tuto s'est redéclenché, il a dû
re-passer une deuxième fois. Attendu : « censé se déclencher une fois à la création du
compte, ou via Revoir le tuto, jamais tout seul après ».

Cause : décision du 2026-10-07 (« Passer » ne marque PLUS la visite terminée en base,
seulement « absente » pour cette session d'onglet — voir git blame si besoin du contexte
exact de cette décision). `/dashboard` est un Server Component qui recalcule `aFaire`
depuis la base à CHAQUE rendu, y compris une navigation interne (pas juste un rechargement
dur) ; tant que `dashboard_tour_complete_at` reste NULL, `etatAuChargement` relance au
premier arrêt dès que l'état stocké n'est pas `en_cours`.

**Inversé le 2026-10-10** (feedback plus récent et plus précis l'emporte) : `fermerPourLInstant`
(« Passer ») marque maintenant `dashboard_tour_complete_at` en base, exactement comme
`terminerVisite` (« Terminé ») — les deux ferment la visite pour de bon, elle ne se relance
plus que depuis le Guide (`redemarrerVisite`, qui efface la colonne exprès). Les deux
fonctions renvoient maintenant une promesse (purement informatif pour l'appelant réel —
`synchroVue` l'ignore — mais utile aux tests pour attendre la vraie fin de l'appel réseau
plutôt que deviner un délai).

Vérifié de bout en bout sur un compte jetable fraîchement créé (tuto auto-déclenché, Passer,
navigation ailleurs, retour sur /dashboard) : plus de redéclenchement, stable sur 3 essais.

**Piège de test rencontré en corrigeant ça** : `logger` est mocké une seule fois pour tout
`visiteGuidee.test.ts` (`vi.mock` en tête de fichier) — `vi.resetModules()` dans `charger()`
redonne un module `visiteGuidee` neuf à chaque test, mais PAS un `logger` neuf : ses
`vi.fn()` accumulaient les appels de TOUS les tests précédents sans nettoyage. Un nouveau
test de `fermerPourLInstant` qui appelle vraiment `logger.warn` faisait échouer
`terminerVisite > succès` plus loin dans le fichier (qui vérifie que `logger.warn` n'a PAS
été appelé) — pas une vraie régression, un trou de longue date dans l'hygiène des mocks que
ce nouveau test a fini par révéler. Corrigé avec `vi.clearAllMocks()` dans le `beforeEach`
global du fichier.

## Adresse de départ, téléphone et logo — partis à l'onboarding (2026-10-11)

Ryan voulait réduire le nombre d'arrêts du tuto. Après avoir identifié que le lien de
réservation est déjà choisi à l'onboarding (donc l'arrêt qui le présente est redondant),
il a demandé d'y ajouter aussi l'**adresse de départ** (obligatoire) et le **logo**
(optionnel, « avec le choix de le mettre plus tard »), pour retirer ces deux réglages du
tuto — plus le **téléphone**, qui n'a jamais eu besoin d'y être (déjà posé à l'inscription,
champ `phone` du formulaire `/signup`).

**Onboarding passé de 2 à 4 étapes** (`(public)/onboarding/Onboarding.tsx`), dans cet ordre
(choisi par moi, Ryan m'en a laissé le choix) : lien de réservation (inchangé) → adresse de
départ (nouveau) → logo (nouveau, skippable via un lien « Plus tard ») → comment as-tu
connu WashBoard (inchangé, reste l'étape finale qui pose `onboarding_complete_at`).

L'adresse écrit via `enregistrerProfil({base_address})` — même route (`PATCH /api/washer`)
que Mon profil, aucune nouvelle route API.

**Correctif du 2026-10-11, juste après coup** : la première version utilisait `AdresseV2`
(le composant pensé pour les FEUILLES de la PWA — liste de suggestions EN LIGNE, parce
qu'une liste flottante y serait coupée). Ryan a repéré au premier coup d'œil que ce champ
jurait visuellement avec le reste de l'onboarding. Investigation (agent `designer`,
consulté avant de toucher au style) : `refonte.md` interdit explicitement d'étendre la
direction visuelle V2 (jetons `--v2-*`, verre de châssis) au-delà de la PWA installée —
décision d'Alexandre du 2026-09-22, marquée « ne rouvre pas sans le dire ». Or
login/signup/onboarding s'affichent dans un navigateur classique, jamais dans la PWA
installée : ce n'est pas l'onboarding qui est en retard sur le design, c'est `AdresseV2`
qui est le mauvais composant pour ce contexte. Remplacé par `AddressAutocomplete`
(`components/ui/AddressAutocomplete.tsx`, l'équivalent déjà existant côté site — mêmes
routes Google Places, liste de suggestions flottante, habillé avec les mêmes classes
`wb-input` que les autres champs de l'onboarding). Un seul composant substitué, même
comportement d'écriture, aucune autre page touchée. Le logo réutilise le
pipeline exact de `useApparenceV2.changerLogo` (détourage → compression → upload vers
`/api/washer/logo`), répliqué dans le composant d'onboarding plutôt que d'appeler le hook
(trop d'état inutile pour un simple écran linéaire) — les fonctions sous-jacentes
(`retirerLeFond`, `compressImage`, `envoyerImage`) sont autonomes, pas emprisonnées dans le
hook. Vérifié de bout en bout (compte jetable) : adresse persistée immédiatement, logo
envoyé avec succès (détourage + compression + upload réels), et « Plus tard » qui avance
sans rien envoyer — l'initiale du nom s'affiche ensuite partout comme pour un logo jamais
donné.

**Décision prise AVANT d'implémenter, pas après coup** : Ryan a demandé si d'autres champs
« obligatoires dans les réglages » méritaient le même traitement. Deux autres réglages sont
réellement bloquants (`computeSetupProgress`, setupProgress.ts) : prestations et horaires.
Recommandation donnée et confirmée par Ryan : les laisser dans le tuto, pas à l'onboarding
— ce ne sont pas de simples champs (créer une catégorie, fixer prix/durée, construire un
planning), les imposer avant que le laveur ait vu l'application risquerait de faire fuir
quelqu'un pas encore prêt à s'engager sur ces détails, et le tuto gère déjà bien ce cas (la
mécanique interactive qui avance toute seule). Les 6 réglages « confort » (zone, avis,
relances, agenda Google, créneaux intelligents, message d'accueil) ne sont pas bloquants du
tout — encore moins de raison de les y pousser.

**Tuto, côté `visiteGuidee.ts`** : les 3 arrêts `interactif` (`adresse-depart`,
`telephone`, `logo`) retirés de `ETAPES_VISITE` — 18 arrêts PWA restants (24 avant), 15
côté site (18 avant). `EtapeVisite.interactif`/`CleAvancement` réduits à `'services' |
'availabilities'` (les deux seuls essentiels encore découverts dans le tuto). Nettoyage du
code mort qui en découlait : les appels `signalerAvancement('baseAddress'/'phone')` dans
`ProfilV2.tsx` et `signalerAvancement('logo')` dans `useApparenceV2.ts` (plus aucun abonné
pour les écouter), les marqueurs `cibleVisite`/`data-visite-cible` devenus orphelins sur
ces mêmes écrans, et les props `avancementVisite` que `DashboardShell`/pages
profil/apparence calculaient pour rien.

**Ce qui NE change PAS** : `computeSetupProgress` (`setupProgress.ts`) — le bandeau
« Configurer mon compte » reste identique, il lit juste les champs déjà en base. Pour un
compte qui vient de l'onboarding, adresse et logo y apparaîtront déjà cochés. Pour un
compte antérieur à ce changement, rien ne change : ces réglages restent accessibles
normalement depuis Mon profil/Apparence, seul le tuto ne les présente plus.

## Réduit de 21 à 13 arrêts (2026-10-11) — exhaustivité abandonnée pour de bon

Ryan a demandé mon avis honnête sur l'onboarding et le tuto. Réponse donnée : le tuto
polissait la fluidité d'un tuto à 21 arrêts sans jamais remettre en question le CHIFFRE
21 lui-même — construit sur une logique d'EXHAUSTIVITÉ (audit du 2026-10-09 : couvrir tout
le catalogue de pages) plutôt que de pertinence pour un premier contact. Ryan a confirmé :
« je suis d'accord que 21 étapes c'est trop, que faire alors ? ».

**Principe retenu** : un tuto n'est pas un inventaire de fonctionnalités, c'est « comment
on s'en sert tous les jours » + « ce qu'il faut faire pour encaisser une première
réservation ». Tout le reste se découvre tout seul en se baladant dans « Plus », avec le
Guide comme filet de sécurité (déjà rejouable à volonté).

**Retirés (8 arrêts)** :
- **Messages automatiques, Publicités, Chiffres** — trois réglages verrouillés par l'offre.
  Montrer un mur payant à un compte en essai gratuit qui n'a même pas encore créé sa
  première prestation ressemble à un argumentaire commercial, pas à de l'aide.
- **Chiffres/Documents** — doublon exact du bouton [+] de la barre, déjà expliqué à
  l'arrêt juste avant (« le même écran que le bouton [+] » était littéralement le texte de
  cet arrêt-ci avant qu'il ne parte).
- **Chiffres/Dépenses, Abonnement, Réglages** — pas bloquants, pas quotidiens, pas
  nécessaires avant d'avoir vu le reste de l'app une première fois.
- **Assistance** — fusionnée dans le message de clôture avec Guide plutôt que supprimée :
  les deux sont à un clic l'un de l'autre (`ReglagesV2.tsx`), pas besoin de deux arrêts.
  Nouveau texte de clôture : « Si tu bloques un jour, commence ici : la plupart des
  questions ont déjà leur réponse — et si la tienne n'y est pas, tu peux écrire directement
  à l'équipe depuis cette page. »

**Gardé** : l'orientation (barre du bas, bouton [+], intro Plus), Lien de réservation (ce
qu'ils envoient littéralement à leurs clients), Prestations et Horaires (interactifs, les
deux seuls réglages encore vraiment bloquants), Agenda et Clients (destinations
quotidiennes), le geste retour, et la clôture Guide. Résultat : **13 arrêts PWA (7 côté
site)**, contre 21/18 avant.

Vérifié par parcours complet sur un compte jetable (Playwright) : exactement 13 arrêts,
dans l'ordre, aucune route cassée, message de clôture correct.

**Prochaine étape identifiée, pas faite ce soir** : il n'existe toujours AUCUNE mesure de
ce qui marche — pas de signal sur où les gens décrochent dans le tuto ni sur le taux de
complétion de l'onboarding. Tout le travail de ce soir (fluidité, positionnement, chemins
d'accès, et maintenant ce découpage à 13 arrêts) repose sur du jugement, pas sur des
chiffres. Un signal simple (numéro d'arrêt au clic sur « Passer », complétion de
l'onboarding) serait plus rentable que n'importe quel autre réglage visuel tant qu'il
n'existe pas.

## « voir-page » — ajouté juste après avoir réduit à 13 (toujours le 2026-10-11)

Ryan, juste après la réduction à 13 : « c'est important d'avoir la page de réservation
juste après les liens, comme ça il voit ce que les clients voient ». Pas un retour en
arrière sur la réduction — un seul ajout délibéré, qui a sa propre valeur intrinsèque
(contrairement à ce qui a été coupé) : voir sa propre page publique rassure et clarifie
plus que n'importe lequel des réglages retirés.

Implémenté sans nouvelle navigation : la carte d'identité en haut de la page Plus
(`ParametresFormV2.tsx`) porte déjà un lien « Voir » vers `/book/{slug}` — juste ajouté
`data-visite-cible="voir-page"` dessus. Le nouvel arrêt reste sur la même page que « Lien »
(pas de `route` : on y est déjà), juste après lui dans `ETAPES_VISITE`. Cliquer « Voir »
pendant cet arrêt ouvre la vraie page publique dans le même onglet — sort momentanément du
tableau de bord (comportement normal d'un lien pendant un arrêt « regarde », pas une
fonctionnalité neuve), le tuto reprend là où il était en revenant (état en base + session).

Pas d'équivalent posé côté SITE v1 (`ParametresFormV1.tsx`) : son bloc lien n'a qu'un
bouton « Copier », pas de lien cliquable « Voir » à marquer — la branche site du tuto n'a
jamais dépendu de trouver une cible pour s'afficher (elle montre juste le texte), donc rien
de cassé, juste moins précis sur le site que dans la PWA. À revoir seulement si quelqu'un
construit un jour ce lien côté site.

14 arrêts PWA au total maintenant (8 côté site), pas 13 — voir le commentaire d'en-tête de
`ETAPES_VISITE` pour l'historique complet des deux changements du même jour.

## Retiré l'intro de la barre du bas — 14 → 13 (encore le 2026-10-11)

Ryan, en revoyant le tuto après l'ajout de « voir-page » : « l'étape une n'est pas
nécessaire, ça paraît évident que c'est une barre de navigation ». Retiré le tout premier
arrêt (« Nouveau : ta navigation passe maintenant par cette barre... »), qui expliquait
l'existence même de la barre du bas avant même de montrer quoi que ce soit dessus. Le tuto
démarre maintenant directement sur « Voilà ton tableau de bord », l'arrêt 2 d'avant.

Retrait sans risque : `pwaSeulement`, ne comptait donc déjà pas dans les 8 arrêts côté
site, et le `data-visite-cible="barre-bas"` qu'il ciblait reste posé sur `<nav>`
(`BarreBasV2.tsx`) pour un usage totalement différent — `calculerDisposition()`
(VisiteGuidee.tsx) measure cette barre pour placer la carte, rien à voir avec ce tuto. 14 →
**13 arrêts PWA (toujours 8 côté site)**. Vérifié par parcours complet sur un compte
jetable : exactement 13 arrêts, le premier directement sur « Aujourd'hui ».

## Agenda et Clients fusionnés — 13 → 11 (encore le 2026-10-11)

Ryan a repéré le même défaut sur Agenda et Clients que sur l'intro de la barre, retirée
juste avant : « il y a deux bandeaux, une qui montre... le bouton agenda, et ensuite une
deuxième qui explique l'agenda... je pense que c'est un peu [à] réunir, même principe pour
client ». Chacun des deux avait un arrêt « regarde ce bouton » (`barre-bas-agenda` /
`barre-bas-clients`, sans naviguer) suivi d'un arrêt « voilà la page » une fois dessus —
redondant, le bouton se voit tout seul une fois sur place.

Fusionnés en un seul arrêt chacun, qui navigue directement : « Sur Agenda : toute ton
activité en vue mois/semaine/jour. » et « Sur Clients : chaque client qui a réservé, avec
son historique et son chiffre d'affaires. » — le préfixe (« Sur Agenda », « Sur Clients »)
reprend le texte de l'ancien arrêt « regarde le bouton », pour ne pas perdre cette
annonce, juste fusionnée dans le même arrêt plutôt que sur deux.

**13 → 11 arrêts PWA (toujours 8 côté site**, ces deux arrêts « pointe le bouton » étaient
`pwaSeulement`, ne comptaient déjà pas côté site). Vérifié par parcours complet sur un
compte jetable : exactement 11 arrêts.

## État « finie » qui survit à un changement de compte dans le même onglet (2026-10-11)

Ryan : « je viens de créer mon compte et le tuto ne sait pas lancer ». Diagnostic :
`sessionStorage` (clé `wb_visite_guidee`) retient l'état de l'ONGLET, pas du compte
(voir `etatAuChargement`, qui court-circuite dès que l'état stocké vaut `finie`, avant
même de regarder `aFaire`). Ryan supprime un compte de test et s'en recrée un dans le
MÊME onglet PWA pour retester un correctif (habitude de cette session) : la visite
« finie » (ou « en_cours ») du compte précédent reste en mémoire et bloque celle du
nouveau compte.

Corrigé par une nouvelle fonction `oublierVisite()` (`lib/visiteGuidee.ts`), appelée à
CHAQUE authentification réussie — `/login` (après `signInWithPassword`) et la
confirmation d'inscription par code (`/verifier-email`, après succès de
`/api/auth/confirm-code`) — juste avant la navigation vers la destination. Elle efface
`sessionStorage`, redonnant la main à `dashboard_tour_complete_at` (lu en base via
`aFaire`) dès qu'une session change réellement de compte. Aucun effet sur le cas normal
(un seul compte pour toute la session) : `etatAuChargement` recalcule alors simplement
à partir de `aFaire`, exactement ce qu'il aurait donné sans valeur en cache.

Vérifié par un test NÉGATIF avant de livrer (retirer temporairement l'appel, rebuild,
reproduire le bug avec succès, pour écarter un faux positif) puis par le correctif
restauré : parcours Playwright reproduisant exactement le bug (sessionStorage à `finie`
injecté avant connexion à un NOUVEAU compte) — sans le correctif, le tuto reste bloqué ;
avec, il se relance normalement. Cas normal (sans aucune injection) revérifié intact.

## Carte réductible sur les arrêts `interactif` (2026-10-11)

Ryan, sur l'arrêt Prestations, capture à l'appui (feuille « Nouvelle prestation ») :
la carte de la visite, posée sous la cible, recouvrait les boutons de type de
véhicule plus bas dans la même feuille — gênant pour vraiment configurer en
direct pendant que la carte reste affichée. Deux pistes proposées (bloquer
l'accès jusqu'à « Suivant », ou rendre la carte réductible) ; Ryan a détaillé la
seconde en longueur et écarté la première (« c'est bien beau le bouton plus
tard, mais imaginons il veut commencer à la configurer en direct, bah voilà, un
peu chiant »).

Ajouté : un bouton « › » sur la carte des arrêts `interactif` (Prestations,
Horaires — pas sur les arrêts « regarde », qui bloquent déjà l'écran avec un
fond sombre, rien à libérer) qui la réduit en une petite pastille sur le bord
droit (« Visite 6/11 ‹ »), l'écran entièrement libre en dessous. Se redéploie
TOUTE SEULE dès que l'action réelle arrive (`vient_de_reussir`) pour montrer
« Fait ✓ » avant l'avance automatique déjà en place — Ryan : « une fois qu'il
valide [...], on lui repropose de continuer s'il veut ». Se réinitialise
(dépliée) à chaque nouvel arrêt.

**Non repris** : la fonction de confirmation « une entrée par prestation enregistrée
avant de proposer de passer à la suite » — le tuto avance toujours dès la
PREMIÈRE prestation sauvegardée (`abonnerAvancement`/`servicesCount > 0`),
comportement existant et délibéré, non modifié. Si Ryan veut pouvoir en
enregistrer plusieurs avant que la visite n'avance, c'est un changement séparé,
à confirmer.

Vérifié par parcours Playwright complet (compte jetable, état vide → choix du
modèle « Voiture » → feuille ouverte → réduction → remplissage et Enregistrer
sans obstruction → redéploiement automatique → avance vers l'arrêt suivant).

## Le chemin d'accès affiché sous le texte — seulement à partir de 2 taps

Demandé par Ryan le 2026-10-11 : afficher, entre guillemets, le chemin pour retrouver
chaque écran — mais seulement à partir du moment où il faut 2 taps ou plus depuis la barre
du bas pour y arriver. Jamais sur Aujourd'hui/Agenda/Clients (1 tap direct), ni sur l'arrêt
« lien » (reste sur la page Plus elle-même) ni sur Chiffres/Documents (déjà dit dans le
texte de l'arrêt : « le même écran que le bouton [+] »).

Nouveau champ `cheminPwa?: string` sur `EtapeVisite` (distinct du `chemin` existant, qui
reste la navigation du SITE v1 — les deux structures sont différentes, pas question de les
confondre). Affiché par `VisiteGuidee.tsx` dans les deux rendus PWA (`estInteractif` et
`isPwa`), juste sous le texte de l'arrêt, en petit et en gris (`text-[12px]`,
`--v2-color-gris`) — discret comme demandé.

**Chaque valeur vient d'une lecture du vrai composant qui porte le lien, jamais devinée** :
`ParametresFormV2.tsx` pour tout ce qui part de « Plus » (Prestations, Horaires, Chiffres,
Abonnement, Réglages), `AutomatismesClientsV2.tsx` pour ce qui part de « Clients » (Avis
Google/Relance, Publicités — section « Automatismes », DANS la page Clients elle-même, pas
une navigation à part), `ChiffresArgent.tsx` pour Dépenses (lien DANS Chiffres → 3 taps au
total), `ReglagesV2.tsx` pour Guide/Assistance (DANS Réglages → 3 taps au total). Vérifié
par capture sur un compte jetable, balayage des 21 arrêts PWA : le chemin apparaît
exactement sur les arrêts attendus, jamais sur les autres.

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
