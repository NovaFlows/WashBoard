'use client'

import { useSyncExternalStore } from 'react'
import { isDesignMobile, REQUETE_ECRAN_MOBILE } from '@/lib/designMobile'

// Design mobile ou ordinateur pour l'espace laveur (voir lib/designMobile.ts). Le serveur
// rend le design ordinateur ; le navigateur lit la vraie valeur dès le premier rendu, et
// suit les changements de taille (rotation, fenêtre redimensionnée).
function sAbonner(changer: () => void) {
  if (typeof window === 'undefined') return () => {}
  try {
    const mq = window.matchMedia(REQUETE_ECRAN_MOBILE)
    mq.addEventListener('change', changer)
    return () => mq.removeEventListener('change', changer)
  } catch {
    return () => {}
  }
}

export function useDesignMobile(): boolean {
  return useSyncExternalStore(sAbonner, isDesignMobile, () => false)
}
