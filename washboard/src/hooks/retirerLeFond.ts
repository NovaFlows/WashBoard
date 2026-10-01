// Détourage du logo, dans le téléphone (`@imgly/background-removal` : un modèle
// lourd, téléchargé au premier usage — d'où le chargement dynamique, pour que ce
// paquet ne pèse jamais sur le reste de l'application). Même appel que l'ancien
// écran (`IdentiteForm.handleFile`). Isolé dans son module pour que `useApparenceV2`
// n'importe rien de lourd et que cette étape soit remplaçable en test.
export async function retirerLeFond(fichier: File): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  return removeBackground(fichier)
}
