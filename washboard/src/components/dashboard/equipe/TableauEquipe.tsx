'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CarteListe, Chevron, Ligne, NonLus } from '@/components/dashboard/ParametresFormV2'
import { corps, corpsFort } from '@/components/dashboard/FeuilleV2'
import { nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { useSupportBadges } from '@/components/dashboard/SupportBadgesContext'
import { ilYa } from '@/lib/ficheLaveur'
import { aujourdhuiParis } from '@/lib/suiviAppels'
import { inscriptionsParSemaine, type LaveurResume } from '@/lib/resumeLaveurs'
import EcranEquipe, { Carte, Initiales, Point, Section } from './EcranEquipe'
import type { ResumeProspects } from './AccueilEquipeV2'
import FeuilleRappel, { BoutonRappel, rappelLaveur } from './FeuilleRappel'

// Accueil de l'espace équipe sur ordinateur (Alexandre, 2026-11-05) : un tableau de
// bord plutôt que trois portes. Le téléphone garde la liste courte (AccueilEquipeV2).

const SEMAINE_MS = 7 * 864e5
const TON_POINT = { ok: 'vert', attention: 'ambre', alerte: 'rouge', neutre: 'gris' } as const

type Resume = { expediteursEnAttente: number | null; suiviActif: boolean }

function heureParis(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}
function jourMois(aaaammjj: string): string {
  return new Date(`${aaaammjj}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })
}

/** Lien « Tout voir » à droite d'un titre de section. */
function ToutVoir({ href, children = 'Tout voir' }: { href: string; children?: React.ReactNode }) {
  return <Link href={href} className={`text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>{children}</Link>
}

// ── Chiffres du haut ─────────────────────────────────────────────────────────

function Chiffre({ libelle, valeur, detail, href }: { libelle: string; valeur: number | string; detail?: string; href?: string }) {
  const contenu = (
    <>
      <span className={`block text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>{libelle}</span>
      <span className={`mt-1.5 block text-[30px] leading-none ${corpsFort} tabular-nums`}>{valeur}</span>
      <span className={`mt-1.5 block min-h-[18px] text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{detail ?? ''}</span>
    </>
  )
  return href
    ? <Link href={href} className="block px-5 py-4 hover:bg-[color:var(--v2-filet)]/50">{contenu}</Link>
    : <div className="px-5 py-4">{contenu}</div>
}

// ── Inscriptions par semaine ─────────────────────────────────────────────────

function GraphiqueInscriptions({ semaines }: { semaines: { debut: string; nombre: number }[] }) {
  const [survol, setSurvol] = useState<number | null>(null)
  const max = Math.max(1, ...semaines.map(s => s.nombre))
  const H = 120
  const total = semaines.reduce((t, s) => t + s.nombre, 0)
  const derniere = semaines.length - 1
  return (
    <Carte className="p-4">
      <p className={`text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
        {total} inscription{total > 1 ? 's' : ''} sur {semaines.length} semaines
      </p>
      <div className="relative mt-5" onMouseLeave={() => setSurvol(null)}>
        <div className="flex items-end gap-1 border-b border-[color:var(--v2-filet-fort)]" style={{ height: H }} aria-hidden>
          {semaines.map((s, i) => (
            <div
              key={s.debut}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setSurvol(i)}
            >
              {(i === derniere || survol === i) && (
                <span className={`absolute text-[12px] ${corpsFort} tabular-nums`} style={{ bottom: Math.max(2, (s.nombre / max) * H) + 4 }}>{s.nombre}</span>
              )}
              <div
                className="w-[60%] max-w-[26px] rounded-t-[4px] transition-opacity"
                style={{
                  height: s.nombre ? Math.max(3, (s.nombre / max) * H) : 0,
                  background: 'var(--v2-color-accent)',
                  opacity: survol === null || survol === i ? 1 : 0.45,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1" aria-hidden>
          {semaines.map((s, i) => (
            <span key={s.debut} className={`flex-1 text-center text-[11px] ${corps} text-[color:var(--v2-color-gris)]`}>
              {i % 2 === derniere % 2 ? jourMois(s.debut) : ''}
            </span>
          ))}
        </div>
        {survol !== null && (
          <div
            className={`pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-[color:var(--v2-color-encre)] px-2.5 py-1.5 text-[12px] ${corps} text-[color:var(--v2-color-surface)]`}
            style={{ left: `${((survol + 0.5) / semaines.length) * 100}%`, top: -40 }}
          >
            Semaine du {jourMois(semaines[survol].debut)} : {semaines[survol].nombre} inscrit{semaines[survol].nombre > 1 ? 's' : ''}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>Inscriptions par semaine</caption>
        <thead><tr><th>Semaine du</th><th>Inscriptions</th></tr></thead>
        <tbody>{semaines.map(s => <tr key={s.debut}><td>{jourMois(s.debut)}</td><td>{s.nombre}</td></tr>)}</tbody>
      </table>
    </Carte>
  )
}

// ── Ligne de laveur ──────────────────────────────────────────────────────────

function LigneLaveur({ l, sousTitre, droite, apres }: { l: LaveurResume; sousTitre: React.ReactNode; droite?: React.ReactNode; apres?: React.ReactNode }) {
  return (
    <li className="flex items-center">
      <Link href={`/dashboard/support/laveurs/${l.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 hover:bg-[color:var(--v2-filet)]/50">
        <Initiales nom={l.name} taille={34} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={`truncate text-[14.5px] ${styleNom}`}>{l.name}</span>
            {l.responsable && <span className={`shrink-0 text-[12px] ${corps} text-[color:var(--v2-color-gris)]`}>{l.responsable}</span>}
          </span>
          <span className={`mt-0.5 flex items-center gap-1.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{sousTitre}</span>
        </span>
        {droite}
        {!apres && <Chevron />}
      </Link>
      {apres && <span className="pr-2">{apres}</span>}
    </li>
  )
}

const LISTE = 'overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]'

function Vide({ children }: { children: React.ReactNode }) {
  return <Carte className="px-4 py-4"><p className={`text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{children}</p></Carte>
}

// ── Le tableau ───────────────────────────────────────────────────────────────

export default function TableauEquipe({ laveurs, resume, email, maintenant, prospects = null }: {
  laveurs: LaveurResume[]
  resume: Resume
  email: string | null
  maintenant: number
  prospects?: ResumeProspects
}) {
  const { unreadTeamCount } = useSupportBadges()
  const now = useMemo(() => new Date(maintenant), [maintenant])
  const auj = aujourdhuiParis(now)
  const [rappelOuvert, setRappelOuvert] = useState<string | null>(null)
  const laveurRappel = rappelOuvert ? laveurs.find(l => l.id === rappelOuvert && l.relance) : null

  const d = useMemo(() => {
    const recent = (l: LaveurResume, de: number, a: number) => { const age = maintenant - Date.parse(l.creeLe); return age >= de && age < a }
    const parInscription = [...laveurs].sort((a, b) => b.creeLe.localeCompare(a.creeLe))
    return {
      nouveaux: laveurs.filter(l => recent(l, 0, SEMAINE_MS)).length,
      nouveauxAvant: laveurs.filter(l => recent(l, SEMAINE_MS, 2 * SEMAINE_MS)).length,
      enEssai: laveurs.filter(l => l.enEssai).length,
      payants: laveurs.filter(l => l.payant).length,
      pagesAFaire: laveurs.filter(l => !l.pagePrete).length,
      aRappeler: laveurs.filter(l => l.relance && l.relance.le <= auj).sort((a, b) => a.relance!.le.localeCompare(b.relance!.le)),
      aVenir: laveurs.filter(l => l.relance && l.relance.le > auj).length,
      derniers: parInscription.slice(0, 8),
      connectes: laveurs
        .filter(l => l.derniereConnexion && aujourdhuiParis(new Date(l.derniereConnexion)) === auj)
        .sort((a, b) => b.derniereConnexion!.localeCompare(a.derniereConnexion!)),
      // Statut « attention » d'un essai = 7 jours ou moins (voir analyserLaveur).
      finsEssai: laveurs.filter(l => l.enEssai && l.ton === 'attention'),
      semaines: inscriptionsParSemaine(laveurs, now),
      resa24h: laveurs.filter(l => l.reservations24h > 0).sort((a, b) => b.reservations24h - a.reservations24h),
    }
  }, [laveurs, maintenant, now, auj])

  return (
    <EcranEquipe titre="Équipe" sousTitre="Outil interne, invisible des laveurs" retour={{ href: '/dashboard/parametres', label: 'Plus' }} large>
      {/* Les chiffres : chacun ouvre la liste filtrée correspondante. */}
      <div className="grid grid-cols-5 divide-x divide-[color:var(--v2-filet)] overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)]">
        <Chiffre libelle="Laveurs" valeur={laveurs.length} detail={`${d.pagesAFaire} page${d.pagesAFaire > 1 ? 's' : ''} à faire`} href="/dashboard/support/laveurs" />
        <Chiffre libelle="Nouveaux sur 7 jours" valeur={d.nouveaux} detail={`${d.nouveauxAvant} la semaine d’avant`} href="/dashboard/support/laveurs?filtre=nouveaux" />
        <Chiffre libelle="En essai" valeur={d.enEssai} detail={d.finsEssai.length ? `${d.finsEssai.length} fini${d.finsEssai.length > 1 ? 'ssent' : 't'} sous 7 jours` : 'Aucun ne finit cette semaine'} href="/dashboard/support/laveurs?filtre=essai" />
        <Chiffre libelle="Payants" valeur={d.payants} detail="abonnés et historiques" />
        <Chiffre
          libelle="À rappeler"
          valeur={resume.suiviActif ? d.aRappeler.length : '—'}
          detail={resume.suiviActif ? (d.aRappeler.length ? (d.aRappeler.length > 1 ? 'relances dues' : 'relance due') : 'Personne aujourd’hui') : 'Suivi à activer'}
          href="/dashboard/support/laveurs?filtre=rappeler"
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start gap-6">
        <div className="space-y-6">
          <Section titre="À rappeler aujourd’hui" action={d.aRappeler.length > 5 || d.aVenir ? <ToutVoir href="/dashboard/support/laveurs?filtre=rappeler">{d.aVenir ? `+ ${d.aVenir} les prochains jours` : 'Tout voir'}</ToutVoir> : undefined}>
            {!resume.suiviActif ? <Vide>Le suivi d’appel n’est pas encore activé en base.</Vide>
              : d.aRappeler.length === 0 ? <Vide>Personne à rappeler aujourd’hui. Le bouton « À rappeler » d’une fiche l’ajoute ici.</Vide>
              : (
                <ul className={LISTE}>
                  {d.aRappeler.slice(0, 5).map(l => (
                    <LigneLaveur
                      key={l.id} l={l}
                      sousTitre={<span className="truncate">{l.relance!.action ?? 'Sans motif'}</span>}
                      droite={<span className={`shrink-0 text-[12.5px] ${corpsFort}`}>{l.relance!.le < auj ? `depuis le ${jourMois(l.relance!.le)}` : 'aujourd’hui'}</span>}
                      apres={<BoutonRappel onClick={() => setRappelOuvert(l.id)} libelle={`Décaler ou supprimer le rappel de ${l.name}`} />}
                    />
                  ))}
                </ul>
              )}
          </Section>

          <Section titre={d.resa24h.length ? `Réservations des dernières 24 h · ${d.resa24h.reduce((t, l) => t + l.reservations24h, 0)}` : 'Réservations des dernières 24 h'}>
            {d.resa24h.length === 0 ? <Vide>Aucune réservation ces dernières 24 heures.</Vide> : (
              <ul className={LISTE}>
                {d.resa24h.map(l => (
                  <LigneLaveur
                    key={l.id} l={l}
                    sousTitre={<span className="truncate">{l.reservations24hEnLigne === l.reservations24h ? 'Toutes prises en ligne' : l.reservations24hEnLigne ? `${l.reservations24hEnLigne} en ligne, ${l.reservations24h - l.reservations24hEnLigne} saisie${l.reservations24h - l.reservations24hEnLigne > 1 ? 's' : ''} par lui` : `Saisie${l.reservations24h > 1 ? 's' : ''} par lui`}</span>}
                    droite={<span className={`shrink-0 text-[15px] ${corpsFort} tabular-nums`}>{l.reservations24h}</span>}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section titre="Derniers inscrits" action={<ToutVoir href="/dashboard/support/laveurs?filtre=nouveaux" />}>
            <ul className={LISTE}>
              {d.derniers.map(l => (
                <LigneLaveur
                  key={l.id} l={l}
                  sousTitre={<><Point ton={TON_POINT[l.ton]} /><span className="truncate">{l.statut} · {l.pagePrete ? 'page prête' : 'page à faire'}{l.source ? ` · ${l.source}` : ''}</span></>}
                  droite={
                    <span className="shrink-0 text-right">
                      <span className={`block text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{ilYa(l.creeLe, now)}</span>
                      <span className={`block text-[12.5px] ${corps} tabular-nums`}>{l.visites30} visite{l.visites30 > 1 ? 's' : ''} · {l.reservations30} résa</span>
                    </span>
                  }
                />
              ))}
            </ul>
          </Section>
        </div>

        <div className="space-y-6">
          <Section titre="À traiter">
            <CarteListe>
              <Ligne label="Questions des laveurs" href="/dashboard/support/questions" signal={<NonLus count={unreadTeamCount} />} />
              <Ligne label="Expéditeurs SMS" valeur={resume.expediteursEnAttente ? `${resume.expediteursEnAttente} en attente` : undefined} href="/dashboard/support/expediteurs" />
              <Ligne label="Prospects à trier" valeur={prospects ? (prospects.aTrier ? String(prospects.aTrier) : 'Aucune') : 'À activer'} href="/dashboard/support/prospects?filtre=trier" />
              <Ligne label="Prospects à rappeler" valeur={prospects?.aRappeler ? `${prospects.aRappeler} aujourd’hui` : undefined} href="/dashboard/support/prospects?filtre=discussion" />
            </CarteListe>
          </Section>

          <Section titre="Inscriptions par semaine">
            <GraphiqueInscriptions semaines={d.semaines} />
          </Section>

          <Section titre="Connectés aujourd’hui">
            {d.connectes.length === 0 ? <Vide>Aucun laveur connecté aujourd’hui.</Vide> : (
              <ul className={LISTE}>
                {d.connectes.map(l => (
                  <LigneLaveur key={l.id} l={l} sousTitre={<span className="truncate">{l.statut}</span>} droite={<span className={`shrink-0 text-[12.5px] ${corps} tabular-nums`}>{heureParis(l.derniereConnexion!)}</span>} />
                ))}
              </ul>
            )}
          </Section>

          <Section titre="Essais qui finissent sous 7 jours">
            {d.finsEssai.length === 0 ? <Vide>Aucun essai ne se termine cette semaine.</Vide> : (
              <ul className={LISTE}>
                {d.finsEssai.map(l => (
                  <LigneLaveur
                    key={l.id} l={l}
                    sousTitre={<span className="truncate">{l.statutDetail ?? l.statut}</span>}
                    droite={<span className={`shrink-0 text-[12.5px] ${corps} tabular-nums`}>{l.reservations30} résa · {l.visites30} visites</span>}
                  />
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {email && <p className={`px-0.5 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>Connecté en tant que {email}. L’accès au compte d’un laveur se demande depuis sa fiche.</p>}
      {laveurRappel?.relance && (
        <FeuilleRappel
          key={laveurRappel.relance.appelId} nom={laveurRappel.name} le={laveurRappel.relance.le} now={now}
          lienFiche={`/dashboard/support/laveurs/${laveurRappel.id}`} {...rappelLaveur(laveurRappel.relance)} onClose={() => setRappelOuvert(null)}
        />
      )}
    </EcranEquipe>
  )
}
