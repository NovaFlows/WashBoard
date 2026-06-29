# WASHBOARD — TODO

> **Bloc-notes du projet (long terme).**
> Convention :
> - `[ ]` = à faire · `[x]` = fait (ajouter la date `AAAA-MM-JJ`)
> - Quand une tâche est terminée → la cocher + dater (la laisser dans la liste ou
>   la déplacer en bas dans « ✅ Fait »).
> - Toute nouvelle tâche découverte → l'ajouter dans la bonne section.
>
> Dernière mise à jour : 2026-06-29

---

## 🔴 Priorité haute

- [x] 2026-06-29 — **Anti-spam sur `POST /api/bookings`** (réservation publique) :
      honeypot (champ piège) + rate-limit par IP (8/10min, en mémoire) + plafond
      par laveur/jour (60/j). Rate-limit testé (9ᵉ requête → 429).
  - [ ] Amélioration future : rate-limit cross-instances (Upstash/Redis ou table)
        car la mémoire serverless n'est pas partagée entre instances.

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
  - [ ] Reste : `pdf/BookingPDF.tsx` (1 emoji, react-pdf — à voir si on le retire)

## 🟠 Robustesse / dette technique

- [~] **Code mort / legacy** — vérifié avant suppression :
  - [x] 2026-06-29 — `src/lib/scrapeReviews.ts` supprimé (aucun import, vrai code mort)
  - [!] `src/app/booking/page.tsx` + `src/app/api/booking/*` + `src/lib/googleCalendar.ts`
        **PAS morts** : ils servent le flux « Réserver un appel » lié depuis la
        landing (LandingPage L148 & L465). NE PAS supprimer sans décision produit.
        → Si ce flux démo n'est plus voulu : retirer les 2 liens landing puis supprimer
          les 4 fichiers. Sinon, à laisser tel quel (ou migrer vers un vrai flux).
- [ ] **Corriger la dette eslint pré-existante** (sans changer le comportement) :
  - [ ] `ComptaDashboard` : `setState` synchrone dans un `useEffect`
  - [ ] Apostrophes non échappées (`react/no-unescaped-entities`) dans plusieurs fichiers
- [ ] **Aucun test automatisé** : poser une base de tests (au moins sur la logique
      critique : prix, créneaux, gating des plans, `hasFeature`).
- [ ] **`.env.example`** documentant les 11 variables d'env (sans valeurs).

## 🟡 Roadmap produit

- [ ] **Stripe** : remplacer la facturation manuelle (PayPal/virement) par un
      abonnement automatisé + gestion des changements de plan + statut.
- [ ] **Phase 3 — Avis par SMS** (plans Pro/Business) : intégrer Brevo (compte +
      clé API à fournir), fonction `sendSms()`, compteur de quota mensuel + blocage.
- [ ] **Photos avant/après** : feature premium évidente pour laveurs/detailers.
- [ ] **QA #1** : vérifier le 404 `/book` d'un vrai compte (données/slug, pas du code).
- [ ] **QA #3** : tester manuellement le clic sur les cartes prestation (artefact
      Playwright probable) ; éventuellement ajouter des `data-testid`.

## 🟢 Polish / UX

- [ ] **Page d'accueil dashboard** : si ce n'est qu'un redirect, en faire une vraie
      (RDV du jour, raccourcis, chiffres clés).
- [ ] **Accessibilité** : passe au-delà du `<h1>` déjà ajouté (focus, aria, contrastes).
- [ ] **États de chargement** harmonisés (skeletons / spinners cohérents).

---

## ✅ Fait

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
