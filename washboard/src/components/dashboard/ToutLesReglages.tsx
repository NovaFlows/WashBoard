'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { isPwaStandalone } from '@/lib/pwaStandalone'

// « Tous les réglages » n'existe plus dans la PWA installée : chacun de ses blocs a maintenant
// son écran v2 (Alexandre, 2026-09-30 : « tous les réglages dans la pwa n'a pas été redessiné »).
// Cette route reste l'ancien formulaire complet sur le SITE (v1 sur le site, v2 seulement dans
// la PWA, décision du 2026-09-22) ; dans la PWA elle renvoie, selon l'ancre, vers l'écran qui
// a repris le bloc — pour qu'un vieux lien, un favori ou un guide n'y mène jamais un laveur.
//
// Trois états, comme les autres gardes : rien pendant la vérification, jamais de flash v1.
type Statut = 'verification' | 'pwa' | 'site'

const PROFIL = '/dashboard/parametres/profil'

export function destinationPwa(ancre: string): string {
  switch (ancre.replace(/^#/, '')) {
    case 'facturation': return `${PROFIL}#facturation`
    case 'avis':
    case 'relances': return '/dashboard/parametres/messages'
    case 'lien-reservation': return '/dashboard/parametres/liens'
    case 'personnalisation': return '/dashboard/parametres/apparence'
    case 'notifications': return '/dashboard/parametres/reglages#notifications'
    default: return PROFIL
  }
}

export default function ToutLesReglages({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [statut, setStatut] = useState<Statut>('verification')

  useEffect(() => {
    setStatut(isPwaStandalone() ? 'pwa' : 'site')
  }, [])

  useEffect(() => {
    if (statut === 'pwa') router.replace(destinationPwa(window.location.hash))
  }, [statut, router])

  return statut === 'site' ? <>{children}</> : null
}
