# Formation — onglet pour les laveurs inscrits (coquille)

Branche `feat/formation`, 2026-11-10. **Rien n'est en ligne** : l'onglet est une coquille jouable
avec un catalogue d'exemple, caché par défaut (voir « Accès »). À retravailler le 2026-11-11.

## Le projet

Le partenaire (Kookii Clean) fait des formations pour laveurs auto. WashBoard les met à
disposition des laveurs inscrits et prend **50 % de chaque vente**. Contenu : des **packs de
vidéos**, des **appels en direct** dans WashBoard, et du contenu **confidentiel** (pas de fuite).

## Ce que contient la branche

| Pièce | Où |
|---|---|
| Écran « Formation » : reprendre, prochain direct, packs | `FormationV2.tsx`, `/dashboard/formation` |
| Page d'un pack : objectifs, modules, leçons, progression | `PackFormationV2.tsx`, `/dashboard/formation/[slug]` |
| **Lecteur protégé** | `LecteurFormationV2.tsx`, `/dashboard/formation/[slug]/[leconId]` |
| Appels en direct : inscription, « Rejoindre » (maquette) | `DirectsFormationV2.tsx`, `/dashboard/formation/directs` |
| Jeton de lecture signé + filigrane | `lib/formationProtection.ts`, `POST /api/formation/lecture` |
| Calculs : durée, prix, progression, **partage 50/50 au centime** | `lib/formation.ts` |
| Qui voit l'onglet | `lib/formationAcces.ts` |
| Entrée : ligne « Formation » dans Réglages | `ReglagesV2.tsx` |

Le catalogue (`CATALOGUE_DEMO`, `SESSIONS_DEMO`) est un **exemple inventé** ; la progression vit
dans le navigateur (`useProgressionFormation`). Tout cela se remplace par des tables (plus bas)
sans changer les écrans. Tests : 33, dont le jeton (signature, expiration, falsification) et la
route (accès, limite de débit).

### Accès (variables d'environnement)

- `FORMATION_USER_IDS` : identifiants de comptes (séparés par des virgules) qui voient l'onglet. Sans
  elle, **personne** ne le voit : la ligne n'apparaît pas et les pages font `404`.
- `FORMATION_OUVERTE=1` : l'ouvre à tous les laveurs, le jour du lancement.
- `FORMATION_SECRET` : secret (24 caractères au moins) qui signe les jetons de lecture. Sans lui,
  la route répond `503` plutôt que de signer avec rien.

## Protéger les vidéos : ce qui est vrai

**Aucun site web ne peut empêcher une capture d'écran.** Un second téléphone qui filme l'écran
passe toujours. Ce qu'on peut faire, par ordre d'efficacité :

