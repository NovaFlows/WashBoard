'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Supprime une facture importée par erreur (mauvais fichier, doublon). Les
 *  factures émises par WashBoard, elles, ne se suppriment jamais : une facture
 *  émise ne s'efface pas, elle s'annule par un avoir. */
export function SupprimerFactureImportee({ id, nom }: { id: string; nom: string }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState(false)

  async function supprimer() {
    if (!confirm(`Supprimer la facture importée « ${nom} » ? Le fichier sera effacé.`)) return
    setEnCours(true)
    const res = await fetch(`/api/factures/importees/${id}`, { method: 'DELETE' })
    setEnCours(false)
    if (res.ok) router.refresh()
    else alert('La suppression a échoué. Réessayez dans un instant.')
  }

  return (
    <button
      type="button"
      onClick={supprimer}
      disabled={enCours}
      aria-label={`Supprimer la facture importée ${nom}`}
      className="text-sm text-slate-400 hover:text-red-600 disabled:opacity-40 transition-colors"
    >
      Supprimer
    </button>
  )
}
