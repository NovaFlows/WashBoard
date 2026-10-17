'use client'

import { useEffect, useState } from 'react'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'

// La carte de fidélité du client, dans sa fiche : où il en est, la récompense qui l'attend,
// et deux boutons pour ajouter ou retirer un tampon (un lavage payé hors WashBoard, une
// erreur…). Rien ne s'affiche si le laveur n'a pas de carte de fidélité.

type Etat = { active: boolean; progression?: number; requis?: number; disponibles?: number; phrase?: string }

export default function FideliteClientV2({ cle }: { cle: string }) {
  const [etat, setEtat] = useState<Etat | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const adresse = `/api/clients/${encodeURIComponent(cle)}/fidelite`

  useEffect(() => {
    let annule = false
    fetch(adresse).then(r => (r.ok ? r.json() : null)).then(j => { if (!annule && j) setEtat(j) }).catch(() => {})
    return () => { annule = true }
  }, [adresse])

  async function ajuster(delta: 1 | -1) {
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(adresse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }) })
      const json = await res.json().catch(() => null)
      if (!res.ok) { setErreur(json?.error ?? 'La modification a échoué.'); return }
      setEtat(json)
    } catch {
      setErreur('La modification a échoué. Vérifiez votre connexion.')
    } finally {
      setEnCours(false)
    }
  }

  if (!etat?.active || etat.requis === undefined) return null
  const bouton = `flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--v2-filet-fort)] text-[18px] ${corpsFort} disabled:opacity-40`
  return (
    <div className="mt-4 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[14px] ${corpsFort}`}>
            Fidélité · {etat.progression} / {etat.requis}
            {(etat.disponibles ?? 0) > 0 && <span style={{ color: 'var(--v2-color-vert)' }}> · {etat.disponibles} récompense{(etat.disponibles ?? 0) > 1 ? 's' : ''} disponible{(etat.disponibles ?? 0) > 1 ? 's' : ''}</span>}
          </p>
          <p className={`mt-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{etat.phrase}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => ajuster(-1)} disabled={enCours} aria-label="Retirer un tampon" className={bouton}>−</button>
          <button type="button" onClick={() => ajuster(1)} disabled={enCours} aria-label="Ajouter un tampon" className={bouton}>+</button>
        </div>
      </div>
      {erreur && <p role="alert" className={`mt-2 text-[12.5px] ${corps}`} style={{ color: 'var(--v2-color-rouge)' }}>{erreur}</p>}
    </div>
  )
}
