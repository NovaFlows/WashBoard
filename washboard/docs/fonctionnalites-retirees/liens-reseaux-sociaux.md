# Liens Instagram et TikTok de WashBoard

**Avant** : deux icônes (Instagram, TikTok) en bas de l'ancien menu de côté, au-dessus de
« WashBoard · Espace laveur ». Icônes seules, zone cliquable de 44 × 44 px.

**Dans la V2** : absents de l'espace laveur. Ils restent sur le site public (pied de page de
la vitrine, `landing/vitrine/PiedDePage.tsx`).

**Source** : `washboard/src/components/dashboard/Sidebar.tsx` (commit `007d644`).
Les liens eux-mêmes sont toujours dans le code : `src/components/ui/socialLinks.tsx`
(`SOCIAL_LINKS`, nom, adresse et icône SVG).

## Code d'origine

```tsx
import { SOCIAL_LINKS } from '@/components/ui/socialLinks'

{/* Discret à dessein : c'est un menu de travail, pas une vitrine.
    Icônes seules (pas de libellé « Instagram »/« TikTok »), taille
    visuelle réduite (18/17px) dans une zone cliquable de 44x44 —
    assez pour un pouce, sans peser sur la hauteur du menu ni
    concurrencer les entrées de navigation au-dessus. */}
<div className="flex items-center justify-center gap-1">
  {SOCIAL_LINKS.map(social => (
    <a
      key={social.name}
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`WashBoard sur ${social.name}`}
      className="flex items-center justify-center w-11 h-11 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    >
      {social.icon}
    </a>
  ))}
</div>

<p className="text-xs text-slate-400 dark:text-slate-500 text-center">WashBoard · Espace laveur</p>
```

## Pour le reprendre

Les classes `slate-*` sont celles de l'ancienne direction artistique : à remplacer par les
couleurs V2 (`--v2-color-gris`, etc.). Emplacements possibles : bas de la liste « Plus »
(mobile) et bas du menu de côté (ordinateur).
