'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Spinner } from '@/components/ui/Spinner'

// Briques communes aux écrans d'entrée v2 : connexion, inscription, code email et
// onboarding (2026-10-15, maquette https://claude.ai/artifact/BPYytpi93EeXs1JtUadKph).
//
// Une seule mise en page pour les deux appareils, choisie en CSS et pas en JS (pas de
// hook d'écran : rien ne saute au premier rendu) :
// - téléphone : en-tête en verre en haut (retour, marque, progression), contenu qui
//   défile dessous, et l'action principale dans une barre en verre sous le pouce ;
// - ordinateur (≥ lg) : deux colonnes, à gauche le contexte (`gauche`), à droite le
//   formulaire avec ses boutons à la suite.
// Styles et animations : bloc « Entrée dans l'app en v2 » de globals.css.

export const POLICE = '[font-family:var(--font-archivo)]'

export const TOTAL_ETAPES_ONBOARDING = 5

type Retour = { href: string } | { onClick: () => void; desactive?: boolean } | null

function Marque() {
  return (
    <span className="inline-flex items-center gap-2 text-[17px] font-[650] tracking-[-0.03em] [font-stretch:112%]">
      <Image src="/LogoWashBoard.png" alt="" width={26} height={26} className="rounded-[7px] object-contain" />
      WashBoard
    </span>
  )
}

const FLECHE_RETOUR = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
)

function BoutonRetour({ retour }: { retour: Retour }) {
  const classe = '-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--v2-color-encre)] disabled:invisible'
  if (!retour) return <span className="h-11 w-11 -ml-2" aria-hidden />
  if ('href' in retour) return <Link href={retour.href} aria-label="Retour" className={classe}>{FLECHE_RETOUR}</Link>
  return <button type="button" onClick={retour.onClick} disabled={retour.desactive} aria-label="Retour" className={classe}>{FLECHE_RETOUR}</button>
}

export function Progression({ etape, neuf }: { etape: number; neuf?: boolean }) {
  return (
    <div className="grid grid-cols-5 gap-1" aria-hidden>
      {Array.from({ length: TOTAL_ETAPES_ONBOARDING }, (_, i) => i + 1).map(n => (
        <i
          key={n}
          className={`block h-[3px] rounded-sm transition-colors ${n <= etape ? 'bg-[color:var(--v2-color-encre)]' : 'bg-[color:var(--v2-filet-fort)]'} ${neuf && n === etape ? 'wb-entree-remplit' : ''}`}
        />
      ))}
    </div>
  )
}

