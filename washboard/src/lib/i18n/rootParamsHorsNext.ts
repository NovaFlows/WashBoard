// Remplace `next/root-params` dans les tests (vitest.config.ts) : hors du compilateur Next, le vrai
// module lève une erreur à l'import. Aucune page pré-calculée ici, donc pas de langue d'adresse.
export async function langue(): Promise<string | undefined> {
  return undefined
}
