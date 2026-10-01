// Détection "PWA installée, en mode standalone" — la refonte 2026 (verre de
// châssis, jetons --v2-*, Archivo) ne s'applique QU'à cet état. Le site,
// ouvert dans un navigateur classique (mobile ou ordinateur), doit rester
// visuellement identique à la v1, sans exception (décision d'Alexandre,
// 2026-09-22).
//
// Même test que `NotificationsToggle.tsx` (repéré là pour un besoin
// différent : distinguer l'iPhone pas encore installé) — à ne pas
// réinventer différemment : `display-mode: standalone` couvre Android et
// ordinateur (Chrome/Edge « installer l'application »), `navigator.standalone`
// couvre Safari iOS où ce media feature n'existe pas.
//
// Fonction pure, sans état : utilisée par `usePwaStandalone` (hooks/) pour le
// cas où un écran change de FORME (JSX différent), et par le script
// synchrone de `layout.tsx` (même test, réécrit à la main car il tourne hors
// React, avant hydratation) pour le cas où seule l'habillage CSS change.
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    )
  } catch {
    return false
  }
}
