'use client'

import { useState } from 'react'
import { Video } from 'lucide-react'
import { corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import FormationEnveloppeV2 from '@/components/dashboard/FormationEnveloppeV2'
import { quandTexte } from '@/components/dashboard/FormationV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { etatSession, sessionsAVenir, type SessionLive } from '@/lib/formation'

// Appels en direct (branche feat/formation, 2026-11-10) : séances de questions / réponses et
// ateliers animés par le formateur, dans WashBoard. L'inscription et « Rejoindre » sont des
// maquettes : l'état vit dans la page, rien n'est enregistré. Ce qui reste à décider (docs/
// FORMATION.md) : le service vidéo (Daily, LiveKit, Jitsi, Zoom SDK), les rappels (push + SMS la
// veille), l'enregistrement du direct pour ceux qui n'ont pas pu venir, le plafond de places.

const CARTE = 'rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)]'

export default function DirectsFormationV2({ liste, sessions, maintenantIso }: { liste: ReglagesListeProps; sessions: SessionLive[]; maintenantIso: string }) {
  const maintenant = new Date(maintenantIso)
  const aVenir = sessionsAVenir(sessions, maintenant)
  const [inscrites, setInscrites] = useState<ReadonlySet<string>>(new Set())
  const [essai, setEssai] = useState<string | null>(null)

  const basculer = (id: string) =>
    setInscrites(avant => { const s = new Set(avant); if (s.has(id)) s.delete(id); else s.add(id); return s })

  return (
    <FormationEnveloppeV2
      liste={liste}
      titre="Appels en direct"
      sousTitre="Posez vos questions au formateur, en direct"
      retour={{ href: '/dashboard/formation', label: 'Formation' }}
    >
      {aVenir.length === 0 && (
        <p className={`${CARTE} p-4 text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>Aucun appel n’est programmé pour le moment.</p>
      )}

      {aVenir.map(s => {
        const etat = etatSession(s, maintenant)
        const inscrit = inscrites.has(s.id)
        const ouvert = etat === 'en_cours' || etat === 'bientot'
        const placesRestantes = Math.max(0, s.places - s.inscrits - (inscrit ? 1 : 0))
        return (
          <div key={s.id} className={`${CARTE} p-4`}>
            <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{quandTexte(s.debutIso)} · {s.dureeMin} min</p>
            <p className={`mt-1 text-[16px] leading-snug ${titre}`}>{s.titre}</p>
            <p className={`mt-0.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Avec {s.animateur}</p>
            <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {etat === 'complet' && !inscrit ? 'Complet' : `${placesRestantes} place${placesRestantes > 1 ? 's' : ''} restante${placesRestantes > 1 ? 's' : ''}`}
            </p>

            <div className="mt-3">
              {ouvert ? (
                <button
                  type="button" onClick={() => setEssai(s.id)}
                  className={`flex h-11 w-full items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-color-encre)] px-4 text-[15px] ${corpsFort} text-[color:var(--v2-color-surface)] transition-transform active:scale-[.97]`}
                >
                  <Video size={17} strokeWidth={2} aria-hidden />
                  Rejoindre l’appel
                </button>
              ) : (
                <button
                  type="button" onClick={() => basculer(s.id)} disabled={etat === 'complet' && !inscrit}
                  className={`flex h-11 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-4 text-[15px] ${corpsFort} transition-transform active:scale-[.97] disabled:opacity-50`}
                >
                  {inscrit ? 'Inscrit ✓ (se désinscrire)' : 'Je m’inscris'}
                </button>
              )}
              {essai === s.id && (
                <p role="status" className={`mt-2 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                  Maquette : l’appel vidéo s’ouvrira ici, dans WashBoard, sans quitter l’application.
                </p>
              )}
            </div>
          </div>
        )
      })}

      <p className={`px-0.5 text-[12px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Vous serez prévenu par notification la veille et quelques minutes avant le début.
      </p>
    </FormationEnveloppeV2>
  )
}
