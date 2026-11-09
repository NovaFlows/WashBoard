'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, MessageCircle, MoreHorizontal, Phone, Plus, UserRound } from 'lucide-react'
import { Feuille, BOUTON, CHAMP, ETIQUETTE, PRESSION, corps, corpsFort, puce } from '@/components/dashboard/FeuilleV2'
import { Constat, ConfirmationSuppression, nom as styleNom } from '@/components/dashboard/PrestationsUiV2'
import { useDemandeAcces } from '@/components/dashboard/SupportAccessForm'
import type { DonneesLaveur, Topo } from '@/lib/ficheLaveur'
import { dateCourte, dateHeure, ilYa } from '@/lib/ficheLaveur'
import { MISE_A_RAPPELER, RESULTATS_APPEL, aujourdhuiParis, estAppel, relancePrevue, type Appel, type ResultatAppel } from '@/lib/suiviAppels'
import { Chevron } from '@/components/dashboard/ParametresFormV2'
import { EQUIPE } from '@/lib/responsables'
import { resumerOnboarding } from '@/lib/ficheOnboarding'
import EcranEquipe, { Carte, Initiales, LigneInfo, Point, Section } from './EcranEquipe'
import ChoixDate, { dateJour } from './ChoixDate'

// Fiche d'un laveur, espace équipe (2026-11-05). On y arrive surtout en touchant la
// notification « nouvel inscrit » : d'abord de quoi appeler et quoi dire, ensuite le
// suivi des appels, puis le détail (sa page, sa configuration, son contact).

const TON_POINT = { ok: 'vert', attention: 'ambre', alerte: 'rouge', neutre: 'gris' } as const
const ETAPES = ['Ouvrent la page', 'Vont aux créneaux', 'Donnent leurs coordonnées', 'Réservent']

function numeroWhatsApp(tel: string): string {
  const chiffres = tel.replace(/\D/g, '')
  return chiffres.startsWith('0') ? '33' + chiffres.slice(1) : chiffres
}

