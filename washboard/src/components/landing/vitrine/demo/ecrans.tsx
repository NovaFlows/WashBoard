'use client'

import type { CSSProperties } from 'react'
import { CarteStatique, CompteARebours } from './composants'
import type { Ctrl } from './ctrl'
import { DEPENSES, eur, ini, JOURS_MOIS, JOURS_NOMS, RDV, SEMAINE, SOURCES } from './donnees'
import { Statut, Titre, RetourPlus } from './elements'
import { clientVu, encaisse, rdvDuJour, statutRdv, tousClients, tousDocs, totalDepenses } from './etat'
import { I } from './icones'
import type { Rdv } from './types'

const grisPetit: CSSProperties = { color: 'var(--gris)', fontSize: 13 }

function LigneRdv({ c, r }: { c: Ctrl; r: Rdv }) {
  return (
    <button className="ligne" onClick={() => c.maj({ feuille: { t: 'rdv', id: r.id! } })}>
      <span className="h">{r.h}</span>
      <span className="corps"><span className="nom">{r.nom}</span><span className="det">{r.presta}</span></span>
      <span className="fin"><span className="prix">{eur(r.prix)}</span><br /><Statut s={statutRdv(r, c.etat)} /></span>
    </button>
  )
}

/** Ouvre le détail d'un rendez-vous : la fiche complète pour ceux du jour, un résumé pour les autres. */
function ouvrirRdv(c: Ctrl, r: Rdv) {
  c.maj({ feuille: r.id ? { t: 'rdv', id: r.id } : { t: 'rdvinfo', nom: r.nom, presta: r.presta, prix: r.prix, h: r.h, st: r.st } })
}

function Sources() {
  return (
    <div className="surf" style={{ padding: '6px 0' }}>
      {SOURCES.map(([n, p]) => (
        <div className="source" key={n}><span>{n}</span><span className="jauge"><i style={{ width: `${p * 2}%` }} /></span><b>{p} %</b></div>
      ))}
    </div>
  )
}

