'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Pause, Play, ShieldCheck } from 'lucide-react'
import { corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import FormationEnveloppeV2 from '@/components/dashboard/FormationEnveloppeV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { useProgressionFormation } from '@/hooks/useProgressionFormation'
import { dureeTexte, type Lecon } from '@/lib/formation'
import { POLITIQUE_PROTECTION, positionFiligrane } from '@/lib/formationProtection'

// Lecteur de leçon protégé (branche feat/formation, 2026-11-10).
//
// Ce que fait ce composant, et ce qu'il NE PEUT PAS faire (voir `lib/formationProtection.ts` et
// docs/FORMATION.md) : un navigateur n'a aucun moyen de BLOQUER une capture d'écran faite par le
// système ou par un second appareil. On rend donc le vol décourageant et traçable :
//   - un jeton court, renouvelé tant que la page est ouverte, lié à ce laveur et à cette leçon ;
//   - un filigrane au nom du laveur, qui change de place (impossible à recadrer) et qui double
//     dans un coin fixe, très discret ;
//   - la lecture s'arrête et l'image est masquée dès que la fenêtre perd le focus (autre onglet,
//     partage d'écran, outil de capture) ;
//   - pas de menu contextuel, de glisser-déposer, de téléchargement, d'image dans l'impression ;
//   - la touche « Impr. écran » vide le presse-papiers (utile seulement contre la capture la
//     plus naïve : elle ne se substitue pas à un DRM).
// Sans fournisseur vidéo (`source` à `null`), le lecteur simule la lecture avec une horloge, pour
// qu'on voie le comportement complet avant d'avoir une seule vidéo.

type Autorisation = { filigrane: string; source: string | null; renouvellement: number }

type Props = {
  liste: ReglagesListeProps
  packSlug: string
  packTitre: string
  moduleTitre: string
  lecon: Lecon
  precedenteId: string | null
  suivanteId: string | null
}

const horloge = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export default function LecteurFormationV2({ liste, packSlug, packTitre, moduleTitre, lecon, precedenteId, suivanteId }: Props) {
  const { termines, marquer } = useProgressionFormation()
  const [autorisation, setAutorisation] = useState<Autorisation | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [lecture, setLecture] = useState(false)
  const [temps, setTemps] = useState(0)
  const [seconde, setSeconde] = useState(0)
  const [masque, setMasque] = useState(false)
  const [avertissement, setAvertissement] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fait = termines.has(lecon.id)
  const estVideo = lecon.type === 'video'

  // ── Autorisation : demandée à l'ouverture, puis renouvelée avant son expiration. ──
  useEffect(() => {
    let actif = true
    let minuterie: ReturnType<typeof setTimeout> | undefined
    async function demander() {
      try {
        const res = await fetch('/api/formation/lecture', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leconId: lecon.id }), cache: 'no-store',
        })
        const corps = await res.json().catch(() => ({}))
        if (!actif) return
        if (!res.ok) {
          setErreur(res.status === 429 ? 'Trop de demandes. Patientez un instant avant de relancer la lecture.' : 'Cette leçon n’est pas disponible pour le moment.')
          setLecture(false)
          return
        }
        setErreur(null)
        setAutorisation({ filigrane: corps.filigrane, source: corps.source ?? null, renouvellement: corps.renouvellement ?? POLITIQUE_PROTECTION.renouvellementSec })
        minuterie = setTimeout(demander, (corps.renouvellement ?? POLITIQUE_PROTECTION.renouvellementSec) * 1000)
      } catch {
        if (!actif) return
        setErreur('Connexion perdue. Vérifiez votre réseau puis rechargez la page.')
        setLecture(false)
      }
    }
    demander()
    return () => { actif = false; if (minuterie) clearTimeout(minuterie) }
  }, [lecon.id])

  // ── Horloge : fait bouger le filigrane même en pause, et avance la lecture simulée. ──
  useEffect(() => {
    const id = setInterval(() => {
      setSeconde(Math.floor(Date.now() / 1000))
      setTemps(t => (lecture && !autorisation?.source ? Math.min(lecon.dureeSec, t + 1) : t))
    }, 1000)
    return () => clearInterval(id)
  }, [lecture, autorisation?.source, lecon.dureeSec])

  // ── Fin de la lecture simulée : la leçon est faite. ──
  useEffect(() => {
    if (lecture && !autorisation?.source && temps >= lecon.dureeSec) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fin de lecture : on rend la main
      setLecture(false)
      marquer(lecon.id, true)
    }
  }, [temps, lecture, autorisation?.source, lecon.dureeSec, lecon.id, marquer])

  // ── Perte de focus : on coupe et on masque. Reprendre est un geste volontaire. ──
  const couper = useCallback(() => {
    setLecture(false)
    videoRef.current?.pause()
    setMasque(true)
  }, [])
  useEffect(() => {
    const surVisibilite = () => { if (document.hidden) couper() }
    const surFocus = () => setMasque(false)
    document.addEventListener('visibilitychange', surVisibilite)
    window.addEventListener('blur', couper)
    window.addEventListener('focus', surFocus)
    return () => {
      document.removeEventListener('visibilitychange', surVisibilite)
      window.removeEventListener('blur', couper)
      window.removeEventListener('focus', surFocus)
    }
  }, [couper])

  // ── Raccourcis d'enregistrement et de capture. ──
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) e.preventDefault()
    }
    const surRelache = (e: KeyboardEvent) => {
      if (e.key !== 'PrintScreen') return
      navigator.clipboard?.writeText('').catch(() => undefined)
      setAvertissement('Les captures d’écran sont interdites : chaque lecture est marquée à votre nom.')
      couper()
    }
    window.addEventListener('keydown', surTouche)
    window.addEventListener('keyup', surRelache)
    return () => { window.removeEventListener('keydown', surTouche); window.removeEventListener('keyup', surRelache) }
  }, [couper])

  const basculer = () => {
    if (erreur || !autorisation) return
    setMasque(false)
    setAvertissement(null)
    const v = videoRef.current
    if (autorisation.source && v) { if (lecture) v.pause(); else void v.play() }
    setLecture(l => !l)
  }

  const pos = positionFiligrane(seconde)
  const avancement = lecon.dureeSec > 0 ? Math.min(100, (temps / lecon.dureeSec) * 100) : 0
  const lien = (id: string) => `/dashboard/formation/${packSlug}/${id}`

  return (
    <FormationEnveloppeV2
      liste={liste}
      titre={lecon.titre}
      sousTitre={`${moduleTitre} · ${packTitre}`}
      retour={{ href: `/dashboard/formation/${packSlug}`, label: packTitre }}
    >
      {/* Rien de cette zone ne part à l'impression. */}
      <style>{'@media print { .formation-protege { display: none !important; } }'}</style>

      <div
        className="formation-protege select-none"
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
        onContextMenu={e => e.preventDefault()}
        onDragStart={e => e.preventDefault()}
      >
        <div
          className="relative overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)]"
          style={{ aspectRatio: '16/9', background: '#09111E' }}
        >
          {estVideo && autorisation?.source ? (
            <video
              ref={videoRef}
              src={autorisation.source}
              controls={false}
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload noremoteplayback noplaybackrate"
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              onTimeUpdate={e => setTemps(e.currentTarget.currentTime)}
              onEnded={() => { setLecture(false); marquer(lecon.id, true) }}
              className="block h-full w-full"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-6 text-center">
              <p className={`text-[13.5px] leading-snug ${corps} text-white/70`}>
                {estVideo ? 'Vidéo de démonstration : le contenu du formateur arrive ici.' : 'Le contenu de cette leçon arrive ici.'}
              </p>
            </div>
          )}

          {/* Filigrane mobile (change de place toutes les 12 s) + filigrane fixe, très discret. */}
          {autorisation && (
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <span
                className="absolute whitespace-nowrap text-[11px] font-medium text-white/45"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, textShadow: '0 0 3px rgba(0,0,0,.6)' }}
              >
                {autorisation.filigrane}
              </span>
              <span className="absolute bottom-2 right-3 whitespace-nowrap text-[10px] text-white/20">{autorisation.filigrane}</span>
            </div>
          )}

          {masque && (
            <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center">
              <p className={`text-[14px] leading-snug ${corpsFort} text-white`}>
                {avertissement ?? 'Lecture en pause : cette fenêtre a perdu le focus.'}
              </p>
            </div>
          )}
        </div>

        {erreur && <p role="alert" className={`mt-3 text-[13.5px] ${corps} text-[color:var(--v2-color-ambre)]`}>{erreur}</p>}

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button" onClick={basculer} disabled={!autorisation || !!erreur || (!estVideo)}
            aria-label={lecture ? 'Mettre en pause' : 'Lire'}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--v2-color-encre)] text-[color:var(--v2-color-surface)] transition-transform active:scale-[.95] disabled:opacity-40"
          >
            {lecture ? <Pause size={18} strokeWidth={2.2} /> : <Play size={18} strokeWidth={2.2} className="ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--v2-filet)]">
              <div className="h-full rounded-full bg-[color:var(--v2-color-accent)]" style={{ width: `${avancement}%` }} />
            </div>
            <p className={`mt-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {horloge(temps)} / {horloge(lecon.dureeSec)} · {dureeTexte(lecon.dureeSec)}
            </p>
          </div>
        </div>

        <button
          type="button" onClick={() => marquer(lecon.id, !fait)}
          className={`mt-3 flex h-11 w-full items-center justify-center rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] px-4 text-[15px] ${corpsFort} transition-transform active:scale-[.97]`}
        >
          {fait ? 'Leçon terminée ✓ (annuler)' : 'Marquer comme terminée'}
        </button>
      </div>

      <nav className="flex items-center justify-between gap-3" aria-label="Leçons">
        {precedenteId ? (
          <Link href={lien(precedenteId)} className={`flex h-11 items-center gap-1 text-[14px] ${corpsFort}`}><ChevronLeft size={18} aria-hidden />Précédente</Link>
        ) : <span />}
        {suivanteId ? (
          <Link href={lien(suivanteId)} className={`flex h-11 items-center gap-1 text-[14px] ${corpsFort}`}>Suivante<ChevronRight size={18} aria-hidden /></Link>
        ) : <span />}
      </nav>

      <p className={`flex items-start gap-2 px-0.5 text-[12px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        <ShieldCheck size={15} strokeWidth={2} aria-hidden className="mt-px shrink-0" />
        <span><span className={titre}>Lecture protégée.</span> Votre nom s’affiche sur la vidéo ; la diffusion ou l’enregistrement du contenu est interdit.</span>
      </p>
    </FormationEnveloppeV2>
  )
}
