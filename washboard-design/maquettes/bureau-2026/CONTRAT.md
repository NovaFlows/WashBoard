# Contrat commun — écrans de la maquette bureau WashBoard

Plusieurs agents dessinent des écrans **en parallèle**, chacun dans son propre fichier de
fragment. L'orchestrateur assemble ensuite tous les fragments dans le fichier maître.
Ce contrat existe pour que les morceaux se recollent sans se contredire. **Respecte-le à
la lettre** — un fragment hors contrat sera à refaire.

## Le fichier maître, qui fait loi

`washboard-bureau.html`, dans ce même dossier. **Lis-le en entier avant d'écrire une
ligne.** Il contient 10 écrans déjà validés par Alexandre : c'est le modèle à suivre, pas
une base à discuter. Tu y trouves les jetons `--v2-*`, les classes réutilisables
(`.surface`, `.row`, `.split`, `.pane`, `.btn`, `.pill`, `.client-row`, `.sectitle`,
`.docrow`, `.topbar`, `.hero-card`, `.week-grid`, `.modal`…), le sprite d'icônes, et les
rôles typographiques (`.t-hero`, `.t-titre`, `.t-nom`, `.t-corps-fort`, `.t-corps`, `.tnum`).

## Ce que tu produis : UN fichier de fragment

Chemin : `fragments/<ton-nom>.html` (l'orchestrateur te donne `<ton-nom>` et ta plage
d'identifiants). Structure exacte, dans cet ordre :

```html
<style data-fragment="<ton-nom>">
/* CSS spécifique à tes écrans, uniquement si une classe existante ne suffit pas.
   Préfixe toute classe neuve par <ton-nom>- pour éviter toute collision. */
</style>

<!-- ÉCRAN 21 | Agenda — mois | agenda -->
<div class="screen content" data-screen="21">
  …
</div>

<!-- ÉCRAN 22 | Rendez-vous manuel | agenda -->
<div class="screen content" data-screen="22">
  …
</div>

<script data-fragment="<ton-nom>">
/* JS spécifique, uniquement si tes écrans ont une interaction réelle.
   Préfixe toute fonction et toute variable globale par <tonNom>_ . */
</script>
```

La ligne de commentaire avant chaque écran est **obligatoire** et lue par l'assemblage :
`<!-- ÉCRAN <id> | <libellé court pour le sélecteur> | <groupe> -->`.
Les groupes autorisés, et pas d'autres : `aujourdhui`, `agenda`, `clients`, `chiffres`,
`documents`, `plus`.

Le `data-screen` doit tomber dans **ta plage d'identifiants** et chaque identifiant est
unique. N'écris rien en dehors de ce fichier.

## Règles de dessin

1. **Reprends les classes du maître avant d'en créer.** Un écran « liste à gauche, détail
   à droite » utilise `.split` + `.pane` + `.pane-scroll`, pas une grille réinventée. Une
   fenêtre utilise `.scrim` + `.modal` + `.modal-card`.
2. **Jamais de couleur en dur** côté tableau de bord : seulement les jetons `--v2-*`.
   Unique exception, déjà en place dans le maître : l'aperçu de la **page publique du
   laveur**, qui est toujours claire et dont les couleurs sont donc écrites en dur.
3. **Le texte posé sur un aplat d'accent utilise `var(--v2-color-sur-accent)`**, jamais
   `#fff` : en thème sombre l'accent s'éclaircit et le blanc devient illisible.
4. **Contraste** : tout texte doit rester lisible dans les DEUX thèmes. Vérifie-le sur
   capture, pas de tête.
5. **Les tics d'IA listés dans `.claude/agents/refonte.md`** (tableau « Les tics d'IA,
   déjà retirés ») sont interdits : pas de halos dégradés, pas de tout-en-carte, pas de
   BANDEAU MAJUSCULE, pas de séries de tuiles « libellé / gros chiffre / +12 % », **un
   seul héros par écran**, pas d'emoji, pas d'icône en carré arrondi sur chaque ligne.
6. **Un écran plein, pas un écran à moitié vide.** Le cadre fait 1440×912 : si ton contenu
   occupe le tiers supérieur et laisse le reste blanc, la mise en page est à revoir (c'est
   un défaut déjà corrigé une fois sur l'agenda semaine).
7. **Données françaises plausibles et COHÉRENTES avec le maître** : le laveur est Julien
   Roussel / Éclat Mobile, à Bordeaux, offre Starter, 18 clients. Les clients déjà nommés
   sont Camille Lefebvre, Marc Dubreuil, Garage Renault Mérignac (Nathalie Petit), Thomas
   Girard, Claire Martin, Antoine Faure, Sophie Lambert, SARL Dumas Transport, Bastien
   Leroy. Réutilise-les. Jamais de « Lorem ipsum » ni de « John Doe ».
8. **Ne dessine pas une fonctionnalité qui n'existe pas dans le code.** Si la maquette
   demande une brique qu'aucune donnée ni fonction ne nourrit aujourd'hui, soit tu
   l'écartes, soit tu l'affiches avec une mention honnête — et tu le signales dans ton
   rapport. Pas de chiffre inventé présenté comme réel.

## Où trouver la vérité sur chaque écran

Le dépôt est `C:\Users\CYTech Student\WashBoard`, le code dans `washboard/`.
Les écrans v2 déjà codés sont dans `washboard/src/components/dashboard/*V2.tsx` — **c'est
la source** : lis le composant correspondant à ton écran avant de le dessiner, pour
reprendre ses vraies sections, ses vrais libellés et ses vrais états. Le dossier
`washboard/src/app/(dashboard)/dashboard/` donne les routes.

`.claude/agents/refonte.md` porte la direction visuelle et l'architecture à 5 destinations
(+ « Documents » épinglé, décidé le 2026-10-03 par Alexandre).

**Tu ne modifies AUCUN fichier du dépôt.** Uniquement ton fragment.

## Vérifier ton travail

Écris un petit script Playwright dans le dossier de la maquette qui :
1. construit une page d'essai = le fichier maître avec TON fragment inséré juste avant
   `</div>\n</div>\n</div>` (la fin de `.app-shell`), ses `<style>`/`<script>` recollés au
   bon endroit ;
2. affiche chacun de tes écrans (`showScreen(<id>)`) en clair ET en sombre ;
3. en prend une capture.

`NODE_PATH="c:/Users/CYTech Student/WashBoard/washboard/node_modules"` donne accès à
Playwright. **Regarde réellement les PNG** avant de rendre ton rapport : on prouve par une
capture, pas par une description. Si tu écris « vérifié », ça veut dire que tu as ouvert
l'image.

## Ton rapport final

Il est transmis tel quel et c'est tout ce qui sera lu de ton travail. Mets-y : la liste de
tes écrans avec leur identifiant, ce que chacun montre, les captures que tu as regardées,
les briques que tu as écartées faute de données réelles, et **tout défaut non corrigé**.
Langage simple, pas de jargon : Alexandre n'a aucune compétence en design.
