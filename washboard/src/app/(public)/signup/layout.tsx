import type { Metadata } from 'next'

// Même raison que login/layout.tsx : `page.tsx` est un composant client,
// il ne peut pas exporter `metadata` lui-même.
export const metadata: Metadata = {
  title: 'Inscription | WashBoard',
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
