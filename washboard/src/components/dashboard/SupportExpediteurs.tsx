'use client'

import { useCallback, useEffect, useState } from 'react'

type Demande = {
  id: string
  name: string
  slug: string | null
  sms_sender: string | null
  sms_sender_statut: 'en_attente' | 'approuve' | 'refuse'
}

const LIBELLE: Record<Demande['sms_sender_statut'], string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
}

export default function SupportExpediteurs() {
  const [demandes, setDemandes] = useState<Demande[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)

  const charger = useCallback(async () => {
    try {
      const res = await fetch('/api/support/expediteurs')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErreur(body.error || 'Impossible de charger les demandes.')
        return
      }
      setErreur(null)
      setDemandes(body.demandes ?? [])
    } catch {
      setErreur('Impossible de charger les demandes.')
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  async function decider(id: string, decision: 'approuve' | 'refuse') {
    setEnCours(id)
    setErreur(null)
    const res = await fetch(`/api/support/expediteurs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErreur(body.error || 'Enregistrement impossible.')
    }
    setEnCours(null)
    charger()
  }

  if (demandes === null && !erreur) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Chargement…</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Approuvez un nom seulement après validation chez Brevo. Tant qu’il n’est pas approuvé, les SMS partent avec WashBoard.
      </p>
      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}
      {demandes && demandes.length === 0 && !erreur && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Aucune demande pour l’instant.</p>
      )}
      {demandes && demandes.length > 0 && (
        <ul className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          {demandes.map(d => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-[10rem]">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{d.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nom demandé : {d.sms_sender ?? '—'}</p>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  d.sms_sender_statut === 'en_attente'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                    : d.sms_sender_statut === 'approuve'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {LIBELLE[d.sms_sender_statut]}
              </span>
              {d.sms_sender_statut === 'en_attente' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={enCours === d.id}
                    onClick={() => decider(d.id, 'approuve')}
                    className="px-3 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-40"
                  >
                    Approuver
                  </button>
                  <button
                    type="button"
                    disabled={enCours === d.id}
                    onClick={() => decider(d.id, 'refuse')}
                    className="px-3 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40"
                  >
                    Refuser
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
