'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Search } from 'lucide-react'
import { CHAMP, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { searchGuide, type GuideEntry } from '@/lib/guide'
import { lienV2 } from '@/lib/lienV2'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import { FilAriane } from '@/components/dashboard/ParametresFormV2'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'

// « Guide d'utilisation » — refonte 2026 (Alexandre, 2026-09-27 : « c'est la même qu'avant la
// refonte PWA »). Même contenu que le site, à la virgule près : `lib/guide.ts` reste la seule
// source. Ce qui change, c'est la façon de le lire sur un téléphone.
//
// Deux décisions de fond :
//
//  - les réponses sont REPLIÉES. L'écran du site les déroule toutes : trente réponses bout à
//    bout font un mur qu'on ne lit pas, et la recherche devient le seul chemin praticable.
//    Ici on voit les questions, on ouvre celle qu'on se pose. Une recherche, elle, ouvre
//    d'office ce qu'elle trouve — on ne va pas faire retaper un tap sur trois résultats ;
//  - les liens des réponses sont traduits vers les écrans v2 (`lienV2`) : le guide envoyait
//    vers `/dashboard/admin`, c'est-à-dire hors de l'application refaite.
//
// « Poser une question » ne réimplémente pas le panneau du site : il renvoie vers « Aide et
// assistance », l'écran v2 qui porte déjà ce canal.

/** Une réponse, avec ses liens en ligne `[libellé](/chemin)` traduits pour l'application. */
function Reponse({ texte }: { texte: string }) {
  const morceaux: React.ReactNode[] = []
  const motif = /\[([^\]]+)\]\(([^)]+)\)/g
  let dernier = 0
  let m: RegExpExecArray | null

  while ((m = motif.exec(texte)) !== null) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index))
    morceaux.push(
      <Link
        key={`${m.index}-${m[2]}`}
        href={lienV2(m[2])}
        className={corpsFort}
        style={{ color: 'var(--v2-color-accent)' }}
      >
        {m[1]}
      </Link>,
    )
    dernier = m.index + m[0].length
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier))

  return (
    <p className={`pb-3.5 text-[14px] leading-relaxed ${corps} text-[color:var(--v2-color-gris)]`}>
      {morceaux}
    </p>
  )
}

function Question({ entree, ouverte, onBasculer }: {
  entree: GuideEntry
  ouverte: boolean
  onBasculer: () => void
}) {
  return (
    <li id={entree.id}>
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouverte}
        className="flex w-full items-center gap-3 py-3.5 text-left"
      >
        <span className={`min-w-0 flex-1 text-[15px] leading-snug ${corpsFort}`}>{entree.question}</span>
        <svg
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className="shrink-0 transition-transform motion-reduce:transition-none"
          style={{ color: 'var(--v2-color-gris)', transform: ouverte ? 'rotate(90deg)' : 'none' }}
        >
          <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
        </svg>
      </button>
      {ouverte && <Reponse texte={entree.answer} />}
    </li>
  )
}

type Props = {
  /** Liste « Plus », affichée à gauche sur grand écran (voir `ListeReglagesV2.tsx`). */
  liste: ReglagesListeProps
}

export default function GuideV2({ liste }: Props) {
  const grandEcran = useGrandEcran()
  const [recherche, setRecherche] = useState('')
  const [ouvertes, setOuvertes] = useState<string[]>([])

  const sections = useMemo(() => searchGuide(recherche), [recherche])
  const total = sections.reduce((n, s) => n + s.entries.length, 0)
  const cherche = recherche.trim().length > 0

  // Arrivée par une ancre (« En savoir plus » du bandeau bêta, un lien d'un autre écran) :
  // on ouvre la réponse visée et on l'amène sous les yeux. Le navigateur ne sait pas le
  // faire seul ici, la page est rendue par le navigateur et l'ancre est cherchée avant que
  // les réponses n'existent.
  useEffect(() => {
    const ancre = window.location.hash.slice(1)
    if (!ancre) return
    setOuvertes([ancre])
    const t = requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById(ancre)?.scrollIntoView({ block: 'start' })),
    )
    return () => cancelAnimationFrame(t)
  }, [])

  const basculer = (id: string) =>
    setOuvertes(l => (l.includes(id) ? l.filter(x => x !== id) : [...l, id]))

  const contenu = (
    <div className={grandEcran ? '[font-family:var(--font-archivo)]' : 'max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]'}>
      {grandEcran ? (
        <div className="pb-3">
          <FilAriane label="Réglages" href="/dashboard/parametres/reglages" />
          <h1 className={`text-[20px] leading-none ${titre}`}>Guide d’utilisation</h1>
          <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Comment marche WashBoard, question par question
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1 pb-2">
          <Link
            href="/dashboard/parametres"
            aria-label="Retour à Plus"
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
          >
            <ChevronLeft size={22} strokeWidth={2} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className={`text-[24px] leading-none ${titre}`}>Guide d’utilisation</h1>
            <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
              Comment marche WashBoard, question par question
            </p>
          </div>
        </div>
      )}

      <div className="relative mt-1">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--v2-color-gris)]"
        />
        <input
          type="search"
          inputMode="search"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Congés, tarifs, avis Google…"
          aria-label="Rechercher dans le guide"
          className={`${CHAMP} pl-10`}
        />
      </div>

      {/* La vidéo du tutoriel, comme sur le site. Masquée dès qu'on cherche : on veut la
          réponse, pas un lecteur à faire défiler. */}
      {!cherche && (
        <div className="mt-4 overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)]">
          <video
            src="/tuto.mp4"
            controls
            playsInline
            className="block w-full"
            style={{ aspectRatio: '16/9', background: '#09111E' }}
          />
        </div>
      )}

      {cherche && (
        <p className={`mt-2 px-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`} aria-live="polite">
          {total === 0 ? 'Aucune réponse.' : `${total} réponse${total > 1 ? 's' : ''}`}
        </p>
      )}

      {total === 0 && cherche ? (
        <div className="mt-4 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-7">
          <p className={`text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Rien trouvé pour cette recherche. Essayez un autre mot, ou posez directement votre
            question à l’équipe.
          </p>
          <Link
            href="/dashboard/assistance"
            className={`mt-4 flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] px-4 text-[15px] ${corpsFort} text-white`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            Poser ma question
          </Link>
        </div>
      ) : (
        sections.map(section => (
          <section key={section.id} aria-labelledby={`guide-${section.id}`} className="mt-[26px]">
            <h2 id={`guide-${section.id}`} className={`px-0.5 text-[19px] leading-tight ${titre}`}>
              {section.title}
            </h2>
            <p className={`mb-1.5 px-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              {section.summary}
            </p>
            <div className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
              <ul className="divide-y divide-[color:var(--v2-filet)] px-4">
                {section.entries.map(entree => (
                  <Question
                    key={entree.id}
                    entree={entree}
                    // Une recherche montre ses résultats : on ne fait pas retaper.
                    ouverte={cherche || ouvertes.includes(entree.id)}
                    onBasculer={() => basculer(entree.id)}
                  />
                ))}
              </ul>
            </div>
          </section>
        ))
      )}

      {!cherche && (
        <Link
          href="/dashboard/assistance"
          className={`mt-[26px] flex h-11 items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-4 text-[15px] ${corpsFort}`}
          style={PRESSION}
        >
          Poser une question à l’équipe
        </Link>
      )}
    </div>
  )

  if (!grandEcran) return contenu

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="reglages" />
      </div>
      <div className="min-w-0 max-w-[680px] flex-1">{contenu}</div>
    </div>
  )
}
