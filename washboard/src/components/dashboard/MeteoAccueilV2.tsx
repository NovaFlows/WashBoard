'use client'

import { useEffect, useState } from 'react'
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useT } from '@/components/i18n/I18nProvider'
import { LIBELLES, type Meteo, type Symbole } from '@/lib/meteo'

const police = '[font-family:var(--font-archivo)]'
const corps = `${police} [font-weight:var(--v2-type-corps-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const corpsFort = `${police} [font-weight:var(--v2-type-corps-fort-poids)] [font-stretch:var(--v2-type-corps-largeur)]`
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)]`

const ICONES: Record<Symbole, LucideIcon> = {
  soleil: Sun, nuit: Moon, 'peu-nuageux': CloudSun, 'peu-nuageux-nuit': CloudMoon, nuageux: Cloud,
  brouillard: CloudFog, bruine: CloudDrizzle, pluie: CloudRain, orage: CloudLightning, neige: CloudSnow,
}

// Teinte de l'icône : chaude pour le soleil, froide pour la pluie — un repère, pas une décoration.
const TEINTES: Record<Symbole, string> = {
  soleil: '#E8A33D', nuit: '#7C86C9', 'peu-nuageux': '#E8A33D', 'peu-nuageux-nuit': '#7C86C9', nuageux: '#8A93A6',
  brouillard: '#8A93A6', bruine: '#4F8FC0', pluie: '#3F7FBF', orage: '#7A63B8', neige: '#6FA9D6',
}

/** Le verre de l'accueil sur téléphone : voile clair, flou, arête spéculaire (jetons `--v2-verre-*`). */
export const STYLE_VERRE: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--v2-verre-haut), var(--v2-verre-bas))',
  backdropFilter: 'var(--v2-verre-flou)',
  WebkitBackdropFilter: 'var(--v2-verre-flou)',
  border: '1px solid var(--v2-verre-bordure)',
  boxShadow: 'inset 0 1px 0 var(--v2-verre-arete), inset 0 -1px 0 var(--v2-verre-arete-basse), var(--v2-verre-ombre)',
}

type Etat = { meteo: Meteo | null; fini: boolean }

/**
 * Météo du jour pour l'endroit où travaille le laveur (adresse de départ de son profil).
 * Sur téléphone (`verre`) la carte est en verre, sur ordinateur une surface ordinaire.
 * Une panne de la météo ne montre RIEN : l'accueil ne doit jamais attendre ni se plaindre d'un
 * service secondaire.
 */
export default function MeteoAccueilV2({ verre }: { verre: boolean }) {
  const t = useT()
  const [etat, setEtat] = useState<Etat>({ meteo: null, fini: false })

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/meteo', { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { meteo?: Meteo | null } | null) => setEtat({ meteo: d?.meteo ?? null, fini: true }))
      .catch(() => { if (!ctrl.signal.aborted) setEtat({ meteo: null, fini: true }) })
    return () => ctrl.abort()
  }, [])

  const { meteo } = etat
  // Pendant le chargement, la place est gardée (pas de saut de mise en page) ; en cas de panne, rien.
  if (etat.fini && !meteo) return null

  const Icone = meteo ? ICONES[meteo.symbole] : Cloud
  const indice = !meteo
    ? ''
    : meteo.pluieVers !== null
      ? t('Pluie vers {h} h', { h: meteo.pluieVers })
      : meteo.symbole === 'soleil' || meteo.symbole === 'peu-nuageux'
        ? t('Bonne journée pour laver')
        : `${t('Min')} ${meteo.min}° · ${t('Max')} ${meteo.max}°`

  return (
    <div
      aria-label={t('Météo')}
      role="group"
      className={`flex min-h-[72px] items-center gap-3.5 rounded-[20px] px-[18px] py-3 ${verre ? '' : 'border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]'}`}
      style={verre ? STYLE_VERRE : undefined}
    >
      {meteo ? (
        <>
          <Icone size={34} strokeWidth={1.6} aria-hidden style={{ color: TEINTES[meteo.symbole] }} className="shrink-0" />
          <span className={`text-[34px] leading-none tabular-nums ${hero}`}>{meteo.temperature}°</span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className={`truncate text-[14.5px] ${corpsFort}`}>{t(LIBELLES[meteo.symbole])}</span>
            <span className={`truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{indice}</span>
          </span>
        </>
      ) : (
        <span aria-hidden className="h-9 w-full animate-pulse rounded-xl bg-[color:var(--v2-filet)] opacity-60 motion-reduce:animate-none" />
      )}
    </div>
  )
}
