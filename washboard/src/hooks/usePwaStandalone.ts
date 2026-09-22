'use client'

import { useEffect, useState } from 'react'
import { isPwaStandalone } from '@/lib/pwaStandalone'

// À utiliser quand un écran de la refonte 2026 change de FORME entre v1 et
// v2 (pas seulement de couleurs) — ex. ClientProfileModal, carte v1 vs
// feuille v2. Pour un changement purement visuel (couleurs, espacements,
// rayons), préférer la classe `wb-pwa` posée sur <html> par le script
// synchrone de `layout.tsx` : zéro flash, mais CSS seulement — ce hook, lui,
// ne peut savoir si on tourne dans la PWA installée qu'après le montage
// (aucun équivalent "cookie lu côté serveur" pour `display-mode`,
// contrairement au thème clair/sombre).
//
// Pattern "mounted" déjà établi dans le projet (ThemeToggle.tsx,
// NotificationsToggle.tsx) : tant que le composant n'est pas monté, on rend
// v1 par défaut — un flash v1→v2 bref au montage, côté PWA, est accepté,
// comme le reste du projet gère ce genre de détection client-only.
export function usePwaStandalone(): boolean {
  const [mounted, setMounted] = useState(false)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    setStandalone(isPwaStandalone())
    setMounted(true)
  }, [])

  return mounted && standalone
}