export function CadreEntree({ gauche, retour = null, etape, etapeNeuve, largeur = 'etroite', children }: {
  /** Colonne de gauche sur ordinateur. */
  gauche: React.ReactNode
  retour?: Retour
  /** Étape d'onboarding (1 à 5) : affiche la progression dans l'en-tête du téléphone. */
  etape?: number
  /** L'étape vient d'être atteinte en avançant : son trait se remplit. */
  etapeNeuve?: boolean
  largeur?: 'etroite' | 'large'
  children: React.ReactNode
}) {
  return (
    <div className={`wb-entree min-h-screen lg:grid lg:grid-cols-[420px_1fr] ${POLICE}`}>
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen flex-col gap-7 border-r border-[color:var(--v2-filet)] px-10 py-9 overflow-y-auto">
        <Link href="/" className="self-start"><Marque /></Link>
        {gauche}
      </aside>

      <div className="relative flex min-h-screen flex-col">
        <header className="wb-entree-verre sticky top-0 z-20 rounded-none border-x-0 border-t-0 px-5 pb-3 pt-[calc(8px+env(safe-area-inset-top,0px))] lg:hidden">
          <div className="flex min-h-11 items-center justify-between">
            <BoutonRetour retour={retour} />
            <Marque />
            <div className="flex h-11 w-11 items-center justify-end -mr-2">
              {etape ? (
                <span className="text-[13px] tabular-nums text-[color:var(--v2-color-gris)]">{etape} / {TOTAL_ETAPES_ONBOARDING}</span>
              ) : <ThemeToggle nav />}
            </div>
          </div>
          {etape ? <div className="mt-2"><Progression etape={etape} neuf={etapeNeuve} /></div> : null}
        </header>

        <div className="absolute right-6 top-5 hidden lg:block"><ThemeToggle nav /></div>

        <main className="flex flex-1 justify-center px-5 pb-[170px] pt-7 lg:items-center lg:px-16 lg:py-16">
          <div className={`w-full ${largeur === 'large' ? 'max-w-[560px]' : 'max-w-[440px]'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function TitreEntree({ titre, sousTitre, surTitre }: { titre: string; sousTitre?: React.ReactNode; surTitre?: React.ReactNode }) {
  return (
    <div>
      {surTitre}
      <h1 className="wb-entree-titre text-[28px] leading-[1.08] lg:text-[32px]">{titre}</h1>
      {sousTitre && <p className="mt-2 text-sm text-[color:var(--v2-color-gris)]">{sousTitre}</p>}
    </div>
  )
}

/** Un groupe de champs : une seule surface blanche, les champs séparés par un filet. */
export function GroupeChamps({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[color:var(--v2-filet)] rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4">
      {children}
    </div>
  )
}

export function Champ({ id, label, aide, children }: { id: string; label: string; aide?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="group flex flex-col gap-0.5 py-[11px]">
      <label htmlFor={id} className="text-xs font-medium text-[color:var(--v2-color-gris)] transition-colors group-focus-within:text-[color:var(--v2-color-accent)]">{label}</label>
      {children}
      {aide && <span className="text-xs text-[color:var(--v2-color-gris)] opacity-80">{aide}</span>}
    </div>
  )
}

export const SAISIE = 'wb-entree-champ-saisie'

/** Barre d'action : en verre, collée en bas sur téléphone ; bloc ordinaire sur ordinateur. */
export function BarreActions({ children }: { children: React.ReactNode }) {
  return <div className="wb-entree-verre wb-entree-actions flex flex-col items-stretch gap-1.5">{children}</div>
}

export function BoutonPrincipal({ chargement, libelleChargement, className = '', children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  chargement?: boolean
  libelleChargement?: string
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || chargement}
      className={`wb-entree-bouton min-h-[50px] w-full rounded-[var(--v2-radius-bouton)] bg-[color:var(--v2-color-accent)] px-4 text-base font-semibold text-[color:var(--v2-color-sur-accent)] disabled:opacity-35 ${className}`}
    >
      {chargement ? <span className="flex items-center justify-center gap-2"><Spinner />{libelleChargement}</span> : children}
    </button>
  )
}

export const BOUTON_SECONDAIRE = 'wb-entree-bouton min-h-[50px] w-full rounded-[var(--v2-radius-bouton)] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-4 text-base font-semibold text-[color:var(--v2-color-encre)] disabled:opacity-35'

export const LIEN_DISCRET = 'min-h-9 text-sm text-[color:var(--v2-color-gris)] underline decoration-[color:var(--v2-filet-fort)] underline-offset-[3px] disabled:opacity-40'

export function Erreur({ texte }: { texte: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-[color:var(--v2-color-rouge)]">
      <span aria-hidden className="mt-[7px] h-[7px] w-[7px] shrink-0 rounded-full bg-current" />
      {texte}
    </p>
  )
}

/** Colonne de gauche des écrans de connexion, d'inscription et du code email. */
export function GaucheAccueil() {
  return (
    <>
      <div>
        <p className="wb-entree-pitch text-[30px] leading-[1.06]">Tu laves des voitures. On gère le reste.</p>
        <p className="mt-2.5 text-sm text-[color:var(--v2-color-gris)]">
          Réservations, agenda, clients et factures au même endroit, sur ton téléphone comme ici.
        </p>
      </div>
      <div className="mt-auto rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] p-[18px]">
        <p className="text-xs text-[color:var(--v2-color-gris)]">Ce que tu verras en ouvrant l’app · ton prochain rendez-vous</p>
        <p className="wb-entree-pitch my-2 text-[44px] leading-none tabular-nums">14:30</p>
        <p className="flex justify-between gap-2.5 text-sm">
          <span>Clio IV · lavage complet</span>
          <span className="text-[color:var(--v2-color-gris)]">12 min de route</span>
        </p>
      </div>
    </>
  )
}

// Stickers de l'équipe, fournis par Alexandre le 2026-10-14. Le nom de fichier décrit le
// sticker, faute de savoir qui est qui à part Ryan.
export const EQUIPE = {
  ryan: { src: '/equipe/ryan.webp', largeur: 195 },
  rectangles: { src: '/equipe/lunettes-rectangles.webp', largeur: 150 },
  rondes: { src: '/equipe/lunettes-rondes.webp', largeur: 142 },
} as const
export type MembreEquipe = keyof typeof EQUIPE

/** Un ou plusieurs stickers de l'équipe, petits, avec une bulle. `anime` : à l'arrivée sur l'écran. */
export function Guide({ gens, texte, anime = true }: { gens: MembreEquipe[]; texte: string; anime?: boolean }) {
  return (
    <div className={`mb-3.5 flex min-h-[76px] items-end gap-2.5 ${anime ? 'wb-entree-guide-anime' : ''}`}>
      <div className="wb-entree-guide-gens flex shrink-0 items-end">
        {gens.map((g, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- petites images statiques, sans intérêt pour next/image
          <img
            key={g}
            src={EQUIPE[g].src}
            alt=""
            width={Math.round(EQUIPE[g].largeur * 76 / 260)}
            height={76}
            className={`block h-[76px] w-auto lg:h-[88px] ${i > 0 ? '-ml-3.5' : ''}`}
          />
        ))}
      </div>
      <p className="wb-entree-bulle relative mb-[18px] min-w-0 max-w-[260px] rounded-[14px] border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-3 py-2 text-[13.5px] leading-[1.35]">
        {texte}
      </p>
    </div>
  )
}
