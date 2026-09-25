'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft } from 'lucide-react'
import { BOUTON, PRESSION, corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { CarteListe } from '@/components/dashboard/ParametresFormV2'
import { nom } from '@/components/dashboard/PrestationsUiV2'
import { SITE_URL_FALLBACK } from '@/lib/plan'
import { TRAFFIC_SOURCES, buildTrackedBookingLink } from '@/lib/trafficSources'

// « Mes liens » — refonte 2026, destination NEUVE de « Plus » (demande d'Alexandre,
// 2026-09-25 : « change l'intérieur de mes exports et liens pour que ce soit dans le
// design de l'application, et mets juste mes liens »). Réservé à la PWA installée
// (voir MesLiens.tsx, le garde-fou : le site garde son écran `/dashboard/crm`, inchangé).
//
// Ce que l'écran donne : le lien de réservation du laveur, et un lien par réseau
// (`?utm_source=…`) pour que la source d'un client s'affiche fiablement dans Chiffres
// même quand Instagram ou TikTok ne transmettent pas l'origine du clic. Mêmes liens,
// même source (`lib/trafficSources.ts`) que la carte « Liens par réseau » du site.
//
// L'export Excel des réservations, qui vivait sur l'ancien écran CRM, n'est PAS repris
// ici (demande : « juste mes liens ») : voir TODO.md.

const DUREE_COPIE_MS = 1800

type Copie = { cle: string; ok: boolean } | null

export default function MesLiensV2({ slug }: { slug: string }) {
  const base = `${SITE_URL_FALLBACK}/book/${slug}`
  const [copie, setCopie] = useState<Copie>(null)
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current) }, [])

  // Cet écran ne se monte qu'après le garde-fou de `MesLiens.tsx`, donc toujours dans
  // le navigateur : `navigator` existe.
  const peutPartager = typeof navigator.share === 'function'

  async function copier(cle: string, lien: string) {
    let ok = true
    try {
      await navigator.clipboard.writeText(lien)
    } catch {
      ok = false
    }
    setCopie({ cle, ok })
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => setCopie(c => (c?.cle === cle ? null : c)), DUREE_COPIE_MS)
  }

  async function partager() {
    try {
      await navigator.share({ url: base, title: 'Réserver un lavage' })
    } catch {
      // Feuille de partage fermée sans choisir : rien à dire.
    }
  }

  const affiche = (lien: string) => lien.replace(/^https?:\/\/(www\.)?/, '')
  const messageCopie = copie
    ? (copie.ok ? 'Lien copié.' : 'Copie impossible : maintenez le doigt sur le lien pour le copier.')
    : ''

  return (
    <div
      className="max-w-3xl mx-auto -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-3 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] [font-family:var(--font-archivo)]"
    >
      <div className="flex items-center gap-1 pb-3">
        <Link
          href="/dashboard/parametres"
          aria-label="Retour à Plus"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center text-[color:var(--v2-color-encre)]"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className={`text-[24px] leading-none ${titre}`}>Mes liens</h1>
          <p className={`mt-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            À partager avec vos clients
          </p>
        </div>
      </div>

      <section
        aria-label="Lien de réservation"
        className="mt-1 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-4"
      >
        <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>Votre lien de réservation</p>
        <p className={`mt-1.5 break-all text-[17px] leading-snug ${corpsFort}`}>{affiche(base)}</p>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => copier('principal', base)}
            className={`${BOUTON} flex-1 gap-2 text-white`}
            style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
          >
            {copie?.cle === 'principal' && copie.ok && <Check size={18} strokeWidth={2.5} aria-hidden />}
            {copie?.cle === 'principal' && copie.ok ? 'Copié' : 'Copier le lien'}
          </button>
          {peutPartager && (
            <button
              type="button"
              onClick={partager}
              className={`${BOUTON} border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
              style={PRESSION}
            >
              Partager
            </button>
          )}
        </div>
      </section>

      <section aria-label="Un lien par réseau" className="mt-[26px]">
        <h2 className={`px-0.5 text-[19px] leading-tight ${titre}`}>Un lien par réseau</h2>
        <p className={`mt-1.5 px-0.5 pb-3 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
          Partagez le lien du réseau où vous publiez : vous saurez d’où viennent vos clients, même quand
          Instagram ou TikTok ne le disent pas.
        </p>
        <CarteListe>
          <ul className="divide-y divide-[color:var(--v2-filet)]">
            {TRAFFIC_SOURCES.map(source => {
              const lien = buildTrackedBookingLink(base, source.key)
              const [libelle, precision] = source.label.split(' (')
              const fait = copie?.cle === source.key && copie.ok
              return (
                <li key={source.key}>
                  <button
                    type="button"
                    onClick={() => copier(source.key, lien)}
                    aria-label={`Copier le lien ${libelle}`}
                    className="flex min-h-[60px] w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`text-[15.5px] ${nom}`}>
                        {libelle}
                        {precision && (
                          <span className={`ml-1.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
                            {precision.replace(/\)$/, '').toLowerCase()}
                          </span>
                        )}
                      </span>
                      <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{affiche(base).split('/')[0]}/…?utm_source={source.key}</span>
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1 text-[14.5px] ${corpsFort}`}
                      style={{ color: fait ? 'var(--v2-color-vert)' : 'var(--v2-color-accent)' }}
                    >
                      {fait && <Check size={16} strokeWidth={2.5} aria-hidden />}
                      {fait ? 'Copié' : 'Copier'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </CarteListe>
      </section>

      <p role="status" className="sr-only">{messageCopie}</p>
      {copie && !copie.ok && (
        <p role="alert" className={`mt-4 flex items-start gap-2 text-[13.5px] leading-snug ${corps}`}>
          <span className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: 'var(--v2-color-rouge)' }} aria-hidden />
          {messageCopie}
        </p>
      )}
    </div>
  )
}
