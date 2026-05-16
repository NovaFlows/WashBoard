# WashBoard

SaaS B2B pour laveurs auto mobiles. Abonnement 49€/mois. Pitch : "Tu laves des voitures. On gère le reste."

## Stack
- **Frontend + Backend :** Next.js (App Router)
- **BDD + Auth :** Supabase
- **Hébergement :** Vercel
- **Zones + distances :** Google Maps API
- **Emails :** Resend
- **Paiement abonnement :** Stripe

## Règles d'architecture
- Pas de n8n dans ce produit — automatisations codées directement dans Next.js
- n8n reste pour NovaFlows (prospection interne) uniquement

## V1 — Ce qu'on build
1. Page de réservation publique (lien personnalisé par laveur, sans compte client)
2. Groupement des créneaux par zone géographique

## V1 — Ce qu'on ne build PAS
- Paiement en ligne
- Photos avant/après
- Multi-employés
- Optimisation de tournée complexe

## Go-to-market
- Premier bêta testeur cible : Kooki Clean (contact existant)
- Commencer par la page de réservation = outil de démo commercial
