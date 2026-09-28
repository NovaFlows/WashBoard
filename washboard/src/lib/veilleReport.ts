/** Nom du cookie qui met la question du catalogue (plafond de prestations) en attente — voir
 *  `/api/prestations/reporter` (qui le pose) et `(dashboard)/layout.tsx` (qui le lit). Extrait
 *  dans son propre fichier : un `route.ts` ne peut exporter que ses handlers HTTP et quelques
 *  clés de config, jamais une constante partagée (Next.js refuse de type-checker le reste). */
export const COOKIE_REPORT = 'wb_veille_reportee'
