'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@/components/i18n/I18nProvider'

// « Bonjour [nom] » / « Bonsoir [nom] » peint à la bombe sur tout l'écran, à l'ouverture de WashBoard
// (demande d'Alexandre, 2026-11-14) : la police de l'application (Archivo, la même que le reste), pas
// une police de graffiti. Le graffiti est dans le geste : le texte se révèle d'un trait, comme
// pulvérisé, avec un nuage de peinture qui avance, les bords rugueux de la peinture sur un mur, puis
// des coulures.
//
// Une seule fois par ouverture : le drapeau vit dans `sessionStorage`, qui se vide quand
// l'application est fermée (PWA) ou l'onglet quitté. Un appui n'importe où le fait disparaître.
// Sans animation (« réduire les animations » demandé au système), il n'apparaît pas du tout.

const CLE_SESSION = 'wb-bonjour-ouverture'
const DEBUT_FONDU_MS = 3050

const police = '[font-family:var(--font-archivo)]'
const hero = `${police} [font-weight:var(--v2-type-hero-poids)] [font-stretch:var(--v2-type-hero-largeur)] tracking-[var(--v2-type-hero-tracking)]`

// Coulures : position horizontale (% de la ligne), longueur (px), retard (s).
const COULURES = [
  { x: 9, h: 46, d: 1.55 }, { x: 27, h: 78, d: 1.75 }, { x: 46, h: 34, d: 1.65 },
  { x: 63, h: 62, d: 1.9 }, { x: 81, h: 40, d: 1.7 }, { x: 93, h: 56, d: 2.05 },
]

const CSS = `
.wb-graf-fond { animation: wb-graf-sortie .55s ease-in ${DEBUT_FONDU_MS}ms forwards; }
.wb-graf-trait {
  -webkit-mask-image: linear-gradient(90deg, #000 42%, transparent 58%);
          mask-image: linear-gradient(90deg, #000 42%, transparent 58%);
  -webkit-mask-size: 260% 100%; mask-size: 260% 100%;
  -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat;
  -webkit-mask-position: 100% 0; mask-position: 100% 0;
  padding: 14px 22px; margin: -14px -22px;
  animation: wb-graf-peindre 1.15s cubic-bezier(.45,.05,.35,1) var(--wb-graf-retard, 0s) forwards;
}
.wb-graf-nuage {
  position: absolute; top: 50%; left: 0; width: 150px; height: 150px; margin: -75px 0 0 -75px;
  border-radius: 50%; filter: blur(22px); opacity: 0; pointer-events: none;
  animation: wb-graf-nuage 1.15s cubic-bezier(.45,.05,.35,1) var(--wb-graf-retard, 0s) forwards;
}
.wb-graf-coulure {
  position: absolute; top: 74%; width: 6px; border-radius: 0 0 6px 6px; height: 0;
  transform-origin: top; animation: wb-graf-couler 1s cubic-bezier(.5,.1,.7,.9) var(--wb-graf-retard, 0s) forwards;
}
@keyframes wb-graf-peindre { to { -webkit-mask-position: 0% 0; mask-position: 0% 0; } }
@keyframes wb-graf-nuage {
  0% { left: 0; opacity: 0; } 12% { opacity: .55; } 85% { opacity: .5; } 100% { left: 100%; opacity: 0; }
}
@keyframes wb-graf-couler { from { height: 0; } to { height: var(--wb-graf-h); } }
@keyframes wb-graf-sortie { to { opacity: 0; visibility: hidden; } }
`

export default function BonjourGraffiti({ nom }: { nom?: string }) {
  const t = useT()
  const [etat, setEtat] = useState<{ visible: boolean; soir: boolean }>({ visible: false, soir: false })

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    try {
      if (sessionStorage.getItem(CLE_SESSION)) return
      sessionStorage.setItem(CLE_SESSION, '1')
    } catch {
      return // stockage refusé : pas d'animation répétée à chaque écran, on s'abstient
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- heure et mémoire de session : navigateur uniquement
    setEtat({ visible: true, soir: new Date().getHours() >= 18 })
  }, [])

  if (!etat.visible) return null

  const salut = etat.soir ? t('Bonsoir') : t('Bonjour')
  const peinture = 'color-mix(in srgb, var(--v2-color-accent) 60%, transparent)'
  // Les bords rugueux et le voile de peinture autour des lettres.
  const filtre = `url(#wb-graf-bombe) drop-shadow(0 0 7px ${peinture})`

  // Dans <body> : l'accueil crée son propre contexte d'empilement, la barre du bas passerait sinon par-dessus.
  return createPortal(
    <div
      aria-hidden
      onClick={() => setEtat(e => ({ ...e, visible: false }))}
      // Retiré quand le fondu de sortie est fini (plutôt qu'un minuteur : le mode strict de React
      // en développement coupe les minuteurs posés par un effet).
      onAnimationEnd={e => { if (e.animationName === 'wb-graf-sortie') setEtat(x => ({ ...x, visible: false })) }}
      className="wb-graf-fond fixed inset-0 z-[200] flex cursor-pointer select-none flex-col items-center justify-center gap-3 overflow-hidden bg-[color:var(--v2-color-fond)] px-6 text-center"
    >
      <style>{CSS}</style>
      <svg width="0" height="0" className="absolute">
        <filter id="wb-graf-bombe" x="-5%" y="-10%" width="110%" height="125%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="bruit" />
          <feDisplacementMap in="SourceGraphic" in2="bruit" scale="5" />
        </filter>
      </svg>
      <div
        className="absolute inset-0"
        style={{
          background: [
            'radial-gradient(60% 46% at 14% 12%, color-mix(in srgb, var(--v2-color-accent) 26%, transparent), transparent 72%)',
            'radial-gradient(52% 40% at 90% 30%, color-mix(in srgb, var(--v2-color-ambre) 24%, transparent), transparent 72%)',
            'radial-gradient(70% 38% at 40% 78%, color-mix(in srgb, var(--v2-color-vert) 14%, transparent), transparent 74%)',
          ].join(','),
        }}
      />

      <div className="relative max-w-full">
        <div className="wb-graf-trait" style={{ ['--wb-graf-retard' as string]: '.15s' }}>
          <p className={`${hero} text-[clamp(60px,21vw,132px)] leading-[1.02] text-[color:var(--v2-color-accent)]`} style={{ filter: filtre }}>
            {salut}
          </p>
        </div>
        <span className="wb-graf-nuage" style={{ ['--wb-graf-retard' as string]: '.15s', background: peinture }} />
        {COULURES.map(c => (
          <span
            key={c.x}
            className="wb-graf-coulure"
            style={{ left: `${c.x}%`, ['--wb-graf-h' as string]: `${c.h}px`, ['--wb-graf-retard' as string]: `${c.d}s`, background: 'var(--v2-color-accent)' }}
          />
        ))}
      </div>

      {nom && (
        <div className="relative max-w-full">
          <div className="wb-graf-trait" style={{ ['--wb-graf-retard' as string]: '1s' }}>
            <p className={`${hero} break-words text-[clamp(30px,10vw,64px)] leading-[1.08] text-[color:var(--v2-color-encre)]`} style={{ filter: 'url(#wb-graf-bombe) drop-shadow(0 0 5px rgba(120,120,130,.35))' }}>
              {nom}
            </p>
          </div>
          <span className="wb-graf-nuage" style={{ ['--wb-graf-retard' as string]: '1s', background: 'rgba(120,120,130,.4)', width: 110, height: 110, margin: '-55px 0 0 -55px' }} />
        </div>
      )}
    </div>,
    document.body,
  )
}
