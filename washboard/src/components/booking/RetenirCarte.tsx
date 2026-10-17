'use client'

import { useEffect } from 'react'
import { cleStockageCarte } from '@/lib/fidelite'

/** Garde sur l'appareil du client le jeton de sa carte de fidélité chez ce laveur, pour lui
 *  montrer où il en est quand il revient sur la page de réservation (`RappelFidelite`).
 *  Stockage local seulement : jamais envoyé ailleurs, perdu sans conséquence. */
export default function RetenirCarte({ washerId, jeton }: { washerId: string; jeton: string }) {
  useEffect(() => {
    try { window.localStorage.setItem(cleStockageCarte(washerId), jeton) } catch { /* stockage refusé */ }
  }, [washerId, jeton])
  return null
}