| Protection | Effet réel | Dans la coquille |
|---|---|---|
| **DRM** (Widevine / FairPlay) via un fournisseur vidéo | La capture d'écran système donne un écran noir sur Safari et la plupart des navigateurs ; impossible de télécharger le flux. **Le seul vrai verrou.** | Non : il faut un fournisseur |
| **Filigrane au nom du laveur** (e-mail, identifiant, heure), qui change de place | Une fuite se retrouve à son auteur : c'est **dissuasif et traçable**. Le laveur le sait. | **Oui** |
| URL de lecture **signée et courte** (2 min), renouvelée | Un lien copié ne sert plus ; impossible de le partager | **Oui** (jeton ; l'URL vidéo viendra du fournisseur) |
| Coupure de la lecture quand la fenêtre perd le focus | Gêne les outils de capture et le partage d'écran | **Oui** |
| Pas de menu contextuel, de téléchargement, de PiP, d'impression | Barrières basiques | **Oui** |
| Touche « Impr. écran » → presse-papiers vidé | Capture la plus naïve seulement | **Oui** |
| Une seule lecture à la fois par compte | Un compte partagé ne sert pas à deux | **À faire** |
| Contrat : interdiction de diffuser, sanction, résiliation | Le recours quand le reste a échoué | **À faire** |

À dire au partenaire sans promettre l'impossible : *« chaque lecture est marquée au nom du laveur
et les fuites sont traçables ; avec un fournisseur à DRM, la capture d'écran donne un écran noir. »*

### Fournisseur vidéo (à choisir)

Candidats à comparer demain (prix et fonctions à revérifier le jour du choix) : **VdoCipher**
(DRM pensé pour les formations), **Bunny Stream** (DRM + bon marché), **Mux** (liens signés, DRM),
**Cloudflare Stream** (liens signés, sans DRM), **Vimeo** (DRM sur certaines offres). Critères :
DRM oui/non, coût par minute vue et par Go stocké, filigrane dynamique côté lecteur, sous-titres,
API de liens signés, hébergement en UE. La route `/api/formation/lecture` est déjà l'endroit où
demander l'URL signée : le navigateur ne la connaît jamais avant.

## Appels en direct

Dans WashBoard, sans quitter l'application. Options : **Daily** (kit prêt à intégrer,
enregistrement), **LiveKit** (plus de contrôle), **Jitsi** (gratuit, à héberger), **Zoom Video SDK**
(connu des gens, plus cher). À prévoir : inscription + places, **rappels** par notification
(la veille et 15 min avant — l'infra push et SMS existe), **enregistrement** du direct pour ceux qui
n'ont pas pu venir (protégé comme une leçon), le « replay » dans le pack, une salle d'attente,
le chat, les questions levées à la main.

## Argent : partage 50/50

`partageVente()` coupe au centime (le centime impair va à WashBoard) : partenaire + WashBoard =
prix, toujours. Deux façons d'encaisser :

1. **Stripe Connect** (le partenaire a un compte lié ; chaque vente verse 50 % à lui, 50 % à nous,
   automatiquement). Propre, mais Stripe est **encore en mode test** (activation après la création
   de l'auto-entreprise, voir la mémoire du projet) et le partenaire doit passer l'ouverture de compte.
2. **WashBoard encaisse tout**, un relevé mensuel, un virement manuel au partenaire. Plus simple au
   départ, mais on porte la TVA et la facturation de tout.

Dans les deux cas : un **contrat de partenariat écrit** (durée, exclusivité, propriété des vidéos,
confidentialité, sortie), les **CGV** de la vente de contenu numérique (renonciation expresse au
droit de rétractation à l'accès), la **TVA**, la facture au laveur, et l'information RGPD sur le
filigrane et les logs de lecture. À faire passer par l'agent `legal`.

## Idées qui valent d'être gardées

- **« Formé par … »** sur la page de réservation publique d'un laveur qui a fini un pack : une
  preuve sociale pour ses clients, et une publicité pour la formation. C'est probablement l'idée
  qui rapporte le plus.
- **Attestation** de fin de pack (PDF au nom du laveur, avec un numéro vérifiable).
- **Reprise à la seconde** près, vitesse de lecture, sous-titres.
- **Notes personnelles** par leçon, **quiz** de fin de module, fiches PDF (filigranées elles aussi).
- **Questions au formateur** sous chaque leçon (une réponse utile bénéficie à tous).
- Un pack **inclus** dans l'offre Business, ou à prix réduit pour les Pro : un argument de plus pour monter en offre.
- **Aperçu gratuit** (`apercuGratuit`) : la première leçon visible sans achat, pour vendre le pack.
- Notification « nouvelle leçon » ; « vous n'avez pas repris depuis 5 jours ».
- Lien avec le produit : une leçon « fixer ses prix » qui ouvre la page Prestations de WashBoard.

## Schéma de données proposé (non créé)

À créer en SQL dans le chat, avec les `GRANT` explicites par rôle (voir la mémoire du projet) :

- `formations` : slug, titre, accroche, description, niveau, prix_cents, statut, partenaire_id, ordre.
- `formation_modules` : formation_id, titre, ordre.
- `formation_lecons` : module_id, titre, type, duree_sec, ordre, apercu_gratuit, video_ref (identifiant chez le fournisseur).
- `formation_achats` : washer_id, formation_id, prix_cents, part_partenaire_cents, stripe_ref, achete_le, rembourse_le.
- `formation_progression` : washer_id, lecon_id, termine_le, position_sec.
- `formation_directs` : titre, animateur, debut, duree_min, places, formation_id (facultatif), replay_ref.
- `formation_inscriptions_directs` : direct_id, washer_id, inscrit_le.
- `formation_lectures` : washer_id, lecon_id, debut, ip_hash — le **journal de lecture**, pour retrouver l'origine d'une fuite.
- `partenaires` : nom, contact, part_pourcent (50), stripe_account_id.

## Questions ouvertes pour demain

1. **Où vit l'onglet ?** Aujourd'hui dans Réglages (la barre du bas est figée à 4 destinations).
   Une destination à part entière change la refonte : à trancher avec Alexandre.
2. **Quel fournisseur vidéo**, donc avec ou sans DRM ?
3. **Stripe Connect ou encaissement WashBoard** ? (dépend de l'activation de Stripe live)
4. **Prix et modèle** : achat unique par pack, abonnement, inclus dans une offre ?
5. **Qui est le formateur** dans l'application : le nom du partenaire, sa photo, sa marque ?
6. **Exclusivité** : le partenaire peut-il vendre les mêmes vidéos ailleurs ?
7. Faut-il un **espace côté partenaire** (téléverser ses vidéos, voir ses ventes) ou est-ce l'équipe qui s'en charge ?
8. **Remboursement** : délai, et que devient le partage déjà versé ?
