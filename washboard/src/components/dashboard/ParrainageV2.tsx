'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Gift, MessageCircle } from 'lucide-react'
import { useGrandEcran } from '@/hooks/useGrandEcran'
import ListeReglagesV2, { type ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { useLocale, useT } from '@/components/i18n/I18nProvider'
import { formatDateFR } from '@/lib/subscription'
import type { StatutFilleul } from '@/lib/parrainage'

export type FilleulAffiche = { nom: string; statut: StatutFilleul; inscritLe: string; recompenseLe: string | null }
export type DonneesParrainage = {
  code: string
  lien: string
  filleuls: FilleulAffiche[]
  moisGagnes: number
  proOffertJusquAu: string | null
}

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const titre = `${police} [font-weight:var(--v2-type-titre-poids)] [font-stretch:var(--v2-type-titre-largeur)] tracking-[var(--v2-type-titre-tracking)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)] tabular-nums`
const SURTITRE = 'text-[11px] font-black uppercase tracking-[0.18em]'
const CARTE = 'rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]'

export const STATUTS_FILLEUL: Record<StatutFilleul, { libelle: string; couleur: string }> = {
  essai: { libelle: 'En essai', couleur: 'var(--v2-color-accent)' },
  client: { libelle: 'Client', couleur: 'var(--v2-color-vert)' },
  essai_termine: { libelle: 'Essai terminé', couleur: 'var(--v2-color-gris)' },
}

function initiales(texte: string): string {
  const mots = texte.trim().split(/\s+/).filter(Boolean)
  if (mots.length === 0) return '?'
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase()
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase()
}

export function messagePartage(lien: string): string {
  return `Je gère mes réservations avec WashBoard. Inscris-toi avec mon lien, tu auras 28 jours d’essai gratuit au lieu de 14 : ${lien}`
}

/** Copier le lien + WhatsApp, partagé avec le bloc de « Mon offre ». */
export function BoutonsPartage({ lien, compact = false }: { lien: string; compact?: boolean }) {
  const t = useT()
  const [copie, setCopie] = useState(false)
  async function copier() {
    try {
      await navigator.clipboard.writeText(lien)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      window.prompt(t('Copiez votre lien :'), lien)
    }
  }
  const bouton = `inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[var(--v2-radius-bouton)] px-4 text-[14px] ${corpsFort}`
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={copier}
        className={`${bouton} bg-[color:var(--v2-color-accent)] text-[color:var(--v2-color-sur-accent)]`}
        aria-live="polite"
      >
        {copie ? <Check size={17} aria-hidden /> : <Copy size={17} aria-hidden />}
        {copie ? t('Lien copié') : t('Copier le lien')}
      </button>
      {!compact && (
        <a
          href={`https://wa.me/?text=${encodeURIComponent(messagePartage(lien))}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${bouton} border border-[color:var(--v2-filet-fort)] text-[color:var(--v2-color-encre)]`}
        >
          <MessageCircle size={17} aria-hidden />
          WhatsApp
        </a>
      )}
    </div>
  )
}

