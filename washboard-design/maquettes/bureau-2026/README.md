# Maquette du tableau de bord sur ordinateur — 50 écrans

Ouvrir `index.html` dans un navigateur. Version en ligne (privée) :
<https://claude.ai/artifact/WRuoVTKpwpyDfsYYZUddMc>

**Ce n'est pas du code de production.** Une page HTML autonome qui montre à quoi
ressemblerait le tableau de bord sur un écran d'ordinateur. Rien ici n'est destiné à être
importé dans `washboard/` : c'est un modèle à suivre, pas une bibliothèque.

## Le cadre

Alexandre, 2026-10-03 : la refonte porte sur **l'intérieur connecté uniquement**, en
version ordinateur. La vitrine publique (accueil, blog, pages métiers, inscription) ne
bouge pas.

Ça rouvre pour ce périmètre la décision du 2026-09-22 inscrite dans
`.claude/agents/refonte.md` (« le site, mobile ou ordinateur, reste v1 pixel pour pixel ;
seule la PWA installée voit la v2 »). Conséquence à traiter côté code : aujourd'hui la v2
est servie derrière `display-mode: standalone` **et** `washers.beta_refonte` ; un laveur
connecté depuis un navigateur de bureau devra la voir aussi.

## Ce que la maquette décide

**Les 5 destinations deviennent une colonne à gauche**, dans le même matériau de verre que
la barre du bas de la PWA, posé à la verticale. « Chiffres » redevient une destination à
part entière : son absence de la barre du bas mobile était une contrainte de pouce, pas une
décision de fond. **« Documents » est épinglé** sous les cinq, séparé par un filet
(Alexandre, 2026-10-03).

**La feuille qui monte du bas devient un panneau à côté.** Sur téléphone, ouvrir une fiche
cache la liste. Sur grand écran, liste à gauche et fiche à droite en permanence : on passe
d'un client à l'autre sans rien ouvrir ni refermer. C'est le geste « je revois mes clients
le soir » que le pouce ne permet pas.

**Le bleu est celui de la serviette du logo**, mesuré sur les pixels de
`washboard/public/LogoWashBoard.png` : `#306090` en clair (teinte dominante, 4361 px),
`#6E9FD0` en sombre (le `#306090` n'y fait que 2,7:1). Nouveau jeton nécessaire,
`--v2-color-sur-accent` : `#FFFFFF` en clair, `#0E1A26` en sombre — du blanc sur le bleu
clair retombe à 2,8:1 et paraît délavé. **Ce jeton est partagé avec la PWA** : le changer
change aussi le téléphone.

## Conventions du jeu de données

Julien Roussel / Éclat Mobile, Bordeaux, 18 clients. Il est en **offre Pro (49 €)** sur la
plupart des écrans — il facture, relance, demande des avis et fait de la publicité, toutes
fonctions réservées au Pro dans `washboard/src/lib/plan.ts`. Les six écrans qui montrent
justement une limite (45, 46, 48, 62, 65, 66) le repassent en **Starter** avec les vrais
chiffres (15 réservations, 19 €) ; ils portent `data-plan="starter"` et l'étiquette de la
colonne bascule toute seule.

Les numéros de documents suivent le format réel de `washboard/src/lib/documents.ts` :
`F-00038`, `D-00041` — préfixe et compteur sur cinq chiffres, sans l'année.

Les dates racontent un jeudi 3 octobre. Dans le vrai calendrier 2026 le 3 octobre est un
samedi : fiction assumée, cohérente d'un écran à l'autre.

Le `#1456D1` qu'on voit dans « Apparence de ma page » est la couleur de marque du laveur
fictif pour **sa** page de réservation — jamais celle de WashBoard.

## Ce que la maquette a révélé du produit

Quatre manques réels, trouvés en lisant le code pour dessiner :

1. **Le montant encaissé n'est pas modifiable à la clôture** d'un rendez-vous. Un client
   qui paie autrement que le prix prévu ne peut pas être enregistré
   (`ConfirmerClotureV2.tsx`).
2. **Une prestation ne peut pas être archivée.** Dès qu'elle a servi, elle ne se supprime
   plus et ne se masque pas — elle reste sur la page de réservation (`lib/prestation.ts`).
3. **L'email reste obligatoire pour un rendez-vous manuel**, alors que le plan CRM prévoit
   de le rendre facultatif : c'est ce qui débloque le rendez-vous pris par téléphone.
4. **Deux écrans dessinés n'existent pas** : « proposer un autre créneau » depuis une
   demande en attente, et la fiche en mode prospect. Ce sont des propositions, pas des
   captures de l'existant.

Et trois points où `.claude/agents/refonte.md` est périmé : « Créneaux intelligents » est
passé dans Clients › Automatismes le 2026-09-30 ; **Google Agenda** vit déjà dans Agenda
depuis le 2026-09-25 ; les **frais de déplacement** vivent déjà dans Mon profil depuis le
2026-09-30. Le document les liste encore comme « restant à replacer ».

## Comment elle a été vérifiée

Les 50 écrans affichés un par un en thème clair et sombre (100 captures) : aucune erreur
JavaScript, aucun écran manquant, aucun débordement horizontal, aucun écran occupant moins
de 45 % de la hauteur, et sur chacun le bon onglet surligné et la bonne offre affichée.

`CONTRAT.md` est la consigne commune suivie par les cinq agents qui ont dessiné les écrans
— utile si quelqu'un en ajoute un et veut qu'il ne jure pas avec les autres.
