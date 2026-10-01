'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Lock, Mail, MapPin, Phone } from 'lucide-react'
import { Feuille, BOUTON, PRESSION, corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { jourSeul } from '@/lib/reservationsVerrouillees'

// Une réservation venue au-delà du quota de l'offre, version v2 (PWA installée).
//
// Même règle que `CarteVerrouillee.tsx` (site) : seul le JOUR reste lisible — assez pour savoir
// qu'un vrai client attend, trop peu pour savoir lequel — et tout le reste, nom compris, est une
// barre floutée avec un cadenas, jamais une valeur inventée. Le flou n'est qu'une décoration :
// le nom, le téléphone, l'email, l'adresse, le montant et l'heure ne sont jamais chargés (voir
// `masquerVerrouillees`).
//
// La ligne est aussi cliquable : elle ouvre une fiche, floutée elle aussi, qui montre ce qu'on
// obtient en changeant d'offre.

/** Pas de `client_name` : le nom n'existe déjà plus au sortir de la base, et un champ toujours
 *  vide inviterait un écran à l'afficher. */
export type ReservationMasquee = { id: string; scheduled_at: string }

const jourAbrege = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', day: 'numeric' }).replace('.', '')

/** La place du nom d'un client masqué : une barre, comme les autres champs de la carte.
 *  L'ancienne version floutait le VRAI nom en CSS — il restait lisible dans le code de la page,
 *  il suffisait de retirer le flou. */
function NomMasque({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      <span className="sr-only">Client masqué</span>
      <BarreLigne className="h-3.5 w-28" />
    </span>
  )
}

function Barre({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded bg-[color:var(--v2-filet-fort)] blur-[3px] ${className}`} />
}

/** Barre floue des lignes de liste : plus soutenue que celles de la fiche, sinon le flou
 *  disparaît sur le fond blanc du mode clair. */
function BarreLigne({ className }: { className: string }) {
  return <span aria-hidden className={`block rounded bg-[color:var(--v2-color-gris)]/45 blur-[4px] ${className}`} />
}

/** Ligne d'une liste de rendez-vous (« À confirmer » de l'accueil). Même forme que `LigneRdv`. */
export function LigneRdvVerrouilleeV2({ reservation: r, offre }: { reservation: ReservationMasquee; offre: string }) {
  const [fiche, setFiche] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setFiche(true)}
        aria-haspopup="dialog"
        aria-label="Client masqué par votre offre"
        className="flex min-h-[46px] w-full items-start gap-3.5 py-[11px] text-left"
      >
        <span className={`w-[58px] shrink-0 pt-0.5 text-[15px] ${corpsFort} capitalize text-[color:var(--v2-color-gris)] tabular-nums`}>
          {jourAbrege(r.scheduled_at)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="flex min-w-0 items-center gap-1.5">
            <NomMasque className={`truncate text-[15px] ${corpsFort}`} />
            <Lock size={13} strokeWidth={2.2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
          </span>
          <BarreLigne className="mt-1 h-3 w-24" />
        </span>
        <BarreLigne className="mt-1 h-3 w-10 shrink-0" />
      </button>
      {fiche && <FicheVerrouilleeV2 reservation={r} offre={offre} onClose={() => setFiche(false)} />}
    </>
  )
}

/** Ligne de l'annuaire des clients. Cliquable : ouvre la fiche floutée. */
export function LigneClientVerrouilleeV2({ reservation: r, offre }: { reservation: ReservationMasquee; offre: string }) {
  const [fiche, setFiche] = useState(false)
  return (
    <li>
      <button
        type="button"
        onClick={() => setFiche(true)}
        aria-haspopup="dialog"
        aria-label="Voir la fiche d’un client masqué par votre offre"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--v2-filet)] focus:outline-none focus-visible:bg-[color:var(--v2-filet)]"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--v2-filet)] text-[color:var(--v2-color-gris)]">
          <Lock size={15} strokeWidth={2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <NomMasque className={`block truncate text-[15px] ${corpsFort}`} />
          <BarreLigne className="mt-1.5 h-3 w-32 max-w-full" />
          <span className={`mt-1.5 block truncate text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Réservation le {jourSeul(r.scheduled_at) ?? '—'}
          </span>
        </span>
        <BarreLigne className="mt-1.5 h-3 w-10 shrink-0" />
      </button>
      {fiche && <FicheVerrouilleeV2 reservation={r} offre={offre} onClose={() => setFiche(false)} />}
    </li>
  )
}

/** Carte d'un client masqué dans la journée de l'agenda. Même silhouette que `RendezVousCarte`,
 *  mais l'heure, la prestation, le prix et le lieu ne sont que des barres floues : l'heure n'a
 *  jamais quitté le serveur, la carte se range donc en fin de journée. */
export function CarteJourVerrouilleeV2({ reservation: r, offre }: { reservation: ReservationMasquee; offre: string }) {
  const [fiche, setFiche] = useState(false)
  return (
    <div className="flex items-start gap-3 pt-2">
      <div className="flex w-10 shrink-0 flex-col items-end gap-1 pt-3">
        <Lock size={14} strokeWidth={2.2} aria-hidden className="text-[color:var(--v2-color-gris)]" />
        <BarreLigne className="h-2.5 w-7" />
      </div>
      <span aria-hidden className="my-1.5 w-[3px] self-stretch rounded-full bg-[color:var(--v2-filet-fort)]" />
      <button
        type="button"
        onClick={() => setFiche(true)}
        aria-haspopup="dialog"
        aria-label="Rendez-vous masqué par votre offre"
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-3.5 py-3 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <NomMasque className={`truncate text-[15px] ${corpsFort}`} />
            <Lock size={13} strokeWidth={2.2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
          </span>
          <BarreLigne className="h-3.5 w-10 shrink-0" />
        </span>
        <BarreLigne className="mt-1 h-3 w-32 max-w-full" />
        <span className="flex items-center justify-between gap-2 pt-1.5">
          <BarreLigne className="h-3 w-20" />
          <span className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Heure masquée</span>
        </span>
      </button>
      {fiche && <FicheVerrouilleeV2 reservation={r} offre={offre} onClose={() => setFiche(false)} />}
    </div>
  )
}

function LigneFloue({ icone, largeur }: { icone: React.ReactNode; largeur: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--v2-filet)] py-3.5 last:border-b-0">
      <span className="text-[color:var(--v2-color-gris)]">{icone}</span>
      <Barre className={`h-3.5 ${largeur}`} />
    </div>
  )
}

