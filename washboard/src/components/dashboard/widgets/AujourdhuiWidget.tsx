'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatHeure } from '@/lib/dateUtils'

// Aujourd'hui, par défaut — mais navigable au jour précédent ou suivant, sans
// quitter l'accueil. Le jour de départ (aujourd'hui) est rendu côté serveur,
// sans latence ; naviguer ailleurs va chercher ce jour-là à la demande
// (`/api/bookings/jour`), plutôt que de tout charger d'avance pour un widget
// qu'on regarde en un coup d'œil.
//
// Sur AUJOURD'HUI, on ne montre que ce qui reste à faire (en attente,
// confirmé) — un rendez-vous déjà clôturé n'a plus rien à demander. Sur un
// autre jour, la question change : on regarde ce qui s'est passé ou va se
// passer, donc tout sauf les annulés.

export type RdvDuJour = {
  id: string
  client_name: string
  scheduled_at: string
  services: { name: string } | null
  status: string
}

const STATUT_DOT: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-400',
  done: 'bg-slate-300 dark:bg-slate-600',
}

function decalerDate(iso: string, jours: number): string {
  const d = new Date(`${iso}T12:00:00Z`) // midi UTC : à distance de tout changement d'heure
  d.setUTCDate(d.getUTCDate() + jours)
  return d.toISOString().slice(0, 10)
}

export function AujourdhuiWidget({ bookings, dateDuJour }: { bookings: RdvDuJour[]; dateDuJour: string }) {
  const [date, setDate] = useState(dateDuJour)
  const [liste, setListe] = useState(bookings)
  const [chargement, setChargement] = useState(false)

  const estAujourdhui = date === dateDuJour

  async function allerA(nouvelleDate: string) {
    setDate(nouvelleDate)
    if (nouvelleDate === dateDuJour) {
      // Retour au jour de départ : les données de la page suffisent déjà,
      // inutile de redemander au serveur ce qu'on a déjà en main.
      setListe(bookings)
      return
    }
    setChargement(true)
    try {
      const res = await fetch(`/api/bookings/jour?date=${nouvelleDate}`)
      if (!res.ok) { setListe([]); return }
      const { data } = await res.json()
      setListe(data ?? [])
    } catch {
      setListe([])
    } finally {
      setChargement(false)
    }
  }

  const titre = estAujourdhui
    ? 'Aujourd’hui'
    : new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 transition-transform duration-150 [@media(hover:hover)]:hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => allerA(decalerDate(date, -1))}
          aria-label="Jour précédent"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 truncate text-center flex-1">
          {titre}
        </h2>
        <button
          type="button"
          onClick={() => allerA(decalerDate(date, 1))}
          aria-label="Jour suivant"
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      {!estAujourdhui && (
        <button
          type="button"
          onClick={() => allerA(dateDuJour)}
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity mb-2 -mt-1"
        >
          ← Revenir à aujourd’hui
        </button>
      )}

      {chargement ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Chargement…</p>
      ) : liste.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {estAujourdhui ? 'Rien de prévu aujourd’hui.' : 'Rien ce jour-là.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {liste.map(b => (
            <li key={b.id}>
              {/* Même adresse que la notification de nouvelle réservation :
                  ouvre directement la fiche dans le calendrier. */}
              <Link
                href={`/dashboard/calendrier?rdv=${b.id}`}
                className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUT_DOT[b.status] ?? 'bg-slate-300'}`} aria-hidden="true" />
                <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                  {formatHeure(new Date(b.scheduled_at))}
                </span>
                <span className="text-sm text-slate-800 dark:text-slate-200 truncate min-w-0">
                  {b.client_name}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate min-w-0 ml-auto">
                  {b.services?.name ?? 'Prestation'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
