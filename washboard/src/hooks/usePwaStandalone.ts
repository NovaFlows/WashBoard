'use client'

import { useSyncExternalStore } from 'react'
import { isPwaStandalone } from '@/lib/pwaStandalone'

// À utiliser quand un écran de la refonte 2026 change de FORME entre v1 et
// v2 (pas seulement de couleurs) — ex. ClientProfileModal, carte v1 vs
// feuille v2. Pour un changement purement visuel (couleurs, espacements,
// rayons), préférer la classe `wb-pwa` posée sur <html> par le script
// synchrone de `layout.tsx` : zéro flash, mais CSS seulement.
//
// `useSyncExternalStore` plutôt que « état + effet » (pattern « mounted »
// d'origine) : le serveur rend toujours v1 (`false`), mais côté navigateur la
// vraie valeur est lue dès le premier rendu. Quand on navigue DANS l'application
// (toucher « Agenda » dans la barre du bas), l'écran se monte directement en v2 :
// plus de v1 entrevu pendant une image, comme signalé par Alexandre le
// 2026-09-25. Au chargement complet d'une page (ouverture de l'application), la
// première image reste celle du serveur (v1) le temps de l'hydratation.
const sAbonner = () => () => {}

export function usePwaStandalone(): boolean {
  return useSyncExternalStore(sAbonner, isPwaStandalone, () => false)
}
