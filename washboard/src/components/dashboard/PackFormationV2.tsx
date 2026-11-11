'use client'

import Link from 'next/link'
import { Check, Circle, FileText, HelpCircle, Play } from 'lucide-react'
import { corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { TitreSection } from '@/components/dashboard/ParametresFormV2'
import FormationEnveloppeV2 from '@/components/dashboard/FormationEnveloppeV2'
import { BarreProgression } from '@/components/dashboard/FormationV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { useProgressionFormation } from '@/hooks/useProgressionFormation'
import { NIVEAUX, dureePack, dureeTexte, leconsDuPack, prixTexte, progressionPack, prochaineLecon, type PackFormation, type TypeLecon } from '@/lib/formation'

// Un pack : ce qu'on y apprend, puis ses modules et leurs leçons, dans l'ordre (branche
// feat/formation, 2026-11-10). L'achat n'est pas branché : le bouton principal ouvre la première
// leçon à faire. Quand les achats existeront, c'est ici que « Acheter » remplacera « Commencer »
// pour un laveur qui n'a pas le pack (seules les leçons `apercuGratuit` restent ouvertes).

const CARTE = 'rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)]'

const ICONE: Record<TypeLecon, React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  video: Play, lecture: FileText, quiz: HelpCircle,
}

export default function PackFormationV2({ liste, pack }: { liste: ReglagesListeProps; pack: PackFormation }) {
  const { termines } = useProgressionFormation()
  const pourcent = progressionPack(pack, termines)
  const suite = prochaineLecon(pack, termines)
  const total = leconsDuPack(pack).length
  const commence = pourcent > 0

  return (
    <FormationEnveloppeV2
      liste={liste}
      titre={pack.titre}
      sousTitre={`${NIVEAUX[pack.niveau]} · ${total} leçons · ${dureeTexte(dureePack(pack))}`}
      retour={{ href: '/dashboard/formation', label: 'Formation' }}
    >
      <p className={`text-[14.5px] leading-relaxed ${corps}`}>{pack.description}</p>

      <div>
        <TitreSection>Ce que vous saurez faire</TitreSection>
        <ul className={`${CARTE} divide-y divide-[color:var(--v2-filet)] px-4`}>
          {pack.objectifs.map(o => (
            <li key={o} className={`flex items-start gap-2.5 py-3 text-[14px] leading-snug ${corps}`}>
              <Check size={16} strokeWidth={2.2} aria-hidden className="mt-0.5 shrink-0 text-[color:var(--v2-color-accent)]" />
              {o}
            </li>
          ))}
        </ul>
      </div>

      {suite && (
        <div>
          <Link
            href={`/dashboard/formation/${pack.slug}/${suite.id}`}
            className={`flex h-11 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-color-encre)] px-4 text-[15px] ${corpsFort} text-[color:var(--v2-color-surface)] transition-transform active:scale-[.97]`}
          >
            {commence ? 'Reprendre' : 'Commencer'}
            {pack.prixCents > 0 && !commence ? ` · ${prixTexte(pack.prixCents)}` : ''}
          </Link>
          {commence && <div className="mt-3"><BarreProgression pourcent={pourcent} /></div>}
        </div>
      )}

      {pack.modules.map((m, i) => (
        <div key={m.id}>
          <TitreSection>{`${i + 1}. ${m.titre}`}</TitreSection>
          <ul className={`${CARTE} divide-y divide-[color:var(--v2-filet)] px-4`}>
            {m.lecons.map(l => {
              const fait = termines.has(l.id)
              const Icone = ICONE[l.type]
              return (
                <li key={l.id}>
                  <Link href={`/dashboard/formation/${pack.slug}/${l.id}`} className="flex min-h-[52px] items-center gap-3 py-2">
                    {fait
                      ? <Check size={18} strokeWidth={2.4} aria-label="Terminée" className="shrink-0 text-[color:var(--v2-color-accent)]" />
                      : <Circle size={18} strokeWidth={1.8} aria-hidden className="shrink-0 text-[color:var(--v2-filet-fort)]" />}
                    <span className={`min-w-0 flex-1 text-[14.5px] leading-snug ${fait ? corps : corpsFort}`}>{l.titre}</span>
                    <span className={`flex shrink-0 items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
                      <Icone size={13} strokeWidth={2} aria-hidden />
                      {dureeTexte(l.dureeSec)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      <p className={`px-0.5 text-[12px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        <span className={titre}>Contenu confidentiel.</span> Réservé aux laveurs inscrits ; toute diffusion est interdite.
      </p>
    </FormationEnveloppeV2>
  )
}
