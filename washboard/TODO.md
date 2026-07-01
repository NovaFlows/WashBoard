# WASHBOARD — TODO

> **Bloc-notes du projet (long terme).**
> Convention :
> - `[ ]` = à faire · `[x]` = fait (ajouter la date `AAAA-MM-JJ`)
> - Quand une tâche est terminée → la cocher + dater (la laisser dans la liste ou
>   la déplacer en bas dans « ✅ Fait »).
> - Toute nouvelle tâche découverte → l'ajouter dans la bonne section.
>
> Dernière mise à jour : 2026-06-29 (mission autonome : icônes, anti-spam, code mort, eslint, env)

---

## 🔴 Priorité haute

- [x] 2026-06-29 — **Anti-spam sur `POST /api/bookings`** (réservation publique) :
      honeypot (champ piège) + rate-limit par IP (8/10min, en mémoire) + plafond
      par laveur/jour (60/j). Rate-limit testé (9ᵉ requête → 429).
  - [ ] Amélioration future : rate-limit cross-instances (Upstash/Redis ou table)
        car la mémoire serverless n'est pas partagée entre instances.

- [x] 2026-06-30 — **FIX BUG PROD : double-réservation** (un client réservait un créneau
      déjà occupé). Diagnostic **vérifié empiriquement** (clé anon + clé service-role) :
      **VRAIE CAUSE = RLS**. La page publique `/book` lit les RDV existants avec le client
      **anonyme**, or la table `bookings` n'autorise la lecture qu'au propriétaire →
      `permission denied` → liste vide → **aucun créneau occupé n'était filtré** côté client.
      (Le calendrier du laveur, lui, est authentifié → voit ses RDV → bloque bien.)
      Corrigé sur 2 fronts :
      - **Page `/book`** : lecture des RDV occupés + indispos via le **service-role**
        (données NON personnelles : horaire + durée), pour que le filtre client fonctionne.
      - **Serveur `/api/bookings`** : barrière de sécurité (recompte conflits + capacité,
        409) — sauf le laveur (manuel = peut forcer). Logique pure testée
        (`countConflicts`, `effectiveTeamSize`) + test sur les **timestamps réels** du bug.
      - (Théorie initiale « embed services en tableau » écartée : l'embed est bien un objet.)
  - [ ] À vérifier : d'autres lectures publiques bloquées par la RLS ?
        (`unavailabilities` était aussi concerné → passé en service-role sur `/book`.)
  - [x] 2026-06-30 — **Batterie de tests calendrier** (lib/slots) : génération de créneaux,
        chevauchement, conflits, capacité (absences), temps de trajet (faisabilité),
        durée × véhicules, cas limites (back-to-back, bornes, repro du bug prod). 66 tests au total.

- [x] 2026-06-29 — **Remplacer TOUS les emojis/icônes "template IA" par des icônes sobres**
      (lucide-react). Passage projet entier fait :
  - [x] `admin/AdminTabs.tsx` : onglets → Palette / SprayCan / Calendar
  - [x] `booking/StepService.tsx` : Particulier/Pro → User / Building2
  - [x] `dashboard/ParametresForm.tsx` : cartes → User/Star/Mail/Lock/Link2/Palette + zone danger → Hourglass/PauseCircle/AlertTriangle
  - [x] `dashboard/CrmDashboard.tsx` : KPIs, empty state, filtres, avatar pro → lucide
  - [x] `admin/IdentiteForm.tsx` : toggle thème ☀️🌙 → Sun / Moon
  - [x] `⚠` inline (CalendrierDashboard, DashboardShell, DisponibilitesManager) → retirés
  - [x] DashboardShell (nav), AbonnementPanel, LandingPage : vérifiés, déjà propres
  - Note : laissés volontairement → emails (⭐ marketing), titres Google Calendar
    (🚗 ✅, utiles au laveur dans son agenda), close-buttons ✕/✓ (glyphes monochromes).
  - [x] 2026-06-30 — `pdf/BookingPDF.tsx` : c'était juste un ★ typographique
        (« ★ Créneau optimisé »), pas un emoji couleur → conservé, OK.

## 🟠 Robustesse / dette technique

- [~] **Code mort / legacy** — vérifié avant suppression :
  - [x] 2026-06-29 — `src/lib/scrapeReviews.ts` supprimé (aucun import, vrai code mort)
  - [x] 2026-06-30 — DÉCISION : on **garde** le flux « Réserver un appel »
        (`booking/page.tsx` + `api/booking/*` + `googleCalendar.ts`). Pas du code mort.
- [~] **Dette eslint pré-existante** (sans changer le comportement) :
  - [x] 2026-06-29 — Apostrophes non échappées (`react/no-unescaped-entities`) :
        IdentiteForm, ParametresForm, AbonnementPanel → corrigées
  - [x] 2026-06-29 — `Date.now()` pendant le render (DashboardShell) → capture via useState
  - [x] 2026-06-30 — DÉCISION : on **assume** les 7× `setState` dans `useEffect`
        (ThemeProvider, ThemeToggle, LandingPage, ComptaDashboard, StepSlot ×3).
        Patterns légitimes (fetch on mount, sync DOM), ne bloquent pas le build,
        existaient déjà avant. Won't-fix.
- [x] 2026-06-30 — **Base de tests + CI** posées :
  - Vitest configuré (`npm run test`), 20 tests sur la logique critique :
    `lib/plan.ts` (gating €), `lib/rateLimit.ts` (anti-spam), `lib/travelFee.ts`
    (helper pur `pickTravelFee` extrait + testé).
  - CI GitHub Actions (`.github/workflows/ci.yml`) : typecheck + lint + test + build
    à chaque push/PR.
  - Règle `react-hooks/set-state-in-effect` passée en `warn` (assumée).
  - [x] 2026-06-30 — Logique métier extraite en libs pures + testée :
        `lib/pricing.ts` (prix par type, remise « créneau optimisé », durée effective)
        et `lib/slots.ts` (génération de créneaux, chevauchement, fenêtres optimisées,
        faisabilité). StepService / StepSlot / API bookings recâblés dessus.
        44 tests au total.
  - [x] 2026-06-30 — **FIX BUG PROD** : « à partir de 30€ » au lieu de 120€. Cause :
        surcharge de prix « orpheline » (type désélectionné dont la surcharge restait
        dans le JSON) tirait le minimum vers le bas. Corrigé : le calcul ne regarde
        plus que les types réellement proposés ; et désélectionner un type supprime
        sa surcharge. Test de non-régression ajouté.
- [x] 2026-06-29 — **`.env.example`** documentant les 11 variables d'env (sans valeurs)
      + exception `.gitignore` pour le rendre traçable.

## 🟡 Roadmap produit

- [ ] **Stripe** : remplacer la facturation manuelle (PayPal/virement) par un
      abonnement automatisé + gestion des changements de plan + statut.
- [ ] **Phase 3 — Avis par SMS** (plans Pro/Business) : intégrer Brevo (compte +
      clé API à fournir), fonction `sendSms()`, compteur de quota mensuel + blocage.
- [ ] **Photos avant/après** : feature premium évidente pour laveurs/detailers.
- [ ] **QA #1** : vérifier le 404 `/book` d'un vrai compte (données/slug, pas du code).
- [x] 2026-06-30 — **QA #3** : vérifié manuellement → le clic sur une carte prestation
      fonctionne. C'était bien un **artefact Playwright** (clic synthétique), pas un bug.
  - [ ] Optionnel : ajouter des `data-testid` sur les cartes pour fiabiliser les
        futurs tests automatisés.

## 🏗️ Infra & environnements (quand il y aura de vrais clients)

> Aujourd'hui : dev (localhost) + prod suffisent. Vercel fournit déjà des Preview
> Deployments gratuits (URL auto par branche) = recette à la demande. PAS besoin
> d'environnement de recette/staging dédié à ce stade.

- [ ] **PRIORITÉ — Séparer la base de données dev / prod.** Aujourd'hui le local et
      la prod partagent le **même projet Supabase** → tester en local mute les vraies
      données, et une manip SQL touche directement la prod. À faire dès qu'il y a des
      utilisateurs réels : projet Supabase dédié au dev (ou Supabase Branching), avec
      des variables d'env distinctes local/prod.
- [ ] **Workflow branches + Preview (optionnel)** : pour les features risquées, créer
      une branche → Vercel génère une URL de preview → valider → merger sur master.
      Évite de pousser direct en prod sur du code chaud. (Pas obligatoire en solo.)
- [x] 2026-06-30 — **Le déploiement est bloqué par les tests** : Build Command Vercel
      = `npm run test && npm run lint && npm run build` (un échec bloque la mise en ligne).
- [ ] **Environnement de recette/staging dédié** : seulement quand il y aura une
      équipe / un testeur, ou des migrations risquées. Inutile avant.

## 🟢 Polish / UX

- [x] 2026-06-29 — **Page d'accueil dashboard** : vérifiée — déjà une vraie page
      (3 cartes stats En attente/Confirmés/Terminés + liste complète des RDV). Rien à faire.
      Amélioration possible plus tard : « RDV du jour » mis en avant, raccourcis rapides.
- [ ] **Accessibilité** : passe au-delà du `<h1>` déjà ajouté (focus, aria, contrastes).
- [ ] **États de chargement** harmonisés (skeletons / spinners cohérents).

---

## ✅ Fait

- [x] 2026-07-01 — **Modèle de véhicule par le client** : à la réservation, un champ
      texte libre optionnel par véhicule (ex. « Peugeot 208 grise »). Stocké dans
      `vehicles_detail.models` (JSONB, pas de SQL). Affiché côté laveur (liste RDV +
      calendrier), sur la confirmation client et le PDF.
- [x] 2026-07-01 — **Badge de plan dans le dashboard** : visible dans le header sur toutes
      les pages (Essentiel/Pro/Business, ou « Accès complet » si grandfathered), cliquable
      → page Abonnement.
- [x] 2026-07-01 — **Choix du slug** : le laveur édite son lien `/book/...` depuis
      Paramètres → Page client. Validation serveur (format + unicité), saisie filtrée.

- [x] 2026-06-29 — Slogan rotatif du hero (3 phrases animées)
- [x] 2026-06-29 — Page 404 personnalisée (`not-found.tsx`)
- [x] 2026-06-29 — Plafond serveur du nombre de laveurs (#16)
- [x] 2026-06-29 — Fix badge dev « Issue » (thème via cookie, plus de `<script>` React)
- [x] 2026-06-29 — Désactivation / suppression de compte (RGPD) + purge 30j (cron)
- [x] 2026-06-29 — Validation des formulaires + messages d'erreur stylés (rapport QA tour 3)
- [x] 2026-06-29 — Catégories de prestations personnalisables (+ types dynamiques)
- [x] 2026-06-29 — **Offres tarifaires** : 3 plans (Essentiel/Pro/Business) + gating + grandfathering
- [x] 2026-06-29 — **Suivi client** : demande d'avis Google par email (déclenchement sur « terminé » + délai + cron)

---

## 📌 SQL / config en attente (à exécuter en prod si pas déjà fait)

> Base locale = base de prod (même projet Supabase) au 2026-06-29.

- [ ] Vérifier que tout le SQL de la session est passé (catégories, GRANTs compta,
      account_status, plan + `grandfathered = true`, colonnes avis). Voir l'historique
      du chat pour le bloc consolidé.
- [ ] `CRON_SECRET` défini dans Vercel.
- [ ] Cron-job.org : `https://washboard.fr/api/cron/send-reviews` toutes les heures,
      header `Authorization: Bearer <CRON_SECRET>`.
