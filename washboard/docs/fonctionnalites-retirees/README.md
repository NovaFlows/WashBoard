# Fonctionnalités d'avant, absentes de la V2

Ce dossier conserve ce que l'ancien espace laveur (V1) proposait et que la V2 ne reprend
pas. Ce n'est pas un oubli : la V2 a été pensée sans ces éléments. On les garde ici pour
pouvoir les reprendre si l'avis change, avec leur code d'origine.

Le nettoyage du 2026-11 (PR #24) n'a retiré que du code **périmé**, c'est-à-dire une
version antérieure d'un écran dont la V2 est en place. Ce qui n'a pas de remplaçant est
resté dans le code (voir « Gardé dans le code » plus bas).

## Récupérer le code complet

Chaque fiche donne l'extrait utile. Le fichier entier reste dans l'historique Git, au
commit de référence `007d644` (master du 2026-11-04, dernier état avec la V1) :

```bash
git show 007d644:washboard/src/components/dashboard/Sidebar.tsx
```

## Absentes de la V2

| Fonctionnalité | Où elle était | Fiche |
|---|---|---|
| Liens Instagram et TikTok de WashBoard | Ancien menu de côté | [liens-reseaux-sociaux.md](liens-reseaux-sociaux.md) |
| Détail de chaque véhicule d'un rendez-vous | Fiche du rendez-vous, ancien agenda | [detail-vehicules-rendez-vous.md](detail-vehicules-rendez-vous.md) |
| Compteurs « En attente » et « Confirmés » | Carte Statistiques, ancien accueil | [compteurs-accueil.md](compteurs-accueil.md) |
| Montant des lavages en attente (« 195 € ») | Bandeau, ancien accueil | [montant-en-attente-accueil.md](montant-en-attente-accueil.md) |
| Mention « Créé par NovaFlows » | Pied de page de l'ancien espace laveur | [mention-novaflows.md](mention-novaflows.md) |

## Déplacées ailleurs dans la V2 (pour mémoire)

| Avant | Maintenant |
|---|---|
| Configurateur des widgets de l'accueil | Accueil → Personnaliser (mêmes flèches, même enregistrement) |
| Deux premières sources de visite sur l'accueil | Chiffres → Acquisition |
| Navigation jour précédent / suivant sur l'accueil | Agenda, vue Jour |
| Badge de l'offre et déconnexion dans l'en-tête | Liste « Plus » et menu de côté sur ordinateur |
| Montant des lavages en attente | Page Clients (« 3 masqués · 266,64 € ») |
| Bouton « Imprimer » de la page de confirmation | Bouton « Télécharger PDF » de la page reçu |
| Code de confirmation d'inscription par email | Code par SMS |
| Bouton vert « Support » en bas à droite (WhatsApp de l'équipe) | Section Support dans WashBoard (Réglages, Guide → Assistance) |

## Gardé dans le code (sans remplaçant, donc non supprimé)

- Pages `/dashboard/crm`, `/compta`, `/admin`, `/parametres/tout` : plus de bouton d'accès,
  mais elles s'ouvrent en tapant l'adresse. Elles portent l'export Excel, la suppression de
  campagne, le Pixel Meta et les graphiques de l'ancien CRM.
- Routes `/api/bookings/historique` et `/api/bookings/jour` : plus aucun écran ne les appelle.
- `memoriserAttribution`, `attributionCourante`, `oublierAttribution`, `labelFormat`,
  `pixelCharge` : écrites, jamais branchées.
- Colonne `washers.beta_refonte` : plus lue.
