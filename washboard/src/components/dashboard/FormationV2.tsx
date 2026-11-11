'use client'

import Link from 'next/link'
import { corps, corpsFort, titre } from '@/components/dashboard/FeuilleV2'
import { Chevron, TitreSection } from '@/components/dashboard/ParametresFormV2'
import FormationEnveloppeV2 from '@/components/dashboard/FormationEnveloppeV2'
import type { ReglagesListeProps } from '@/components/dashboard/ListeReglagesV2'
import { useProgressionFormation } from '@/hooks/useProgressionFormation'
import {
  NIVEAUX, dureePack, dureeTexte, etatSession, leconsDuPack, prixTexte, progressionPack, prochaineLecon,
  sessionsAVenir, type PackFormation, type SessionLive,
} from '@/lib/formation'

// Écran d'accueil « Formation » (branche feat/formation, 2026-11-10) : reprendre là où on s'était
// arrêté, le prochain appel en direct, puis les packs. Les packs et les appels viennent de
// `lib/formation.ts` (catalogue d'exemple) en attendant les tables.

const CARTE = 'rounded-[var(--v2-radius-surface)] bg-[color:var(--v2-color-surface)] border border-[color:var(--v2-filet)]'

export function BarreProgression({ pourcent }: { pourcent: number }) {
  return (
    <div
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pourcent}
      className="h-[3px] w-full overflow-hidden rounded-full bg-[color:var(--v2-filet)]"
    >
      <div className="h-full rounded-full bg-[color:var(--v2-color-accent)]" style={{ width: `${pourcent}%` }} />
    </div>
  )
}

/** « jeudi 19 novembre · 19 h 00 » : le fuseau de Paris, quel que soit celui du navigateur. */
export function quandTexte(iso: string): string {
  const d = new Date(iso)
  const jour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(d)
  const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(d).replace(':', ' h ')
  return `${jour} · ${heure}`
}

function CartePack({ pack, termines }: { pack: PackFormation; termines: ReadonlySet<string> }) {
  const pourcent = progressionPack(pack, termines)
  const bientot = pack.statut === 'bientot'
  const contenu = (
    <div className={`${CARTE} p-4 ${bientot ? '' : 'active:scale-[.99] transition-transform'}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[16px] leading-snug ${titre}`}>{pack.titre}</p>
          <p className={`mt-1 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{pack.accroche}</p>
        </div>
        {!bientot && <Chevron />}
      </div>
      <p className={`mt-3 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
        {NIVEAUX[pack.niveau]} · {leconsDuPack(pack).length} leçons · {dureeTexte(dureePack(pack))}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        {bientot ? (
          <span className={`text-[13px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>Bientôt disponible</span>
        ) : pourcent > 0 ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0 flex-1"><BarreProgression pourcent={pourcent} /></div>
            <span className={`shrink-0 text-[12.5px] ${corpsFort}`}>{pourcent} %</span>
          </div>
        ) : (
          <span className={`text-[14px] ${corpsFort}`}>{prixTexte(pack.prixCents)}</span>
        )}
      </div>
    </div>
  )
  return bientot ? <div aria-disabled>{contenu}</div> : <Link href={`/dashboard/formation/${pack.slug}`} className="block">{contenu}</Link>
}

type Props = {
  liste: ReglagesListeProps
  packs: PackFormation[]
  sessions: SessionLive[]
  /** Instant du rendu serveur : sinon « dans 10 min » ne serait pas le même au serveur et au navigateur. */
  maintenantIso: string
}

export default function FormationV2({ liste, packs, sessions, maintenantIso }: Props) {
  const { termines } = useProgressionFormation()
  const maintenant = new Date(maintenantIso)

  // « Reprendre » : le pack commencé (au moins une leçon faite) mais pas terminé, le plus avancé d'abord.
  const encours = packs
    .filter(p => p.statut === 'disponible')
    .map(p => ({ pack: p, pourcent: progressionPack(p, termines), suite: prochaineLecon(p, termines) }))
    .filter(x => x.pourcent > 0 && x.suite)
    .sort((a, b) => b.pourcent - a.pourcent)[0]

  const prochain = sessionsAVenir(sessions, maintenant)[0]
  const etat = prochain ? etatSession(prochain, maintenant) : null

  return (
    <FormationEnveloppeV2
      liste={liste}
      titre="Formation"
      sousTitre="Apprendre le métier, avec ceux qui le font"
      retour={{ href: '/dashboard/parametres/reglages', label: 'Réglages' }}
    >
      {encours && encours.suite && (
        <Link href={`/dashboard/formation/${encours.pack.slug}/${encours.suite.id}`} className={`${CARTE} block p-4`}>
          <p className={`text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Reprendre</p>
          <p className={`mt-1 text-[16px] leading-snug ${titre}`}>{encours.suite.titre}</p>
          <p className={`mt-0.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{encours.pack.titre}</p>
          <div className="mt-3"><BarreProgression pourcent={encours.pourcent} /></div>
        </Link>
      )}

      {prochain && (
        <Link href="/dashboard/formation/directs" className={`${CARTE} block p-4`}>
          <div className="flex items-center gap-2">
            {etat === 'en_cours' || etat === 'bientot' ? (
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--v2-color-accent)]" />
            ) : null}
            <p className={`text-[12.5px] ${corpsFort} text-[color:var(--v2-color-gris)]`}>
              {etat === 'en_cours' ? 'En direct maintenant' : etat === 'bientot' ? 'Commence dans quelques minutes' : 'Prochain appel en direct'}
            </p>
          </div>
          <p className={`mt-1 text-[16px] leading-snug ${titre}`}>{prochain.titre}</p>
          <p className={`mt-0.5 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{quandTexte(prochain.debutIso)}</p>
        </Link>
      )}

      <div>
        <TitreSection>Les formations</TitreSection>
        <div className="space-y-3">
          {packs.map(p => <CartePack key={p.slug} pack={p} termines={termines} />)}
        </div>
      </div>

      <p className={`px-0.5 text-[12.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Ces formations sont réservées aux laveurs inscrits sur WashBoard. Les vidéos sont
        protégées : chaque lecture est marquée à votre nom et ne peut pas être partagée.
      </p>
    </FormationEnveloppeV2>
  )
}
