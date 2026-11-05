# Détail de chaque véhicule d'un rendez-vous

**Avant** : dans la fiche d'un rendez-vous (ancien agenda et ancienne liste de l'accueil),
une ligne par véhicule, avec l'icône voiture :

```
SUV — Tiguan
Citadine — Peugeot 208 grise
Citadine × 1
```

Le type, le modèle saisi par le client, et le nombre restant quand certains modèles
n'étaient pas saisis.

**Dans la V2** : la ligne de prestation affiche « prestation · premier modèle », suivie de
« +N » s'il y a plusieurs véhicules (« Lavage complet · Peugeot 208 +2 »). Sans modèle, la
catégorie s'affiche à la place. Le détail complet n'est plus que dans l'email de nouvelle
réservation reçu par le laveur. Voir `modeleVehicule` et `lignePrestation` dans
`src/components/dashboard/CalendrierDashboardV2.tsx`.

**Source** : `washboard/src/components/dashboard/CalendrierDashboardV1.tsx`, fiche du
rendez-vous sélectionné, et le même bloc dans `washboard/src/components/dashboard/BookingList.tsx`
(commit `007d644`).

## Code d'origine

```tsx
import { VEHICLE_LABELS } from '@/lib/vehicle-labels'

{selected.vehicles_detail && selected.vehicles_detail.length > 0 && (
  <Row icon="car">
    {selected.vehicles_detail.flatMap(v => {
      const label = v.label ?? VEHICLE_LABELS[v.type] ?? v.type
      const mdls = (v.models ?? []).map(m => m.trim()).filter(Boolean)
      if (mdls.length === 0) return [`${label} × ${v.count}`]
      const lines = mdls.map(m => `${label} — ${m}`)
      if (mdls.length < v.count) lines.push(`${label} × ${v.count - mdls.length}`)
      return lines
    }).map((line, i) => <span key={i} className="block">{line}</span>)}
  </Row>
)}
```

`Row` était un composant local de l'ancien agenda (icône à gauche, contenu à droite).
`VEHICLE_LABELS` existe toujours dans `src/lib/vehicle-labels.ts`.

## Pour le reprendre

La donnée est déjà chargée par l'agenda V2 (`vehicles_detail` sur chaque réservation). Il
suffit d'ajouter le bloc dans la fiche du rendez-vous V2 (mobile et panneau ordinateur).
