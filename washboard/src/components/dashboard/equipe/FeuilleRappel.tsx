'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock } from 'lucide-react'
import { Feuille, BOUTON, ETIQUETTE, PRESSION, corpsFort } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression } from '@/components/dashboard/PrestationsUiV2'
import ChoixDate, { dateJour } from './ChoixDate'

// Décaler ou supprimer un rappel depuis une liste « à rappeler » (laveurs et prospects),
// sans ouvrir la fiche (Alexandre, 2026-11-07). Chaque liste fournit ses deux envois.

async function envoyer(url: string, method: 'PATCH' | 'DELETE', corps?: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: corps ? JSON.stringify(corps) : undefined })
    if (res.ok) return null
    const r = await res.json().catch(() => ({}))
    return r.error ?? 'Enregistrement impossible. Réessayez.'
  } catch {
    return 'Enregistrement impossible. Vérifiez votre connexion.'
  }
}

/** Rappel d'un laveur (ligne du suivi des appels). Supprimer : une simple mise « À rappeler »
 *  disparaît ; un vrai appel reste dans l'historique, seule sa date de relance s'efface. */
export function rappelLaveur(r: { appelId: string; action: string | null; mise: boolean }) {
  const url = `/api/support/appels/${r.appelId}`
  return {
    decaler: (date: string) => envoyer(url, 'PATCH', { relancer_le: date, prochaine_action: r.action }),
    supprimer: () => r.mise ? envoyer(url, 'DELETE') : envoyer(url, 'PATCH', { relancer_le: null, prochaine_action: r.action }),
  }
}

/** Rappel d'un prospect : sa date de rappel. Supprimer la vide (il passe dans « Sans date de rappel »). */
export function rappelProspect(id: string) {
  const url = `/api/support/prospects/${id}`
  return {
    decaler: (date: string) => envoyer(url, 'PATCH', { relancer_le: date }),
    supprimer: () => envoyer(url, 'PATCH', { relancer_le: '' }),
  }
}

/** Bouton à droite d'une ligne : ouvre la feuille de rappel. */
export function BoutonRappel({ onClick, libelle }: { onClick: () => void; libelle: string }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={libelle} title="Décaler ou supprimer le rappel"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] hover:bg-[color:var(--v2-filet)]/60"
    >
      <CalendarClock size={19} strokeWidth={2} aria-hidden />
    </button>
  )
}

export default function FeuilleRappel({ nom, le, now, lienFiche, decaler, supprimer, onClose }: {
  nom: string
  /** Date du rappel actuel, AAAA-MM-JJ. */
  le: string
  now: Date
  lienFiche?: string
  /** Renvoient le message d'erreur, ou null. */
  decaler: (date: string) => Promise<string | null>
  supprimer: () => Promise<string | null>
  onClose: () => void
}) {
  const router = useRouter()
  const [date, setDate] = useState(le)
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [suppression, setSuppression] = useState(false)

  async function agir(action: () => Promise<string | null>) {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    const e = await action()
    setEnCours(false)
    if (e) { setErreur(e); return }
    router.refresh()
    onClose()
  }

  if (suppression) {
    return (
      <ConfirmationSuppression
        titre="Supprimer ce rappel ?" texte={`${nom} ne sera plus dans la liste à rappeler.`}
        enCours={enCours} erreur={erreur} onConfirmer={() => void agir(supprimer)} onClose={() => setSuppression(false)}
      />
    )
  }
  return (
    <Feuille
      titre={nom}
      sousTitre={`Prévu le ${dateJour(le)}`}
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <button
            type="button" onClick={() => void agir(() => decaler(date))} disabled={enCours || !date || date === le}
            className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)] disabled:opacity-50`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            {enCours ? 'Enregistrement…' : date && date !== le ? `Décaler au ${dateJour(date)}` : 'Décaler'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className={ETIQUETTE}>Décaler l’appel au</p>
          <ChoixDate valeur={date} onChange={setDate} now={now} avecAujourdhui />
        </div>
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => setSuppression(true)} className={`text-[14px] ${corpsFort}`} style={{ color: 'var(--v2-color-rouge)' }}>
            Supprimer ce rappel
          </button>
          {lienFiche && <Link href={lienFiche} className={`text-[14px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>Ouvrir la fiche</Link>}
        </div>
      </div>
    </Feuille>
  )
}
