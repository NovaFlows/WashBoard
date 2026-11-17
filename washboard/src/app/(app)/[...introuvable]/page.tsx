import { notFound } from 'next/navigation'

// Adresse inconnue : vraie réponse 404 avec la page « introuvable » (deux mises en page racines,
// donc plus de 404 global automatique). Les pages existantes passent toujours avant.
export default function Introuvable() {
  notFound()
}
