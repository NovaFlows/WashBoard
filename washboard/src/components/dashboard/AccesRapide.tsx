'use client'

import { KeyRound } from 'lucide-react'
import { ResultatAcces, useDemandeAcces } from '@/components/dashboard/SupportAccessForm'

// Bouton « Prendre la main sur son compte » d'une conversation de la boîte de
// l'équipe : le lien du laveur (`slug`) est déjà connu, inutile de le retaper.
// Rien de plus que le formulaire de la page Support : même route, qui refuse tout
// visiteur hors équipe et tout laveur n'ayant pas ouvert d'accès. Ce composant ne
// décide jamais d'un accès, il affiche la réponse.
export default function AccesRapide({ slug, nom }: { slug: string; nom: string }) {
  const { occupe, erreur, resultat, demander } = useDemandeAcces()
  if (!slug) return null
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void demander(slug)}
        disabled={occupe}
        aria-label={`Prendre la main sur le compte de ${nom}`}
        className="inline-flex min-h-11 items-center gap-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
      >
        <KeyRound size={16} aria-hidden />
        {occupe ? 'Vérification…' : 'Prendre la main sur son compte'}
      </button>
      <ResultatAcces erreur={erreur} resultat={resultat} />
    </div>
  )
}
