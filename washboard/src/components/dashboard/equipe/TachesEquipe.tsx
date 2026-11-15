'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { ASSIGNES, TITRE_MAX, concerne, type Assigne, type Idee, type Tache } from '@/lib/tachesEquipe'
import { Carte, Section } from './EcranEquipe'

// Tâches à faire de l'équipe : on en ajoute une pour Alexandre, Ryan ou Yanis,
// on la supprime (coche) une fois faite.

type Filtre = 'toutes' | Assigne

export default function TachesEquipe({ taches: initiales, actif, idees: ideesInitiales = [], ideesActives = false }: { taches: Tache[]; actif: boolean; idees?: Idee[]; ideesActives?: boolean }) {
  const [taches, setTaches] = useState(initiales)
  const [idees, setIdees] = useState(ideesInitiales)
  const [idee, setIdee] = useState('')
  const [envoiIdee, setEnvoiIdee] = useState(false)
  const [erreurIdee, setErreurIdee] = useState<string | null>(null)
  // Idée dont on choisit la personne à qui la confier, et son choix.
  const [transfert, setTransfert] = useState<string | null>(null)
  const [cible, setCible] = useState<Assigne>(ASSIGNES[0])

  async function ajouterIdee(e: React.FormEvent) {
    e.preventDefault()
    if (!idee.trim() || envoiIdee) return
    setEnvoiIdee(true); setErreurIdee(null)
    try {
      const r = await fetch('/api/support/idees', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titre: idee }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErreurIdee(j.error ?? 'Enregistrement impossible. Réessayez.'); return }
      setIdees(l => [...l, j.idee])
      setIdee('')
    } catch {
      setErreurIdee('Enregistrement impossible. Réessayez.')
    } finally {
      setEnvoiIdee(false)
    }
  }

  async function supprimerIdee(i: Idee) {
    setErreurIdee(null)
    const avant = idees
    setIdees(l => l.filter(x => x.id !== i.id))
    try {
      const r = await fetch(`/api/support/idees/${i.id}`, { method: 'DELETE' })
      if (!r.ok) throw new Error()
    } catch {
      setIdees(avant)
      setErreurIdee('Suppression impossible. Réessayez.')
    }
  }

  async function transferer(i: Idee) {
    setErreurIdee(null)
    try {
      const r = await fetch(`/api/support/idees/${i.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assigne_a: cible }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErreurIdee(j.error ?? 'Transfert impossible. Réessayez.'); return }
      setIdees(l => l.filter(x => x.id !== i.id))
      setTaches(l => [...l, j.tache])
      setTransfert(null)
    } catch {
      setErreurIdee('Transfert impossible. Réessayez.')
    }
  }
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const [titre, setTitre] = useState('')
  const [assigne, setAssigne] = useState<Assigne>(ASSIGNES[0])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const visibles = taches.filter(t => filtre === 'toutes' || concerne(t, filtre))

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
    <>
    <Section titre={`Tâches à faire${taches.length ? ` · ${taches.length}` : ''}`}>
      {!actif ? (
        <Carte className="px-4 py-4"><p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Les tâches ne sont pas encore activées en base.</p></Carte>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrer par membre">
            {(['toutes', ...ASSIGNES] as Filtre[]).map(f => (
              <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)} className={puce(filtre === f)}>
                {f === 'toutes' ? 'Toutes' : f} {f === 'toutes' ? taches.length : taches.filter(t => concerne(t, f)).length}
              </button>
            ))}
          </div>

          <Carte>
            {visibles.length === 0 ? (
              <p className={`px-4 py-4 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune tâche{filtre !== 'toutes' ? ` pour ${filtre === 'Équipe' ? 'l’équipe' : filtre}` : ''}.</p>
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
              value={assigne} onChange={e => setAssigne(e.target.value as Assigne)} aria-label="Attribuer à"
              className={`h-11 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14.5px] ${corps}`}
            >
              {ASSIGNES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button type="submit" disabled={!titre.trim() || envoi} className={`h-11 rounded-[var(--v2-radius-pilule)] bg-[color:var(--v2-color-encre)] px-5 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-surface)] disabled:opacity-40`}>
              Ajouter
            </button>
          </form>
          {erreur && <p role="alert" className={`text-[13px] ${corps} text-[color:var(--v2-color-rouge)]`}>{erreur}</p>}
        </div>
      )}
    </Section>

    <Section titre={`Idées${idees.length ? ` · ${idees.length}` : ''}`}>
      {!ideesActives ? (
        <Carte className="px-4 py-4"><p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Les idées ne sont pas encore activées en base.</p></Carte>
      ) : (
        <div className="space-y-3">
          <Carte>
            {idees.length === 0 ? (
              <p className={`px-4 py-4 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucune idée pour l’instant. Note ici ce qui n’est pas encore une tâche.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--v2-filet)]">
                {idees.map(i => (
                  <li key={i.id} className="px-4 py-3">
                    <p className={`break-words text-[14.5px] leading-snug ${corps}`}>{i.titre}</p>
                    {transfert === i.id ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          value={cible} onChange={e => setCible(e.target.value as Assigne)} aria-label="Attribuer à"
                          className={`h-11 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14.5px] ${corps}`}
                        >
                          {ASSIGNES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <button type="button" onClick={() => transferer(i)} className={`h-11 rounded-[var(--v2-radius-pilule)] bg-[color:var(--v2-color-encre)] px-4 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-surface)]`}>Créer la tâche</button>
                        <button type="button" onClick={() => setTransfert(null)} className={`h-11 px-2 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Annuler</button>
                      </div>
                    ) : (
                      <div className="mt-1 flex gap-1">
                        <button type="button" onClick={() => { setTransfert(i.id); setCible(ASSIGNES[0]) }} className={`h-11 pr-3 text-[13.5px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>Passer en tâche</button>
                        <button type="button" onClick={() => supprimerIdee(i)} aria-label={`Supprimer l’idée : ${i.titre}`} className={`h-11 px-3 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Supprimer</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Carte>

          <form onSubmit={ajouterIdee} className="flex flex-wrap gap-2">
            <input
              value={idee} onChange={e => setIdee(e.target.value)} maxLength={TITRE_MAX} placeholder="Nouvelle idée…" aria-label="Nouvelle idée"
              className={`h-11 min-w-0 flex-[1_1_220px] rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 text-[14.5px] ${corps}`}
            />
            <button type="submit" disabled={!idee.trim() || envoiIdee} className={`h-11 rounded-[var(--v2-radius-pilule)] bg-[color:var(--v2-color-encre)] px-5 text-[13.5px] ${corpsFort} text-[color:var(--v2-color-surface)] disabled:opacity-40`}>
              Ajouter
            </button>
          </form>
          {erreurIdee && <p role="alert" className={`text-[13px] ${corps} text-[color:var(--v2-color-rouge)]`}>{erreurIdee}</p>}
        </div>
      )}
    </Section>
    </>
  )
}