/* Aujourd'hui */
export function EcranAuj({ c }: { c: Ctrl }) {
  const { dk, etat } = c
  const p = RDV[2]
  const total = RDV.reduce((a, r) => a + r.prix, 0)
  const nbClients = 48 + etat.clientsPlus.length

  const prochain = (
    <div className="surf prochain">
      <div className="haut">
        <span className="heure">{p.h}</span>
        <div className="qui">
          <b>{p.nom}</b>
          <span className="det" style={{ ...grisPetit, display: 'block' }}>{p.presta}</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <Statut s={p.st} /><b className="num" style={{ fontWeight: 550 }}>{eur(p.prix)}</b>
          </div>
        </div>
      </div>
      <div className="adr">{I.pin}<span>{p.lieu}</span></div>
      <div className="duo">
        <button className="btn btn-accent" onClick={() => c.ouvrir({ t: 'itin' })}>{I.nav}Itinéraire</button>
        <button className="btn btn-ligne" onClick={() => c.ouvrir({ t: 'appel' })}>{I.tel}Appeler</button>
      </div>
    </div>
  )
  const journee = (
    <>
      <div className="sec-lib"><span>La journée</span><span>~22 min de route</span></div>
      <div className="surf">{RDV.filter(r => r.id !== 'r3').map(r => <LigneRdv key={r.id} c={c} r={r} />)}</div>
    </>
  )
  const confirmer = etat.sophie ? (
    <>
      <div className="sec-lib"><span>À confirmer</span><span>aucune demande</span></div>
      <div className="surf"><div className="ligne"><span className="corps"><span className="det">Tout est confirmé. Sophie Lambert a reçu son email.</span></span></div></div>
    </>
  ) : (
    <>
      <div className="sec-lib"><span>À confirmer</span><span>1 demande</span></div>
      <div className="surf">
        <div className="ligne">
          <span className="h">Dim.</span>
          <span className="corps"><span className="nom">Sophie Lambert</span><span className="det">Extérieur express · 10:00</span></span>
          <span className="fin">
            <button className="btn btn-encre btn-mini" onClick={() => { c.dispatch({ t: 'sophie' }); c.toast('Rendez-vous confirmé : Sophie Lambert reçoit un email.') }}>Confirmer</button>
          </span>
        </div>
      </div>
    </>
  )
  const mois = (
    <div className="surf" style={{ marginTop: 14 }}>
      <button className="ligne" onClick={() => c.aller('chiffres')}>
        <span className="corps"><span className="nom">Ce mois</span></span>
        <span className="det num" style={{ color: 'var(--gris)' }}>{eur(encaisse(etat))} encaissés</span>
        <span className="chev">{I.chev}</span>
      </button>
      <button className="ligne" onClick={() => c.aller('clients')}>
        <span className="corps"><span className="nom">Clients</span></span>
        <span className="det" style={{ color: 'var(--gris)' }}>{nbClients} · +{3 + etat.clientsPlus.length} ce mois</span>
        <span className="chev">{I.chev}</span>
      </button>
    </div>
  )
  const promo = etat.promo ? (
    <div className="bandeau-promo" style={{ marginBottom: 14 }}><span><b>−10 % ce week-end</b> sur ta page</span><CompteARebours /></div>
  ) : null
  const tete = (
    <Titre t="Samedi 17 octobre" s={`${RDV.length} rendez-vous · ${eur(total)}`}
      droite={<button className="rond" onClick={() => c.ouvrir({ t: 'options' })} aria-label="Options de la journée">{I.plus3}</button>} />
  )
  const libProchain = <div className="sec-lib" style={{ marginTop: 0 }}><span>Prochain rendez-vous</span><span>dans 48 min</span></div>

  if (!dk) return <>{tete}{promo}{libProchain}{prochain}{journee}{confirmer}{mois}</>

  return (
    <>
      {tete}{promo}
      <div className="dk-cols">
        <div>{libProchain}{prochain}{journee}{confirmer}</div>
        <div>
          <div className="sec-lib" style={{ marginTop: 0 }}><span>Demain, dimanche 18</span></div>
          <div className="surf">
            {rdvDuJour(6, etat).map((r, i) => (
              <div className="ligne" key={i}>
                <span className="h">{r.h}</span>
                <span className="corps"><span className="nom">{r.nom}</span><span className="det">{r.presta}</span></span>
                <span className="fin"><Statut s={r.st} /></span>
              </div>
            ))}
          </div>
          {mois}
          <div className="sec-lib"><span>D’où viennent tes réservations</span></div>
          <Sources />
        </div>
      </div>
    </>
  )
}

/* Agenda */
function ListeJour({ c, i }: { c: Ctrl; i: number }) {
  const d = SEMAINE[i]
  const rdvs = rdvDuJour(i, c.etat)
  const tot = rdvs.reduce((a, r) => a + r.prix, 0)
  return (
    <>
      {!rdvs.length ? <div className="surf" style={{ padding: 22, textAlign: 'center', color: 'var(--gris)' }}>Aucun rendez-vous ce jour-là.</div> : null}
      {rdvs.map((r, k) => {
        const coul = r.st === 'termine' || r.st === 'confirme' ? 'var(--vert)' : 'var(--ambre)'
        return (
          <div key={`${r.h}-${r.nom}`}>
            <div className="creneau">
              <div className="t"><b>{r.h}</b><small>{r.fin}</small></div>
              <span className="barre-c" style={{ background: coul }} />
              <button className={`surf carte-c${r.neuf ? ' neuf' : ''}`} onClick={() => ouvrirRdv(c, r)}>
                <div className="r"><span className="nom">{r.nom}</span><span className="prix num">{eur(r.prix)}</span></div>
                <div className="det">{r.veh || 'Voiture'} · {r.presta}</div>
                <div className="bas"><span>{(r.lieu || 'Bordeaux').split(',').pop()!.trim()}</span><Statut s={r.st} /></div>
              </button>
            </div>
            {d.auj && k === 1 ? <div className="libre"><span>1 h 50 de libre à Bordeaux</span><button onClick={() => c.ouvrir({ t: 'proposer', quand: 'samedi à 13:00', ou: 'Bordeaux' })}>Proposer</button></div> : null}
            {d.auj && k === 2 ? <div className="libre"><span>2 h 30 de libre à Bastide</span><button onClick={() => c.ouvrir({ t: 'proposer', quand: 'samedi à 15:00', ou: 'Bastide' })}>Proposer</button></div> : null}
          </div>
        )
      })}
      <div className="sec-lib" style={{ borderTop: '1px solid var(--filet)', paddingTop: 12 }}>
        <span>{rdvs.length} rendez-vous</span><b className="num" style={{ color: 'var(--encre)' }}>{eur(tot)}</b>
      </div>
    </>
  )
}