/** La fiche d'un client masqué : le squelette de ce qu'on verrait, flou, sous un cadenas. */
function FicheVerrouilleeV2({ reservation: r, offre, onClose }: { reservation: ReservationMasquee; offre: string; onClose: () => void }) {
  return (
    <Feuille
      titre={<NomMasque />}
      sousTitre={`Réservation le ${jourSeul(r.scheduled_at) ?? '—'}`}
      onClose={onClose}
      pied={
        <Link
          href="/dashboard/abonnement"
          className={`${BOUTON} w-full text-white`}
          style={{ background: 'var(--v2-color-accent)', ...PRESSION }}
        >
          Débloquer avec le plan {offre}
        </Link>
      }
    >
      <div className="relative">
        <div inert aria-hidden className="select-none">
          <div className="rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4">
            <LigneFloue icone={<Phone size={17} strokeWidth={1.75} />} largeur="w-36" />
            <LigneFloue icone={<Mail size={17} strokeWidth={1.75} />} largeur="w-52" />
            <LigneFloue icone={<MapPin size={17} strokeWidth={1.75} />} largeur="w-56" />
          </div>
          <div className="mt-4 rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-4">
            <div className="flex items-center justify-between">
              <Barre className="h-4 w-32" />
              <Barre className="h-4 w-12" />
            </div>
            <Barre className="mt-3 h-3 w-24" />
          </div>
          <div className="mt-4 flex gap-2.5">
            <Barre className="h-11 flex-1 rounded-[var(--v2-radius-bouton)]" />
            <Barre className="h-11 flex-1 rounded-[var(--v2-radius-bouton)]" />
          </div>
        </div>
        <div className="absolute inset-0 flex items-start justify-center pt-16">
          <span
            className={`inline-flex items-center gap-2 rounded-full border border-[color:var(--v2-filet-fort)] bg-[color:var(--v2-color-surface)] px-4 py-2.5 text-[13.5px] shadow-lg ${corpsFort}`}
          >
            <Lock size={14} strokeWidth={2.4} aria-hidden />
            Masqué par votre offre
          </span>
        </div>
      </div>
      <p className={`mt-5 text-[13px] leading-[1.55] ${corps} text-[color:var(--v2-color-gris)]`}>
        Cette personne a bien réservé chez vous. Son téléphone, son adresse et l’heure du rendez-vous apparaissent dès que
        votre offre le permet.
      </p>
    </Feuille>
  )
}

/** Bandeau de l'agenda : les journées où des clients sont absents de la grille (leur heure est
 *  masquée). Rendu DANS le conteneur v2 de l'agenda — posé au-dessus, il passait sous le fond
 *  opaque du conteneur (`-mt-6`) et son haut était coupé. */
export function JoursMasquesV2({ dates }: { dates: string[] }) {
  const parJour = new Map<string, number>()
  for (const d of [...dates].sort()) {
    const jour = jourSeul(d)
    if (jour) parJour.set(jour, (parJour.get(jour) ?? 0) + 1)
  }
  if (parJour.size === 0) return null
  const total = [...parJour.values()].reduce((a, b) => a + b, 0)
  const entrees = [...parJour.entries()]
  const montres = entrees.slice(0, 4)
  const reste = entrees.length - montres.length
  return (
    <Link
      href="/dashboard/clients"
      className="block rounded-[var(--v2-radius-carte)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3.5 transition-colors hover:border-[color:var(--v2-color-accent)]"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--v2-filet)] text-[color:var(--v2-color-gris)]">
          <Lock size={15} strokeWidth={2.2} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[14.5px] leading-tight ${corpsFort}`}>
            {total} client{total > 1 ? 's' : ''} absent{total > 1 ? 's' : ''} de cet agenda
          </span>
          <span className={`mt-0.5 block text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
            Heure masquée par votre offre
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2} aria-hidden className="shrink-0 text-[color:var(--v2-color-gris)]" />
      </span>
      <span className="mt-3 flex flex-wrap gap-1.5 pl-12">
        {montres.map(([jour, n]) => (
          <span key={jour} className={`rounded-full bg-[color:var(--v2-filet)] px-2.5 py-1 text-[12px] leading-none ${corps} text-[color:var(--v2-color-gris)]`}>
            {jour}{n > 1 ? ` · ${n}` : ''}
          </span>
        ))}
        {reste > 0 && (
          <span className={`px-1 py-1 text-[12px] leading-none ${corps} text-[color:var(--v2-color-gris)]`}>+ {reste} autre{reste > 1 ? 's' : ''}</span>
        )}
      </span>
    </Link>
  )
}
