# Mention « Créé par NovaFlows »

**Avant** : une ligne discrète tout en bas de l'ancien espace laveur, « Créé par NovaFlows »,
avec un lien vers https://novaflows.fr/realisations. Déjà absente de la version mobile et du
menu de côté sur ordinateur, qui n'ont pas de pied de page.

**Dans la V2** : pas de pied de page dans l'espace laveur. La mention reste sur le site public.

**Source** : `washboard/src/components/dashboard/DashboardShell.tsx`, bloc `<footer>`
(commit `007d644`).

## Code d'origine

```tsx
<footer className="max-w-3xl mx-auto px-3 sm:px-4 pb-6 text-center">
  <p className="text-xs text-slate-400 dark:text-slate-600">
    Créé par{' '}
    <a
      href="https://novaflows.fr/realisations"
      target="_blank"
      rel="noopener noreferrer"
      className="hover:text-blue-500 transition-colors font-medium"
    >
      NovaFlows
    </a>
  </p>
</footer>
```
