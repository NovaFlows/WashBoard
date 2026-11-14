'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { EQUIPE, type Responsable } from '@/lib/responsables'
import { TITRE_MAX, type Tache } from '@/lib/tachesEquipe'
import { Carte, Section } from './EcranEquipe'

// Tâches à faire de l'équipe : on en ajoute une pour Alexandre, Ryan ou Yanis,
// on la supprime (coche) une fois faite.

type Filtre = 'toutes' | Responsable

export default function TachesEquipe({ taches: initiales, actif }: { taches: Tache[]; actif: boolean }) {
  const [taches, setTaches] = useState(initiales)
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [titre, setTitre] = useState('')
  const [assigne, setAssigne] = useState<Responsable>(EQUIPE[0])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const visibles = taches.filter(t => filtre === 'toutes' || t.assigne_a === filtre)

  async function ajouter(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim() || envoi) return
    setEnvoi(true); setErreur(null)
    try {
      const r = await fetch('/api/support/taches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titre, assigne_a: assigne }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErreur(j.error ?? 'Enregistrement impossible. Réessayez.'); return }
      setTaches(t => [...t, j.tache])
      setTitre('')
    } catch {
      setErreur('Enregistrement impossible. Réessayez.')
    } finally {
      setEnvoi(false)
    }
  }

  async function terminer(t: Tache) {
    setErreur(null)
    const avant = taches
    setTaches(l => l.filter(x => x.id !== t.id))
    try {
      const r = await fetch(`/api/support/taches/${t.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
    } catch {
      setTaches(avant)
      setErreur('Suppression impossible. Réessayez.')
    }
  }

  return (
    <Section titre={`Tâches à faire${taches.length ? ` · ${taches.length}` : ''}`}>
      {!actif ? (
        <Carte className="px-4 py-4"><p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Les tâches ne sont pas encore activées en base.</p></Carte>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrer par membre">
            {(['toutes', ...EQUIPE] as Filtre[]).map(f => (
              <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)} className={puce(filtre === f)}>
                {f === 'toutes' ? 'Toutes' : f} {f === 'toutes' ? taches.length : taches.filter(t => t.assigne_a === f).length}
              </button>
            ))}
          </div>

          <Carte>
            {visibles.length === 0 ? (
              <p className={`px-4 py-4 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune tâche{filtre !== 'toutes' ? ` pour ${filtre}` : ''}.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--v2-filet)]">
                {visibles.map(t => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                    <button type="button" onClick={() => terminer(t)} aria-label={`Terminer et supprimer : ${t.titre}`} className="flex h-11 w-11 shrink-0 items-center justify-center -ml-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--v2-filet-fort)] text-transparent hover:text-[color:var(--v2-color-gris)]">
                        <Check size={14} strokeWidth={2.5} aria-hidden />
                      </span>
                    </button>
                    <span className={`min-w-0 flex-1 break-words text-[14.5px] leading-snug ${corps}`}>{t.titre}</span>
                    <span className={`shrink-0 text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{t.assigne_a}</span>
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <form onSubmit={ajouter} className="flex flex-wrap gap-2">
            <input
              value={titre} onChange={e => setTitre(e.target.value)} maxLength={TITRE_MAX} placeholder="Nouvelle tâche…" aria-label="Nouvelle tâche"
              className={`h-11 min-w-0 flex-[1_1_220px] rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14.5px] ${corps}`}
            />
            <select
              value={assigne} onChange={e => setAssigne(e.target.value as Responsable)} aria-label="Attribuer à"
              className={`h-11 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14.5px] ${corps}`}
            >
              {EQUIPE.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button type="submit" disabled={!titre.trim() || envoi} className={`h-11 rounded-[var(--v2-radius-pilule)] bg-[color:var(--v2-color-encre)] px-5 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-surface)] disabled:opacity-40`}>
              Ajouter
            </button>
          </form>
          {erreur && <p role="alert" className={`text-[13px] ${corps} text-[color:var(--v2-color-rouge)]`}>{erreur}</p>}
        </div>
      )}
    </Section>
  )
}
