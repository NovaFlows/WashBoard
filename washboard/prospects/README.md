# Mode proposition — construire la page d'un prospect avant de l'appeler

On fabrique la page de réservation d'un laveur **avant qu'il ait un compte**, pour
la lui montrer pendant l'appel. Il juge une chose au lieu d'écouter une promesse.

Trois commandes, dans cet ordre.

```bash
cd washboard/prospects

# 1. la page, à partir d'une fiche JSON
node page-proposition.mjs fiches/<slug>.json

# 2. son habillage
node habiller-page.mjs <slug> --logo logo.png --fond auto --couleur "#RRGGBB"

# 3. plus tard, corriger les tarifs sans refaire l'habillage
node page-proposition.mjs --resync fiches/<slug>.json
```

`--liste` montre toutes les propositions en ligne, `--supprimer <slug>` en retire une.

---

## La règle du fond

**Par défaut, le fond est un mur d'atelier** : béton brut, caisson lumineux
portant son logo, lampe tungstène, plante en contre-jour. C'est le rendu retenu
après comparaison ; un motif géométrique abstrait fait nettement moins vrai.

Par ordre de préférence :

| | Quand | Commande |
|---|---|---|
| 1 | Il a une photo exploitable — enseigne, atelier, véhicule | `--fond sa-photo.jpg` |
| 2 | **Le cas normal** | `--fond auto` |
| 3 | Python/numpy/scipy indisponibles | `--fond motif` |

Le cas 1 reste le meilleur : la page d'URHUS AUTO, bâtie sur la photo de sa
propre enseigne au néon, est la plus réussie des quatre. Cherche donc toujours
une photo chez lui avant de laisser générer.

**Ne jamais reprendre la photo d'un autre laveur** en changeant le logo. Deux de
nos prospects exercent dans la même ville ; leur attribuer l'atelier du voisin se
remarque une fois et ne se rattrape pas. `--fond auto` existe précisément pour ça.

`--fond auto` détecte les couleurs dans le logo. Si elle se trompe — elle prend
parfois une teinte de fond plutôt que la couleur de marque —, impose-la avec
`--couleur`. Le contraste est vérifié : une couleur trop vive pour du texte blanc
est assombrie automatiquement, seule sa teinte est conservée.

---

## Ce qu'on n'invente jamais

**Ses prix, ses durées, ses frais de déplacement.** Une page montrée à un prospect
avec des tarifs devinés confirme exactement ce qu'il redoute. `page-proposition.mjs`
refuse une fiche dont un prix ou une durée manque — c'est voulu, ne le contourne pas.

Sources exploitables, par rendement décroissant : un site avec grille tarifaire,
un formulaire de réservation existant (Tally, Calendly), un flyer. Un compte
TikTok seul ne donne **rien** — 99 % du fichier de prospection est dans ce cas.

Sans source, on prépare tout sauf les tarifs et on pose six questions à l'appel :
ses formules et leur contenu · le prix de chacune · s'il fait varier selon le
gabarit · leur durée · ses jours et horaires · jusqu'où il se déplace et s'il le
facture. La page est en ligne avant de raccrocher.

---

## Garde-fous

- Une proposition porte toujours `is_preview = true` et `user_id = null` : elle se
  parcourt entièrement mais **n'accepte aucune réservation**. Publier un lien
  réservable au nom de quelqu'un qui n'a rien demandé l'engagerait sur des
  rendez-vous qu'il n'a jamais acceptés.
- Les deux scripts **refusent de toucher un vrai compte**. Un laveur inscrit
  choisit ses couleurs lui-même.
- Ces scripts écrivent dans la base de **production**.
- Le fond est déterministe : la graine vient du slug, relancer l'outil ne change
  pas la page sous les yeux du prospect.

## Pièges déjà rencontrés

- Une page sans **type de véhicule** ne peut rien ajouter au panier : le bouton
  « Continuer » reste grisé pour toujours. La validation le refuse désormais.
- `Number(null)` vaut `0` : une fiche laissée à remplir publiait des prestations
  **à 0 €**. Corrigé, mais c'est le genre d'erreur qui ne se voit qu'en production.
- Un logo mal recadré envoyé à un prospect fait plus de mal que pas de page. Le
  cadrage reste manuel, et il faut le **regarder** avant d'envoyer.