export default function ParrainageV2({ grandfathered, liste }: { grandfathered: boolean; liste: ReglagesListeProps }) {
  const t = useT()
  const loc = useLocale()
  const grandEcran = useGrandEcran()
  const [donnees, setDonnees] = useState<DonneesParrainage | null>(null)
  const [erreur, setErreur] = useState(false)
  const [maintenant] = useState(() => Date.now())

  useEffect(() => {
    let actif = true
    fetch('/api/parrainage')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: DonneesParrainage) => { if (actif) setDonnees(d) })
      .catch(() => { if (actif) setErreur(true) })
    return () => { actif = false }
  }, [])

  const proOffert = donnees?.proOffertJusquAu && new Date(donnees.proOffertJusquAu).getTime() > maintenant
    ? donnees.proOffertJusquAu : null

  const gain = (
    <p className={`flex items-start gap-2 text-[13.5px] leading-snug ${corps}`}>
      <Gift size={17} className="mt-px shrink-0 text-[color:var(--v2-color-accent)]" aria-hidden />
      <span>
        {grandfathered
          ? t('Votre collègue a 2 semaines d’essai en plus.')
          : <>{t('Votre collègue a')} <b className={corpsFort}>{t('2 semaines d’essai en plus')}</b>{t('. Vous, 1 mois offert dès qu’il s’abonne.')}</>}
      </span>
    </p>
  )

  const partage = (
    <section className={`${CARTE} space-y-4 px-4 py-4`}>
      <div>
        <p className={`${SURTITRE} text-[color:var(--v2-color-gris)]`}>{t('Votre code')}</p>
        {donnees ? (
          <>
            <p className={`mt-1 select-all text-[26px] leading-tight ${hero}`}>{donnees.code}</p>
            <p className={`mt-1 break-all text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{donnees.lien.replace(/^https?:\/\//, '')}</p>
          </>
        ) : (
          <div className="mt-2 h-8 w-48 animate-pulse rounded-[8px] bg-[color:var(--v2-filet)]" aria-hidden />
        )}
      </div>
      {donnees && <BoutonsPartage lien={donnees.lien} />}
      {gain}
    </section>
  )

  const filleuls = donnees?.filleuls ?? []
  const resultats = donnees && (
    filleuls.length === 0 ? (
      <section className={`${CARTE} px-4 py-5`}>
        <p className={`text-[16px] ${titre}`}>{t('Aucun filleul pour l’instant')}</p>
        <p className={`mt-1 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('Envoyez votre lien à un collègue laveur : dès qu’il s’inscrit, il apparaît ici.')}</p>
        <ol className="mt-4 space-y-2.5">
          {[
            t('Vous envoyez votre lien.'),
            t('Votre collègue s’inscrit : 14 jours d’essai en plus pour lui.'),
            grandfathered ? t('Il profite de 28 jours pour tout essayer.') : t('Il s’abonne : votre mois est offert.'),
          ].map((etape, i) => (
            <li key={etape} className={`flex items-center gap-3 text-[14px] ${corps}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--v2-filet)] text-[13px] ${corpsFort}`}>{i + 1}</span>
              {etape}
            </li>
          ))}
        </ol>
      </section>
    ) : (
      <div className="space-y-4">
        {proOffert && (
          <p
            className={`rounded-[var(--v2-radius-carte)] border px-3.5 py-3 text-[13.5px] ${corpsFort}`}
            style={{ borderColor: 'color-mix(in srgb, var(--v2-color-vert) 30%, transparent)', color: 'var(--v2-color-vert)' }}
          >
            {t('Pro offert jusqu’au {date}', { date: formatDateFR(proOffert, loc) })}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <div className={`${CARTE} px-4 py-3`}>
            <p className={`text-[26px] leading-none ${hero}`}>{filleuls.length}</p>
            <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{filleuls.length > 1 ? t('filleuls') : t('filleul')}</p>
          </div>
          {!grandfathered && (
            <div className={`${CARTE} px-4 py-3`}>
              <p className={`text-[26px] leading-none ${hero}`}>{donnees.moisGagnes}</p>
              <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{donnees.moisGagnes > 1 ? t('mois gagnés') : t('mois gagné')}</p>
            </div>
          )}
        </div>
        <section>
          <h2 className={`mb-2 text-[14px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>{t('Vos filleuls')}</h2>
          <ul className={`${CARTE} divide-y divide-[color:var(--v2-filet)]`}>
            {filleuls.map((f, i) => {
              const st = STATUTS_FILLEUL[f.statut]
              return (
                <li key={`${f.nom}-${i}`} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[color:var(--v2-filet)] text-[13px] ${corpsFort}`} aria-hidden>{initiales(f.nom)}</span>
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${corpsFort}`}>{f.nom}</span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className={`inline-flex items-center gap-1.5 text-[13px] ${corpsFort}`} style={{ color: st.couleur }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.couleur }} aria-hidden />
                      {t(st.libelle)}
                    </span>
                    {f.recompenseLe && !grandfathered && (
                      <span className={`text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('1 mois offert')}</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className={`mt-2 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{t('Vous voyez le nom de leur entreprise et où ils en sont, rien d’autre.')}</p>
        </section>
      </div>
    )
  )

  const contenu = (
    <div
      className={grandEcran
        ? `space-y-5 text-[color:var(--v2-color-encre)] ${police}`
        : `max-w-3xl mx-auto space-y-5 -mx-3 sm:-mx-4 -mt-6 px-3 sm:px-4 pt-6 pb-6 bg-[color:var(--v2-color-fond)] text-[color:var(--v2-color-encre)] ${police}`}
    >
      <div>
        <h1 className={grandEcran ? `text-[20px] ${titre}` : `text-[21px] ${titre}`}>{t('Parrainage')}</h1>
        <p className={`mt-1 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
          {grandfathered
            ? t('Un collègue s’inscrit avec votre code : il gagne 2 semaines d’essai.')
            : t('Un collègue s’inscrit avec votre code, vous y gagnez tous les deux.')}
        </p>
      </div>
      {erreur ? (
        <p className={`${CARTE} px-4 py-4 text-[14px] ${corps}`}>{t('Impossible de charger votre parrainage. Réessayez dans un instant.')}</p>
      ) : grandEcran ? (
        <div className="grid grid-cols-2 items-start gap-5">
          {partage}
          {resultats}
        </div>
      ) : (
        <>
          {partage}
          {resultats}
        </>
      )}
    </div>
  )

  if (!grandEcran) return contenu

  return (
    <div className="flex items-start gap-5">
      <div className="sticky top-0 w-[320px] shrink-0 max-h-[calc(100vh-60px)] overflow-y-auto">
        <ListeReglagesV2 {...liste} selection="parrainage" />
      </div>
      <div className="min-w-0 max-w-[880px] flex-1">{contenu}</div>
    </div>
  )
}

/** Résumé dans « Mon offre » : le code, le bouton pour copier, et le lien vers l'écran complet. */
export function BlocParrainageOffre({ grandfathered }: { grandfathered: boolean }) {
  const t = useT()
  const [donnees, setDonnees] = useState<DonneesParrainage | null>(null)
  useEffect(() => {
    let actif = true
    fetch('/api/parrainage')
      .then(r => (r.ok ? r.json() : null))
      .then((d: DonneesParrainage | null) => { if (actif && d) setDonnees(d) })
      .catch(() => {})
    return () => { actif = false }
  }, [])
  if (!donnees) return null
  const n = donnees.filleuls.length
  return (
    <section className={`${CARTE} space-y-3 px-4 py-4`}>
      <div>
        <p className={`flex items-center gap-1.5 ${SURTITRE} text-[color:var(--v2-color-gris)]`}>
          <Gift size={13} aria-hidden />{t('Parrainage')}
        </p>
        <p className={`mt-1 text-[14px] leading-snug ${corps}`}>
          {grandfathered
            ? t('Parrainez un collègue : il gagne 2 semaines d’essai en plus.')
            : t('Parrainez un collègue : 1 mois offert dès qu’il s’abonne.')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`min-w-0 flex-1 truncate text-[18px] ${hero}`}>{donnees.code}</span>
        <div className="w-[150px] shrink-0"><BoutonsPartage lien={donnees.lien} compact /></div>
      </div>
      <a href="/dashboard/parrainage" className={`flex items-center justify-between gap-3 text-[13.5px] ${corps}`}>
        <span className="text-[color:var(--v2-color-gris)]">
          {n === 0
            ? t('Aucun filleul pour l’instant')
            : grandfathered
              ? (n > 1 ? t('{n} filleuls', { n }) : t('1 filleul'))
              : t('{filleuls} · {mois}', {
                filleuls: n > 1 ? t('{n} filleuls', { n }) : t('1 filleul'),
                mois: donnees.moisGagnes > 1 ? t('{m} mois gagnés', { m: donnees.moisGagnes }) : t('{m} mois gagné', { m: donnees.moisGagnes }),
              })}
        </span>
        <span className={corpsFort} style={{ color: 'var(--v2-color-accent)' }}>{t('Voir')}</span>
      </a>
    </section>
  )
}
