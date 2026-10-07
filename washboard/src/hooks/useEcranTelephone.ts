'use client'

import { useSyncExternalStore } from 'react'

// Même seuil que le reste du dashboard pour distinguer téléphone et ordinateur
// (`sm` de Tailwind, 640px — voir DashboardShell.tsx : `hidden sm:inline`, etc.),
// lu en JavaScript plutôt qu'en CSS : sert à décider si un COMPORTEMENT (pas
// juste un style) doit se déclencher — ex. le tuto PWA, qui cible la barre du
// bas (téléphone uniquement, la version ordinateur n'existe pas encore).
const REQUETE = '(max-width: 639px)'

function estTelephone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia(REQUETE).matches
  } catch {
    return false
  }
}

function sAbonner(f: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia(REQUETE)
  mq.addEventListener('change', f)
  return () => mq.removeEventListener('change', f)
}

export function useEcranTelephone(): boolean {
  return useSyncExternalStore(sAbonner, estTelephone, () => false)
}