/** Enregistre une ligne du suivi. Renvoie le message d'erreur, ou null. */
async function enregistrerSuivi(washerId: string, corpsRequete: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch(`/api/support/laveurs/${washerId}/appels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpsRequete),
    })
    if (res.ok) return null
    const corpsReponse = await res.json().catch(() => ({}))
    return corpsReponse.error ?? 'Enregistrement impossible.'
  } catch {
    return 'Enregistrement impossible. Vérifiez votre connexion.'
  }
}

// ── Mettre dans « À rappeler » ───────────────────────────────────────────────

function FeuilleARappeler({ washerId, nomLaveur, now, onClose }: { washerId: string; nomLaveur: string; now: Date; onClose: () => void }) {
  const router = useRouter()
  const [le, setLe] = useState(aujourdhuiParis(now))
  const [motif, setMotif] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    const echec = await enregistrerSuivi(washerId, { resultat: MISE_A_RAPPELER, prochaine_action: motif, relancer_le: le || null })
    setEnCours(false)
    if (echec) { setErreur(echec); return }
    router.refresh()
    onClose()
  }

  return (
    <Feuille
      titre="À rappeler"
      sousTitre={nomLaveur}
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <button type="button" onClick={() => void enregistrer()} disabled={enCours} className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
            {enCours ? 'Ajout…' : 'Ajouter à « À rappeler »'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className={ETIQUETTE}>Quand</p>
          <ChoixDate valeur={le} onChange={setLe} now={now} avecAujourdhui />
        </div>
        <div>
          <label htmlFor="rappel-motif" className={ETIQUETTE}>Pourquoi le rappeler (facultatif)</label>
          <input id="rappel-motif" value={motif} onChange={e => setMotif(e.target.value)} maxLength={300} placeholder="Vérifier qu’il a mis ses prix" className={CHAMP} />
        </div>
      </div>
    </Feuille>
  )
}

// ── Noter un appel ───────────────────────────────────────────────────────────

function FeuilleAppel({ washerId, now, onClose }: { washerId: string; now: Date; onClose: () => void }) {
  const router = useRouter()
  const [resultat, setResultat] = useState<ResultatAppel | null>(null)
  const [notes, setNotes] = useState('')
  const [action, setAction] = useState('')
  const [relance, setRelance] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrer() {
    if (!resultat || enCours) { if (!resultat) setErreur('Choisissez le résultat de l’appel.'); return }
    setEnCours(true)
    setErreur(null)
    const echec = await enregistrerSuivi(washerId, { resultat, notes, prochaine_action: action, relancer_le: relance || null })
    setEnCours(false)
    if (echec) { setErreur(echec); return }
    router.refresh()
    onClose()
  }

  return (
    <Feuille
      titre="Noter un appel"
      onClose={onClose}
      pied={
        <div>
          {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
          <button type="button" onClick={() => void enregistrer()} disabled={enCours} className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
            {enCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <p className={ETIQUETTE}>Résultat</p>
          <div className="flex flex-wrap gap-2">
            {RESULTATS_APPEL.map(r => (
              <button key={r} type="button" aria-pressed={resultat === r} onClick={() => setResultat(r)} className={puce(resultat === r)}>{r}</button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="appel-notes" className={ETIQUETTE}>Notes</label>
          <textarea
            id="appel-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={4} maxLength={4000}
            placeholder="Ce qu’il a dit, ce qui le bloque…"
            className={`${CHAMP} h-auto py-2.5 leading-snug resize-y`}
          />
        </div>
        <div>
          <label htmlFor="appel-action" className={ETIQUETTE}>Prochaine action</label>
          <input id="appel-action" value={action} onChange={e => setAction(e.target.value)} maxLength={300} placeholder="Le rappeler après sa première presta" className={CHAMP} />
        </div>
        <div>
          <p className={ETIQUETTE}>Relancer le</p>
          <ChoixDate valeur={relance} onChange={setRelance} now={now} />
        </div>
      </div>
    </Feuille>
  )
}

// ── Détail d'un appel (et suppression d'une saisie ratée) ─────────────────────

function FeuilleDetailAppel({ appel, now, modifierDirect = false, onClose }: { appel: Appel; now: Date; modifierDirect?: boolean; onClose: () => void }) {
  const router = useRouter()
  const [suppression, setSuppression] = useState(false)
  const [modification, setModification] = useState(modifierDirect)
  const [le, setLe] = useState(appel.relancer_le ?? '')
  const [motif, setMotif] = useState(appel.prochaine_action ?? '')
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function enregistrerModification() {
    if (enCours) return
    setEnCours(true)
    setErreur(null)
    try {
      const res = await fetch(`/api/support/appels/${appel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relancer_le: le || null, prochaine_action: motif }),
      })
      if (!res.ok) {
        const corpsReponse = await res.json().catch(() => ({}))
        setErreur(corpsReponse.error ?? 'Modification impossible. Réessayez.')
        return
      }
      router.refresh()
      onClose()
    } catch {
      setErreur('Modification impossible. Vérifiez votre connexion.')
    } finally {
      setEnCours(false)
    }
  }

  async function supprimer() {
    setEnCours(true)
    setErreur(null)
    const res = await fetch(`/api/support/appels/${appel.id}`, { method: 'DELETE' }).catch(() => null)
    setEnCours(false)
    if (!res?.ok) { setErreur('Suppression impossible. Réessayez.'); return }
    router.refresh()
    onClose()
  }

  const appelReel = estAppel(appel)
  if (suppression) {
    return appelReel
      ? <ConfirmationSuppression titre="Supprimer cet appel ?" texte="Il disparaît du suivi de ce laveur." enCours={enCours} erreur={erreur} onConfirmer={() => void supprimer()} onClose={() => setSuppression(false)} />
      : <ConfirmationSuppression titre="Retirer de « À rappeler » ?" texte="Il ne sera plus dans la liste des laveurs à rappeler." libelleAction="Retirer" libelleEnCours="Retrait…" enCours={enCours} erreur={erreur} onConfirmer={() => void supprimer()} onClose={() => setSuppression(false)} />
  }
  if (modification) {
    return (
      <Feuille
        titre={appelReel ? 'Modifier la relance' : 'Modifier la date'}
        sousTitre={appelReel ? `Appel du ${dateHeure(appel.appele_le)}` : undefined}
        onClose={onClose}
        pied={
          <div>
            {erreur && <div className="mb-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
            <button type="button" onClick={() => void enregistrerModification()} disabled={enCours} className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
              {enCours ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className={ETIQUETTE}>{appelReel ? 'Relancer le' : 'À rappeler le'}</p>
            <ChoixDate valeur={le} onChange={setLe} now={now} avecAujourdhui effacable={appelReel} />
          </div>
          <div>
            <label htmlFor="relance-motif" className={ETIQUETTE}>{appelReel ? 'Prochaine action' : 'Pourquoi le rappeler (facultatif)'}</label>
            <input id="relance-motif" value={motif} onChange={e => setMotif(e.target.value)} maxLength={300} className={CHAMP} />
          </div>
        </div>
      </Feuille>
    )
  }
  return (
    <Feuille titre={appelReel ? appel.resultat : 'Mis à rappeler'} sousTitre={`${appelReel ? 'Appel du' : 'Le'} ${dateHeure(appel.appele_le)}`} onClose={onClose}>
      <div className="space-y-4">
        {appel.notes && <p className={`whitespace-pre-wrap text-[15px] leading-snug ${corps}`}>{appel.notes}</p>}
        {appel.prochaine_action && <LigneInfo libelle={appelReel ? 'Prochaine action' : 'Pourquoi'}>{appel.prochaine_action}</LigneInfo>}
        {appel.relancer_le && <LigneInfo libelle={appelReel ? 'Relancer le' : 'À rappeler le'}>{dateJour(appel.relancer_le)}</LigneInfo>}
        <button type="button" onClick={() => setModification(true)} className={`${BOUTON} w-full border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>
          {appel.relancer_le ? 'Changer la date' : 'Prévoir une relance'}
        </button>
        <button type="button" onClick={() => setSuppression(true)} className={`text-[14px] ${corpsFort}`} style={{ color: 'var(--v2-color-rouge)' }}>{appelReel ? 'Supprimer cet appel' : 'Retirer de « À rappeler »'}</button>
      </div>
    </Feuille>
  )
}

// ── Qui le suit dans l'équipe ────────────────────────────────────────────────

function FeuilleResponsable({ washerId, nomLaveur, actuel, onClose }: { washerId: string; nomLaveur: string; actuel: string | null; onClose: () => void }) {
  const router = useRouter()
  const [enCours, setEnCours] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  async function choisir(responsable: string | null) {
    if (enCours) return
    setEnCours(responsable ?? 'personne')
    setErreur(null)
    try {
      const res = await fetch(`/api/support/laveurs/${washerId}/responsable`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responsable }),
      })
      if (!res.ok) {
        const corpsReponse = await res.json().catch(() => ({}))
        setErreur(corpsReponse.error ?? 'Enregistrement impossible. Réessayez.')
        return
      }
      router.refresh()
      onClose()
    } catch {
      setErreur('Enregistrement impossible. Vérifiez votre connexion.')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <Feuille titre="Qui le suit ?" sousTitre={nomLaveur} onClose={onClose}>
      <div className="flex flex-wrap gap-2">
        {EQUIPE.map(n => (
          <button key={n} type="button" aria-pressed={actuel === n} disabled={!!enCours} onClick={() => void choisir(n)} className={puce(actuel === n)}>
            {enCours === n ? '…' : n}
          </button>
        ))}
        <button type="button" aria-pressed={actuel === null} disabled={!!enCours} onClick={() => void choisir(null)} className={puce(actuel === null)}>
          {enCours === 'personne' ? '…' : 'Personne'}
        </button>
      </div>
      <p className={`mt-4 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Le laveur apparaît dans « Suivi par » de la liste des laveurs, au nom choisi.
      </p>
      {erreur && <div className="mt-3"><Constat ton="rouge" role="alert">{erreur}</Constat></div>}
    </Feuille>
  )
}

// ── Accès au compte du laveur ────────────────────────────────────────────────

function FeuilleOptions({ nomLaveur, slug, onClose }: { nomLaveur: string; slug: string; onClose: () => void }) {
  const { occupe, erreur, resultat, demander } = useDemandeAcces()
  return (
    <Feuille titre={nomLaveur} onClose={onClose}>
      <p className={`text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
        Possible seulement s’il a ouvert l’accès depuis ses réglages (Aide à la configuration), pour une heure.
      </p>
      {!resultat && (
        <button type="button" disabled={occupe} onClick={() => void demander(slug)} className={`${BOUTON} mt-4 w-full border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>
          {occupe ? 'Vérification…' : 'Ouvrir son compte'}
        </button>
      )}
      {erreur && <div className="mt-3"><Constat ton="ambre" role="alert">{erreur}</Constat></div>}
      {resultat && (
        <div className="mt-4 space-y-3">
          <Constat ton="ambre">
            Lien à usage unique, valable peu de temps. Ouvrez-le en navigation privée, sinon vous perdez votre propre session.
          </Constat>
          <a href={resultat.url} target="_blank" rel="noopener noreferrer" className={`${BOUTON} w-full text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
            Entrer dans le compte de {resultat.washerName}
          </a>
        </div>
      )}
    </Feuille>
  )
}

// ── La fiche ─────────────────────────────────────────────────────────────────

export default function FicheLaveurV2({ donnees, topo, appels, suiviActif, responsable, maintenant }: {
  donnees: DonneesLaveur
  topo: Topo
  appels: Appel[]
  suiviActif: boolean
  /** Membre de l'équipe qui le suit ; `undefined` tant que l'affiliation n'est pas activée en base. */
  responsable?: string | null
  maintenant: number
}) {
  const now = useMemo(() => new Date(maintenant), [maintenant])
  const [feuille, setFeuille] = useState<{ quoi: 'appel' } | { quoi: 'rappeler' } | { quoi: 'detail'; appel: Appel } | { quoi: 'options' } | { quoi: 'responsable' } | null>(null)
  const w = donnees.washer
  const a = topo.activite
  const onboarding = useMemo(() => resumerOnboarding(w), [w])
  const lienPage = `washboard.fr/book/${w.slug}`
  const relance = relancePrevue(appels)
  const aujourdhui = aujourdhuiParis(now)
  const max = Math.max(a.parcours[0], 1)

  return (
    <EcranEquipe
      titre={w.name}
      sousTitre={`Inscrit ${ilYa(w.created_at, now)}, le ${dateCourte(w.created_at)}${topo.source ? ` · connu par ${topo.source}` : ''}`}
      retour={{ href: '/dashboard/support/laveurs', label: 'Laveurs' }}
      action={
        <button type="button" onClick={() => setFeuille({ quoi: 'options' })} aria-label="Options du laveur" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--v2-color-gris)] hover:bg-[color:var(--v2-filet)] hover:text-[color:var(--v2-color-encre)]">
          <MoreHorizontal size={20} strokeWidth={2} />
        </button>
      }
    >
      {/* Statut + trois chiffres : l'essentiel avant même de défiler. */}
      <div className="space-y-4">
        <p className={`flex items-center gap-2 text-[14px] ${corpsFort}`}>
          <Point ton={TON_POINT[topo.statut.ton]} />
          {topo.statut.libelle}
          {topo.statut.detail && <span className={`${corps} text-[color:var(--v2-color-gris)]`}>· {topo.statut.detail}</span>}
        </p>
        {responsable !== undefined && (
          <button type="button" onClick={() => setFeuille({ quoi: 'responsable' })} className={`-mt-2 inline-flex items-center gap-1.5 text-[13.5px] ${corps} text-[color:var(--v2-color-gris)]`}>
            <UserRound size={14} strokeWidth={2} aria-hidden />
            {responsable
              ? <>Suivi par <span className={`${corpsFort} text-[color:var(--v2-color-encre)]`}>{responsable}</span></>
              : 'Personne ne le suit'}
            <span className={corpsFort} style={{ color: 'var(--v2-color-accent)' }}>· {responsable ? 'Changer' : 'Le prendre'}</span>
          </button>
        )}
        <dl className="grid grid-cols-3 gap-3">
          {[
            { v: a.visites30, l: 'visites sur 30 j' },
            { v: a.reservations30, l: 'résa sur 30 j' },
            { v: a.derniereConnexion ? ilYa(a.derniereConnexion, now).replace('il y a ', '') : '—', l: 'sans connexion' },
          ].map(x => (
            <div key={x.l} className="flex flex-col-reverse justify-end">
              <dt className={`m-0 mt-1 text-[12px] leading-tight ${corps} text-[color:var(--v2-color-gris)]`}>{x.l}</dt>
              <dd className={`m-0 text-[24px] leading-none ${corpsFort} tabular-nums`}>{x.v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-2.5">
          {w.phone && (
            <a href={`tel:${w.phone.replace(/\s/g, '')}`} className={`${BOUTON} flex-1 gap-2 text-[color:var(--v2-color-sur-accent)]`} style={{ background: 'var(--v2-color-accent)', ...PRESSION }}>
              <Phone size={16} strokeWidth={2} aria-hidden />Appeler
            </a>
          )}
          {w.phone && (
            <a href={`https://wa.me/${numeroWhatsApp(w.phone)}`} target="_blank" rel="noopener noreferrer" className={`${BOUTON} flex-1 gap-2 border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>
              <MessageCircle size={16} strokeWidth={2} aria-hidden />WhatsApp
            </a>
          )}
          {!w.phone && (
            <a href={`https://${lienPage}`} target="_blank" rel="noopener noreferrer" className={`${BOUTON} flex-1 border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>
              Voir sa page
            </a>
          )}
        </div>
        {/* « À rappeler » : la relance en cours (touchée, elle s'ouvre et se retire), sinon le bouton pour l'y mettre. */}
        {suiviActif && (relance ? (
          <button type="button" onClick={() => setFeuille({ quoi: 'detail', appel: relance })} className="flex w-full items-center gap-3 rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 py-3 text-left">
            <Point ton={relance.relancer_le! <= aujourdhui ? 'ambre' : 'gris'} />
            <span className="min-w-0 flex-1">
              <span className={`block text-[14.5px] ${corpsFort}`}>
                À rappeler {relance.relancer_le! < aujourdhui ? `depuis le ${dateJour(relance.relancer_le!)}` : relance.relancer_le === aujourdhui ? 'aujourd’hui' : `le ${dateJour(relance.relancer_le!)}`}
              </span>
              <span className={`block text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
                {relance.prochaine_action ?? (estAppel(relance) ? `Fixé à l’appel du ${dateCourte(relance.appele_le)}` : 'Sans motif')}
              </span>
            </span>
            <Chevron />
          </button>
        ) : (
          <button type="button" onClick={() => setFeuille({ quoi: 'rappeler' })} className={`${BOUTON} w-full gap-2 border border-[color:var(--v2-filet-fort)]`} style={PRESSION}>
            <CalendarPlus size={16} strokeWidth={2} aria-hidden />Ajouter à « À rappeler »
          </button>
        ))}
      </div>

      <Section titre="À dire à l’appel">
        <Carte className="p-4">
          <p className={`text-[14px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{topo.pourquoi}</p>
          {topo.aDire.length > 0 ? (
            <ol className="mt-3 space-y-2.5">
              {topo.aDire.map((x, i) => (
                <li key={x} className="flex gap-3">
                  <span className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11.5px] ${corpsFort} bg-[color:var(--v2-filet)]`}>{i + 1}</span>
                  <span className={`text-[14.5px] leading-snug ${corps}`}>{x}</span>
                </li>
              ))}
            </ol>
          ) : <p className={`mt-3 text-[14.5px] ${corps}`}>Rien de particulier : prendre de ses nouvelles.</p>}
        </Carte>
      </Section>

      <Section
        titre="Suivi des appels"
        action={suiviActif ? (
          <button type="button" onClick={() => setFeuille({ quoi: 'appel' })} className={`inline-flex items-center gap-1 text-[13px] ${corpsFort}`} style={{ color: 'var(--v2-color-accent)' }}>
            <Plus size={14} strokeWidth={2.4} aria-hidden />Appel
          </button>
        ) : undefined}
      >
        {!suiviActif ? (
          <Carte className="p-4"><p className={`text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>Le suivi d’appel s’active dès que sa table est créée en base.</p></Carte>
        ) : appels.length === 0 ? (
          <button type="button" onClick={() => setFeuille({ quoi: 'appel' })} className={`w-full rounded-[var(--v2-radius-surface)] border border-dashed border-[color:var(--v2-filet-fort)] px-4 py-4 text-left text-[14px] ${corps} text-[color:var(--v2-color-gris)]`}>
            Pas encore appelé. Notez le premier appel ici.
          </button>
        ) : (
          <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)]">
            {appels.map(ap => (
              <li key={ap.id}>
                <button type="button" onClick={() => setFeuille({ quoi: 'detail', appel: ap })} className="w-full px-4 py-3 text-left">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={`text-[15px] ${styleNom}`}>{estAppel(ap) ? ap.resultat : 'Mis à rappeler'}</span>
                    <span className={`shrink-0 text-[12.5px] ${corps} text-[color:var(--v2-color-gris)]`}>{dateCourte(ap.appele_le)}</span>
                  </span>
                  {ap.notes && <span className={`mt-0.5 block line-clamp-2 text-[13.5px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{ap.notes}</span>}
                  {(ap.prochaine_action || ap.relancer_le) && (
                    <span className={`mt-1 block text-[12.5px] ${corpsFort}`}>
                      {[ap.prochaine_action, ap.relancer_le && `${estAppel(ap) ? 'relance' : 'pour le'} ${dateJour(ap.relancer_le)}`].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre="Sa page sur 30 jours">
        <Carte className="p-4">
          <div className="space-y-2.5">
            {a.parcours.map((n, i) => (
              <div key={ETAPES[i]}>
                <div className={`flex justify-between text-[13.5px] ${corps}`}>
                  <span>{ETAPES[i]}</span>
                  <span className={`${corpsFort} tabular-nums`}>{n}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-[color:var(--v2-filet)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: 'var(--v2-color-accent)' }} />
                </div>
              </div>
            ))}
          </div>
          {a.provenance.length > 0 && (
            <p className={`mt-4 text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>
              Provenance : {a.provenance.map(p => `${p.source} ${p.visites}`).join(', ')}. Ses propres essais comptent aussi, souvent en « Direct ».
            </p>
          )}
          <p className={`mt-3 border-t border-[color:var(--v2-filet)] pt-3 text-[14px] leading-snug ${corps}`}>
            <span className={corpsFort}>Lien dans ses réseaux ?</span> {a.lienReseaux}
          </p>
          <p className={`mt-2 text-[13px] ${corps} text-[color:var(--v2-color-gris)]`}>
            {a.reservations} réservation{a.reservations > 1 ? 's' : ''} au total{a.reservations ? `, dont ${a.reservationsEnLigne} en ligne` : ''}
            {a.chiffre30 ? ` · ${a.chiffre30} € sur 30 j` : ''}{a.smsAvis ? ` · ${a.smsAvis} demande${a.smsAvis > 1 ? 's' : ''} d’avis` : ''}
          </p>
        </Carte>
      </Section>

      <Section titre="Configuration">
        <ul className="overflow-hidden rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] divide-y divide-[color:var(--v2-filet)] px-4">
          {topo.configuration.map(c => (
            <li key={c.libelle} className="flex items-start gap-3 py-2.5">
              <span className="mt-[7px]"><Point ton={c.fait ? 'vert' : c.essentiel ? 'ambre' : 'gris'} /></span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[14.5px] ${corpsFort}`}>{c.libelle}<span className="sr-only">{c.fait ? ', fait' : ', à faire'}</span></span>
                <span className={`block text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)] break-words`}>{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Onboarding complet (2026-11-09) : ses réponses, ou la mention d'un compte antérieur à l'onboarding. */}
      <Section titre="Onboarding">
        <Carte className="px-4">
          <div className="flex items-start gap-3 py-3">
            <span className="mt-[7px]"><Point ton={onboarding.etat === 'termine' ? 'vert' : onboarding.etat === 'en_cours' ? 'ambre' : 'gris'} /></span>
            <span className="min-w-0 flex-1">
              <span className={`block text-[14.5px] ${corpsFort}`}>{onboarding.resume}</span>
              {onboarding.note && <span className={`mt-0.5 block text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{onboarding.note}</span>}
            </span>
          </div>
          {onboarding.etat !== 'avant' && (
            <ul className="divide-y divide-[color:var(--v2-filet)] border-t border-[color:var(--v2-filet)]">
              {onboarding.reponses.map(r => (
                <li key={r.question} className="py-2.5">
                  <span className={`block text-[13px] leading-snug ${corps} text-[color:var(--v2-color-gris)]`}>{r.question}</span>
                  <span className={`block text-[14.5px] leading-snug ${r.reponse ? corpsFort : `${corps} text-[color:var(--v2-color-gris)]`}`}>{r.reponse ?? 'Pas de réponse'}</span>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </Section>

      {topo.problemes.length > 0 && (
        <Section titre="Points bloquants">
          <Carte className="p-4 space-y-3">
            {topo.problemes.map(p => <Constat key={p} ton="rouge">{p}</Constat>)}
          </Carte>
        </Section>
      )}

      <Section titre="Contact">
        <div className="rounded-[var(--v2-radius-surface)] border border-[color:var(--v2-filet)] bg-[color:var(--v2-color-surface)] px-4 divide-y divide-[color:var(--v2-filet)]">
          <div className="flex items-center gap-3 py-3">
            <Initiales nom={w.name} taille={36} />
            <span className={`min-w-0 text-[15px] ${styleNom}`}>{w.facture_nom_legal ?? w.name}</span>
          </div>
          <LigneInfo libelle="Téléphone">{w.phone ?? '—'}{w.telephone_verifie_le ? ' (vérifié)' : ''}</LigneInfo>
          <LigneInfo libelle="Email">{donnees.email ? <a href={`mailto:${donnees.email}`} className="underline underline-offset-2">{donnees.email}</a> : '—'}</LigneInfo>
          {w.base_address && <LigneInfo libelle="Adresse">{w.base_address}</LigneInfo>}
          {w.website_url && <LigneInfo libelle="Site">{w.website_url.replace(/^https?:\/\//, '')}</LigneInfo>}
          <LigneInfo libelle="Sa page"><a href={`https://${lienPage}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--v2-color-accent)' }}>{lienPage}</a></LigneInfo>
          {a.derniereConnexion && <LigneInfo libelle="Dernière connexion">{dateHeure(a.derniereConnexion)}</LigneInfo>}
        </div>
      </Section>

      {feuille?.quoi === 'appel' && <FeuilleAppel washerId={w.id} now={now} onClose={() => setFeuille(null)} />}
      {feuille?.quoi === 'rappeler' && <FeuilleARappeler washerId={w.id} nomLaveur={w.name} now={now} onClose={() => setFeuille(null)} />}
      {feuille?.quoi === 'detail' && <FeuilleDetailAppel appel={feuille.appel} now={now} onClose={() => setFeuille(null)} />}
      {feuille?.quoi === 'responsable' && <FeuilleResponsable washerId={w.id} nomLaveur={w.name} actuel={responsable ?? null} onClose={() => setFeuille(null)} />}
      {feuille?.quoi === 'options' && <FeuilleOptions nomLaveur={w.name} slug={w.slug} onClose={() => setFeuille(null)} />}
    </EcranEquipe>
  )
}