function GrilleMois({ c }: { c: Ctrl }) {
  // Octobre 2026 commence un jeudi : trois cases vides avant le 1er.
  const cases = []
  for (let k = 0; k < 3; k++) cases.push(<span key={`v${k}`} />)
  for (let j = 1; j <= 31; j++) {
    const idx = j >= 12 && j <= 18 ? j - 12 : -1
    const n = idx >= 0 ? rdvDuJour(idx, c.etat).length : j < 12 ? Math.ceil((JOURS_MOIS[j - 1] || 0) / 75) : 0
    cases.push(
      <button key={j} className={`mj${j === 17 ? ' auj' : ''}`}
        onClick={() => {
          if (idx >= 0) c.maj({ jour: idx, vueAg: 'jour' })
          else c.toast(n ? `Le ${j} octobre : ${n} rendez-vous, tous terminés.` : `Le ${j} octobre : aucun rendez-vous pour l’instant.`)
        }}>
        <b className="num">{j}</b>{n ? <i>{'•'.repeat(Math.min(n, 3))}</i> : null}
      </button>,
    )
  }
  return (
    <>
      <div className="surf mois">
        <div className="mois-ent">{['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((x, i) => <span key={i}>{x}</span>)}</div>
        <div className="mois-grille">{cases}</div>
      </div>
      <p className="ecr-sous" style={{ margin: '10px 4px' }}>Touche un jour de la semaine du 12 pour voir son détail.</p>
    </>
  )
}

function AgendaSemaine({ c }: { c: Ctrl }) {
  const H0 = 8, H1 = 21, px = 36
  const m = (t: string) => { const [a, b] = t.split(':').map(Number); return a + b / 60 }
  const pos = (h: string, f: string): CSSProperties => ({ top: Math.max(0, (m(h) - H0) * px), height: Math.max(24, (m(f) - m(h)) * px - 3) })
  const heures = []
  for (let h = H0; h < H1; h++) heures.push(h)
  const lignes = heures.map(h => <div key={h} className="sem-ligne" style={{ top: (h - H0) * px }} />)
  return (
    <div className="surf sem-grille">
      <div className="ent" />
      {SEMAINE.map((d, i) => (
        <button key={i} className={`ent${d.auj ? ' auj' : ''}`} onClick={() => c.maj({ jour: i, vueAg: 'jour' })}>{JOURS_NOMS[i]}<b>{d.n}</b></button>
      ))}
      <div className="sem-heures">{heures.map(h => <span key={h} style={{ top: (h - H0) * px }}>{h}h</span>)}</div>
      {SEMAINE.map((d, i) => (
        <div key={i} className={`sem-col${d.auj ? ' auj' : ''}`}>
          {lignes}
          {rdvDuJour(i, c.etat).map(r => (
            <button key={`${r.h}-${r.nom}`} className={`bloc ${r.st === 'termine' || r.st === 'confirme' ? 'bloc-vert' : 'bloc-ambre'}`} style={pos(r.h, r.fin)} onClick={() => ouvrirRdv(c, r)}>
              {r.h} {r.nom}<small>{r.presta}</small>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function EcranAgenda({ c }: { c: Ctrl }) {
  const { dk, v, etat } = c
  const d = SEMAINE[v.jour]
  const vues = (
    <div className="segment seg-app" role="group" aria-label="Vue de l’agenda">
      {([['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois']] as const).filter(x => dk || x[0] !== 'semaine').map(([k, t]) => (
        <button key={k} onClick={() => c.maj({ vueAg: k })} aria-pressed={v.vueAg === k}>{t}</button>
      ))}
    </div>
  )

  if (dk) {
    const sous = v.vueAg === 'mois' ? 'Octobre 2026' : v.vueAg === 'jour' ? `${JOURS_NOMS[v.jour]} ${d.n} octobre` : '12 – 18 oct. · 13 rendez-vous cette semaine'
    return (
      <>
        <Titre t="Agenda" s={sous}
          droite={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{vues}<button className="btn btn-accent btn-petit" onClick={() => c.ouvrir({ t: 'f-rdv' })}>{I.plus}Ajouter</button></div>} />
        {v.vueAg === 'semaine' ? <AgendaSemaine c={c} /> : null}
        {v.vueAg === 'mois' ? <GrilleMois c={c} /> : null}
        {v.vueAg === 'jour' ? (
          <>
            <div className="semaine">
              {SEMAINE.map((x, i) => (
                <button key={i} className="jour" onClick={() => c.maj({ jour: i })} aria-pressed={i === v.jour}><small>{x.j}</small><b>{x.n}</b><i className={rdvDuJour(i, etat).length ? 'on' : ''} /></button>
              ))}
            </div>
            <div style={{ maxWidth: 560 }}><ListeJour c={c} i={v.jour} /></div>
          </>
        ) : null}
      </>
    )
  }

  const sem = (
    <div className="semaine">
      <span className="fl">{I.gauche}</span>
      {SEMAINE.map((x, i) => (
        <button key={i} className="jour" onClick={() => c.maj({ jour: i })} aria-pressed={i === v.jour}>
          <small>{x.j}</small><b>{x.n}</b><i className={i === 6 || etat.rdvPlus.some(r => r.jour === i) ? 'on' : ''} />
        </button>
      ))}
      <span className="fl">{I.chev}</span>
    </div>
  )
  return (
    <>
      <Titre t="Octobre" s={v.vueAg === 'mois' ? 'Vue du mois' : `${d.auj ? 'Aujourd’hui' : `${JOURS_NOMS[v.jour]} ${d.n}`} · ${rdvDuJour(v.jour, etat).length} rendez-vous`}
        droite={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`rond${v.vueAg === 'mois' ? ' actif' : ''}`} onClick={() => c.maj({ vueAg: v.vueAg === 'mois' ? 'jour' : 'mois' })} aria-pressed={v.vueAg === 'mois'} aria-label="Vue mois">{I.grille}</button>
            <button className="rond plein" onClick={() => c.ouvrir({ t: 'f-rdv' })} aria-label="Ajouter un rendez-vous">{I.plus}</button>
          </div>
        } />
      {v.vueAg === 'mois' ? <GrilleMois c={c} /> : <>{sem}<ListeJour c={c} i={v.jour} /></>}
    </>
  )
}

/* Clients */
function ListeClients({ c }: { c: Ctrl }) {
  const { dk, v, etat } = c
  const q = v.q.trim().toLowerCase()
  const l = tousClients(etat).map(x => clientVu(x.id, etat)).filter(x =>
    (v.filtre === 'tous' || (v.filtre === 'pros' && x.type === 'pro') || (v.filtre === 'relance' && x.relance)) && (!q || x.nom.toLowerCase().includes(q)))
  return (
    <>
      <div className="recherche">{I.loupe}<input value={v.q} onChange={e => c.maj({ q: e.target.value })} placeholder="Nom, téléphone, adresse" aria-label="Chercher un client" /></div>
      <div className="puces">
        {([['tous', 'Tous'], ['pros', 'Pros'], ['relance', 'À relancer']] as const).map(([k, t]) => (
          <button key={k} className="puce" onClick={() => c.maj({ filtre: k })} aria-pressed={v.filtre === k}>{t}</button>
        ))}
      </div>
      <div className="surf">
        {l.length ? l.map(x => (
          <button key={x.id} className="ligne" onClick={() => c.client(x.id)} style={dk && v.clientSel === x.id ? { background: 'var(--fond)' } : undefined} aria-current={dk && v.clientSel === x.id ? 'true' : undefined}>
            <span className="av">{ini(x.nom)}</span>
            <span className="corps"><span className="nom">{x.nom}</span><span className="det">{x.v ? `${x.v} prestations · ${x.der}` : 'Nouveau client'}</span></span>
            <span className="fin">
              {etat.nePlus[x.id] ? <span className="st st-gris">Ne plus contacter</span>
                : x.relance ? <span className="st st-ambre">À relancer</span>
                : x.ent ? <span className="st st-gris">Entreprise</span>
                : <span className="prix">{eur(x.ca)}</span>}
            </span>
          </button>
        )) : <p style={{ padding: 18, color: 'var(--gris)', textAlign: 'center' }}>Aucun client ne correspond.</p>}
      </div>
    </>
  )
}

function Fiche({ c, id }: { c: Ctrl; id: string }) {
  const { etat } = c
  const cl = clientVu(id, etat)
  const req = etat.r.fidReq
  const neuf = id === 'c1' && etat.cloture
  const date1 = id === 'c1' ? '12 sept.' : '3 oct.', date2 = id === 'c1' ? '28 juil.' : '1 août'
  return (
    <>
      <div className="fiche-tete">
        <span className="av">{ini(cl.nom)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="ecr-titre" style={{ fontSize: 21 }}>{cl.nom}</p>
          <p className="ecr-sous">{cl.veh}{cl.v ? ` · dernière visite ${cl.der}` : ''}</p>
        </div>
        <button className="rond" onClick={() => c.ouvrir({ t: 'actions', id })} aria-label="Actions sur la fiche">{I.plus3}</button>
      </div>
      <div className="surf stats3">
        <div><small>Prestations</small><b>{cl.v}</b></div>
        <div><small>Dépensé</small><b>{eur(cl.ca)}</b></div>
        <div><small>Panier moyen</small><b>{eur(cl.v ? Math.round(cl.ca / cl.v) : 0)}</b></div>
      </div>
      <div className="sec-lib"><span>Carte de fidélité</span><span>{Math.min(cl.t, req)} / {req}</span></div>
      <CarteStatique tampons={Math.min(cl.t, req)} requis={req} saute={neuf} couleur={etat.r.couleur} recompense={etat.r.fidRec} />
      {cl.relance && !etat.nePlus[id] ? (
        <>
          <div className="sec-lib"><span>Relance</span></div>
          <div className="surf"><div className="reglage"><div>Pas revenue depuis 94 jours<small>Une relance part automatiquement par SMS.</small></div><span className="st st-ambre">Prévue</span></div></div>
        </>
      ) : null}
      {etat.nePlus[id] ? (
        <>
          <div className="sec-lib"><span>Contact</span></div>
          <div className="surf"><div className="reglage"><div>Ne plus contacter<small>Exclu des relances et des demandes d’avis.</small></div><span className="st st-gris">Actif</span></div></div>
        </>
      ) : null}
      <div className="sec-lib"><span>Historique</span></div>
      <div className="surf">
        {cl.v ? (
          <>
            {neuf ? (
              <div className="ligne"><span className="h">17 oct.</span><span className="corps"><span className="nom">Extérieur + intérieur</span><span className="det">Facture F-00043</span></span><span className="fin"><span className="prix">59 €</span><br /><Statut s="termine" /></span></div>
            ) : null}
            <div className="ligne"><span className="h">{date1}</span><span className="corps"><span className="nom">{id === 'c4' ? 'Forfait flotte' : 'Lavage complet'}</span><span className="det">Facture F-00031</span></span><span className="fin"><span className="prix">{id === 'c4' ? '210 €' : '59 €'}</span><br /><Statut s="termine" /></span></div>
            <div className="ligne"><span className="h">{date2}</span><span className="corps"><span className="nom">Extérieur + intérieur</span><span className="det">Facture F-00019</span></span><span className="fin"><span className="prix">59 €</span><br /><Statut s="termine" /></span></div>
          </>
        ) : <div className="ligne"><span className="corps"><span className="det">Pas encore de prestation.</span></span></div>}
      </div>
    </>
  )
}

export function EcranClients({ c }: { c: Ctrl }) {
  const { dk, v, etat } = c
  const ajout = <button className="rond plein" onClick={() => c.ouvrir({ t: 'f-client' })} aria-label="Ajouter un client">{I.plus}</button>
  const tete = <Titre t="Clients" s={`${48 + etat.clientsPlus.length} clients · 6 pros`} droite={ajout} />
  if (dk) {
    return (
      <>
        {tete}
        <div className="cli-cols">
          <div><ListeClients c={c} /></div>
          <div className="surf" style={{ padding: 16, alignSelf: 'start' }}><Fiche c={c} id={v.clientSel} /></div>
        </div>
      </>
    )
  }
  if (v.fiche) return <><button className="retour" onClick={() => c.nav({ fiche: null })}>{I.gauche}Clients</button><Fiche c={c} id={v.fiche} /></>
  return <>{tete}<ListeClients c={c} /></>
}

/* Chiffres */
export function EcranChiffres({ c }: { c: Ctrl }) {
  const { dk, v, etat } = c
  const onglets = (
    <div className="puces" style={{ marginTop: 0 }}>
      {([['argent', 'Argent'], ['acquisition', 'Acquisition'], ['clients', 'Clients']] as const).map(([k, t]) => (
        <button key={k} className="puce" onClick={() => c.maj({ onglet: k, barre: null })} aria-pressed={v.onglet === k}>{t}</button>
      ))}
      <span className="puce" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center' }}>Octobre 2026</span>
    </div>
  )
  const tete = (
    <>
      {!dk && v.sous === 'chiffres' ? <RetourPlus c={c} /> : null}
      <Titre t="Chiffres" s="Argent, acquisition et clients" />
      {onglets}
    </>
  )
  let b1, b2
  if (v.onglet === 'argent') {
    const enc = encaisse(etat), dep = totalDepenses(etat), res = enc - dep
    const vals = [...JOURS_MOIS.slice(0, 16), JOURS_MOIS[16] + 120 + (etat.cloture ? 59 : 0)]
    const max = Math.max(...vals)
    const info = v.barre != null ? `${v.barre + 1} octobre : ${eur(vals[v.barre])}` : 'Touche une barre pour lire sa valeur'
    b1 = (
      <>
        <div className="surf" style={{ padding: '16px 16px 4px' }}>
          <small style={{ color: 'var(--gris)', fontSize: 12.5 }}>Résultat du mois</small>
          <div className="heros-chiffre">{eur(res)}</div>
          <p className="var-vert">+18 % par rapport à septembre, au même jour</p>
        </div>
        <div className="surf" style={{ marginTop: 10 }}>
          <div className="duo-chiffres"><div><small>Encaissé</small><b>{eur(enc)}</b></div><div style={{ textAlign: 'right' }}><small>Dépensé</small><b>{eur(dep)}</b></div></div>
          <div className="graph">
            <div className="lib"><span>{info}</span></div>
            <div className="barres">
              {Array.from({ length: 31 }, (_, i) => {
                const x = vals[i]
                return x === undefined
                  ? <button key={i} className="vide" style={{ height: 2 }} disabled aria-hidden tabIndex={-1} />
                  : <button key={i} style={{ height: `${Math.max(2, (x / max) * 100)}%` }} onClick={() => c.maj({ barre: v.barre === i ? null : i })} aria-pressed={v.barre === i} aria-label={`${i + 1} octobre : ${eur(x)}`} />
              })}
            </div>
            <div className="axe"><span>1</span><span>8</span><span>15</span><span>22</span><span>31</span></div>
          </div>
        </div>
      </>
    )
    b2 = (
      <>
        <div className="sec-lib"><span>Dépenses</span><button onClick={() => c.ouvrir({ t: 'f-depense' })}>+ Ajouter un frais</button></div>
        <div className="surf">
          {[...etat.depenses, ...DEPENSES].map((d, i) => (
            <div className="ligne" key={i}><span className="corps"><span className="nom">{d.l}</span><span className="det">{d.c}</span></span><span className="prix">{eur(d.p)}</span></div>
          ))}
        </div>
      </>
    )
  } else if (v.onglet === 'acquisition') {
    b1 = (
      <>
        <div className="surf" style={{ padding: '16px 16px 12px' }}>
          <small style={{ color: 'var(--gris)', fontSize: 12.5 }}>Visiteurs de ta page ce mois</small>
          <div className="heros-chiffre">1 240</div>
          <p className="var-vert">86 réservations · 6,9 % de conversion</p>
        </div>
        <div className="sec-lib"><span>D’où viennent tes réservations</span></div>
        <Sources />
      </>
    )
    b2 = (
      <>
        <div className="sec-lib"><span>Le parcours de tes visiteurs</span></div>
        <div className="surf">
          {[['Ont vu ta page', '1 240'], ['Ont choisi une prestation', '412'], ['Ont choisi un créneau', '168'], ['Ont réservé', '86']].map(([t, n]) => (
            <div className="ligne" key={t}><span className="corps"><span className="nom">{t}</span></span><span className="prix">{n}</span></div>
          ))}
        </div>
        <p className="ecr-sous" style={{ margin: '10px 4px' }}>Les liens par réseau (Plus › Mes liens) remplissent ces sources.</p>
      </>
    )
  } else {
    b1 = (
      <>
        <div className="surf" style={{ padding: '16px 16px 12px' }}>
          <small style={{ color: 'var(--gris)', fontSize: 12.5 }}>Clients fidèles (3 visites ou plus)</small>
          <div className="heros-chiffre">18</div>
          <p className="var-vert">38 % de ton fichier · panier moyen 61 €</p>
        </div>
        <div className="surf" style={{ marginTop: 10 }}>
          <div className="duo-chiffres"><div><small>Nouveaux ce mois</small><b>{3 + etat.clientsPlus.length}</b></div><div style={{ textAlign: 'right' }}><small>À relancer</small><b>4</b></div></div>
        </div>
      </>
    )
    b2 = (
      <>
        <div className="sec-lib"><span>Tes meilleurs clients</span></div>
        <div className="surf">
          {tousClients(etat).map(x => clientVu(x.id, etat)).sort((a, b) => b.ca - a.ca).slice(0, 5).map(x => (
            <button key={x.id} className="ligne" onClick={() => c.client(x.id)}>
              <span className="av">{ini(x.nom)}</span>
              <span className="corps"><span className="nom">{x.nom}</span><span className="det">{x.v} prestations</span></span>
              <span className="prix">{eur(x.ca)}</span>
            </button>
          ))}
        </div>
      </>
    )
  }
  return dk ? <>{tete}<div className="dk-cols"><div>{b1}</div><div>{b2}</div></div></> : <>{tete}{b1}{b2}</>
}

/* Documents */
export function EcranDocs({ c }: { c: Ctrl }) {
  const { dk, v, etat } = c
  const docs = tousDocs(etat)
  const l = docs.filter(d => v.filtreDoc === 'tous' || (v.filtreDoc === 'factures' && d.t === 'Facture') || (v.filtreDoc === 'devis' && d.t === 'Devis'))
  const stc = (s: string) => (s === 'Payée' ? 'st-vert' : s === 'En attente' ? 'st-ambre' : 'st-gris')
  return (
    <>
      {!dk && v.sous === 'docs' ? <RetourPlus c={c} /> : null}
      <Titre t="Devis et factures" s={`${docs.length} documents · numérotation continue`}
        droite={<button className="rond plein" onClick={() => c.ouvrir({ t: 'f-facture' })} aria-label="Nouvelle facture">{I.plus}</button>} />
      <div className="puces" style={{ marginTop: 0 }}>
        {([['tous', 'Tous'], ['factures', 'Factures'], ['devis', 'Devis']] as const).map(([k, t]) => (
          <button key={k} className="puce" onClick={() => c.maj({ filtreDoc: k })} aria-pressed={v.filtreDoc === k}>{t}</button>
        ))}
      </div>
      <div className="surf">
        {l.map(d => (
          <button key={d.n} className="ligne" onClick={() => c.ouvrir({ t: 'doc', n: d.n })}>
            <span className="corps"><span className="nom">{d.n} · {d.cli}</span><span className="det">{d.t} du {d.date}</span></span>
            <span className="fin"><span className="prix">{eur(d.p)}</span><br /><span className={`st ${stc(d.st)}`}>{d.st}</span></span>
          </button>
        ))}
      </div>
    </>
  )
}
