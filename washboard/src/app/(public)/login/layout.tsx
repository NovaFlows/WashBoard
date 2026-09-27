import type { Metadata } from 'next'

// `page.tsx` est un composant client ('use client', formulaire avec hooks) :
// `metadata` ne peut pas y être exporté. Sans ce layout, la page héritait du
// <title> de l'accueil défini dans layout.tsx racine.
export const metadata: Metadata = {
  title: 'Connexion | WashBoard',
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
