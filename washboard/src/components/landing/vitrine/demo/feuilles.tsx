'use client'

import type { ReactNode } from 'react'
import type { Ctrl } from './ctrl'
import { RDV, eur } from './donnees'
import { Champ, Choix, Statut } from './elements'
import { clientVu, statutRdv, tousClients, tousDocs } from './etat'
import { I } from './icones'
import type { Feuille } from './types'

function Tete({ t, s }: { t: ReactNode; s?: string }) {
  return <><div className="poignee" /><p className="f-titre">{t}</p>{s ? <p className="sous">{s}</p> : null}</>
}

function Fermer({ c }: { c: Ctrl }) {
  return <button className="btn" style={{ color: 'var(--gris)' }} onClick={c.fermer}>Fermer</button>
}

function Lignes({ l }: { l: [string, ReactNode, boolean?][] }) {
  return <div className="f-lignes">{l.map(([k, val, num]) => <div className="f-ligne" key={k}><span>{k}</span><b className={num ? 'num' : undefined}>{val}</b></div>)}</div>
}

/** Une facture part par email aux clients pros ; un particulier la retrouve depuis son lien de confirmation. */
const estPro = (c: Ctrl, nom: string) => tousClients(c.etat).some(x => x.nom === nom && x.type === 'pro')

export function ContenuFeuille({ c, f }: { c: Ctrl; f: Feuille }) {
  const { etat } = c
  const noms = tousClients(etat).map(x => x.nom).slice(0, 4)

  switch (f.t) {
    case 'rdv': {
      const r = RDV.find(x => x.id === f.id)!
      const s = statutRdv(r, etat)
      return (
        <>
          <Tete t={r.nom} s={`${r.presta} · ${r.veh}`} />
          <Lignes l={[['Horaire', `Sam. 17 oct. · ${r.h} – ${r.fin}`, true], ['Adresse', r.lieu], ['Prix', eur(r.prix), true], ['Statut', <Statut key="s" s={s} />]]} />
          <div className="f-actions">
            {s === 'cloturer' ? <button className="btn btn-encre" onClick={() => c.maj({ feuille: { t: 'cloture' } })}>Marquer terminé</button> : null}
            {s === 'attente' ? <button className="btn btn-encre" onClick={() => c.toast('Rendez-vous confirmé : Garage Renault Mérignac reçoit un email.')}>Confirmer le rendez-vous</button> : null}
            <button className="btn btn-ligne" onClick={() => c.client(r.cli!)}>Voir la fiche client</button>
            <Fermer c={c} />
          </div>
        </>
      )
    }
    case 'rdvinfo':
      return (
        <>
          <Tete t={f.nom} s={f.presta} />
          <Lignes l={[['Horaire', f.h, true], ['Prix', eur(f.prix), true], ['Statut', <Statut key="s" s={f.st} />]]} />
          <div className="f-actions"><Fermer c={c} /></div>
        </>
      )
    case 'cloture':
      return (
        <>
          <Tete t="Avez-vous fait ce rendez-vous ?" s="Camille Lefebvre · 11:30 · Extérieur + intérieur" />
          <div className="champ"><span className="num">59,00 €</span><small>montant encaissé</small></div>
          <div className="f-actions">
            <button className="btn btn-accent" onClick={() => { c.fermer(); c.dispatch({ t: 'cloturer' }); c.toast('Terminé. Facture F-00043 créée, et le 4e tampon de Camille est arrivé.') }}>{I.ok}Oui, je l’ai fait</button>
            <button className="btn btn-ligne" onClick={c.fermer}>Pas encore</button>
          </div>
        </>
      )
    case 'nouveau':
      return (
        <>
          <Tete t="Nouveau" s="Que veux-tu ajouter ?" />
          <div className="choix-n">
            {([['agenda', 'Rendez-vous', 'f-rdv'], ['clients', 'Client', 'f-client'], ['doc', 'Devis', 'f-devis'], ['facture', 'Facture', 'f-facture'], ['euro', 'Dépense', 'f-depense'], ['tel', 'Rappel', 'f-rappel']] as const).map(([ic, t, k]) => (
              <button key={k} onClick={() => c.ouvrir({ t: k })}>{I[ic]}{t}</button>
            ))}
          </div>
          <div className="f-actions"><Fermer c={c} /></div>
        </>
      )
    case 'f-rdv':
      return (
        <>
          <Tete t="Nouveau rendez-vous" s="Ajouté à la main, sans passer par ta page" />
          <div className="fform">
            <small className="flib">Client</small><Choix c={c} nom="r-cli" opts={noms} def="Nadia Saïdi" />
            <small className="flib">Prestation</small><Choix c={c} nom="r-presta" opts={['Extérieur', 'Intérieur', 'Lavage complet']} def="Lavage complet" />
            <small className="flib">Jour</small><Choix c={c} nom="r-jour" opts={['Dim. 18', 'Lun. 12', 'Mar. 13']} def="Dim. 18" />
            <Champ c={c} nom="r-h" lib="Heure" def="14:00" type="time" />
          </div>
          <div className="f-actions"><button className="btn btn-encre" onClick={() => c.creer('rdv')}>Ajouter à l’agenda</button><Fermer c={c} /></div>
        </>
      )
    case 'f-client':
      return (
        <>
          <Tete t="Nouveau client" />
          <div className="fform">
            <Champ c={c} nom="c-nom" lib="Nom" def="Inès Garnier" />
            <Champ c={c} nom="c-tel" lib="Téléphone" def="06 98 76 54 32" />
            <Champ c={c} nom="c-veh" lib="Véhicule" def="Clio V" />
          </div>
          <div className="f-actions"><button className="btn btn-encre" onClick={() => c.creer('client')}>Ajouter le client</button><Fermer c={c} /></div>
        </>
      )
    case 'f-devis':
    case 'f-facture': {
      const devis = f.t === 'f-devis'
      return (
        <>
          <Tete t={devis ? 'Nouveau devis' : 'Nouvelle facture'} s={devis ? 'Le client l’accepte en un clic' : 'Numéro attribué automatiquement'} />
          <div className="fform">
            <small className="flib">Client</small><Choix c={c} nom="d-cli" opts={noms} def="Garage Renault Mérignac" />
            <Champ c={c} nom="d-lib" lib="Prestation" def="Forfait flotte · 3 véhicules" />
            <Champ c={c} nom="d-p" lib="Montant (€)" def="210" type="number" />
          </div>
          <div className="f-actions"><button className="btn btn-encre" onClick={() => c.creer(devis ? 'devis' : 'facture')}>{devis ? 'Créer et envoyer le devis' : 'Créer la facture'}</button><Fermer c={c} /></div>
        </>
      )
    }
    case 'f-depense':
      return (
        <>
          <Tete t="Nouvelle dépense" s="Elle s’ajoute à tes chiffres du mois" />
          <div className="fform">
            <Champ c={c} nom="e-lib" lib="Libellé" def="Cire carnauba" />
            <small className="flib">Catégorie</small><Choix c={c} nom="e-cat" opts={['Produits', 'Carburant', 'Équipement']} def="Produits" />
            <Champ c={c} nom="e-p" lib="Montant (€)" def="38" type="number" />
          </div>
          <div className="f-actions"><button className="btn btn-encre" onClick={() => c.creer('depense')}>Ajouter la dépense</button><Fermer c={c} /></div>
        </>
      )
    case 'f-rappel':
      return (
        <>
          <Tete t="Nouveau rappel" s="Un pense-bête sur une fiche client" />
          <div className="fform">
            <small className="flib">Client</small><Choix c={c} nom="t-cli" opts={noms} def="Sophie Lambert" />
            <Champ c={c} nom="t-txt" lib="À faire" def="Proposer le traitement céramique" />
          </div>
          <div className="f-actions"><button className="btn btn-encre" onClick={() => c.creer('rappel')}>Ajouter le rappel</button><Fermer c={c} /></div>
        </>
      )
    case 'itin':
      return (
        <>
          <Tete t="Itinéraire" s="3 avenue Thiers, Bastide · 9 min" />
          <div className="f-actions">
            {['Google Maps', 'Waze', 'Plans'].map(a => <button key={a} className="btn btn-ligne" onClick={() => c.toast(`Ouverture de ${a} vers 3 avenue Thiers.`)}>Ouvrir avec {a}</button>)}
            <Fermer c={c} />
          </div>
        </>
      )
    case 'appel':
      return (
        <>
          <Tete t="Marc Dubreuil" s="Client depuis août · 2 prestations" />
          <div className="champ" style={{ fontSize: 20 }}><span className="num">06 45 12 78 90</span><small>mobile</small></div>
          <div className="f-actions">
            <button className="btn btn-accent" onClick={() => c.toast('Appel en cours vers Marc Dubreuil (démo).')}>{I.tel}Appeler</button>
            <button className="btn btn-ligne" onClick={() => c.toast('SMS prêt : « Bonjour Marc, j’arrive dans 10 minutes. »')}>Envoyer « J’arrive dans 10 min »</button>
            <Fermer c={c} />
          </div>
        </>
      )
    case 'proposer':
      return (
        <>
          <Tete t="Proposer ce créneau" s={`3 clients habitent près de ${f.ou}`} />
          <label className="fchamp" style={{ marginTop: 12 }}>
            <small>Message</small>
            <textarea rows={4} value={c.v.form.msg ?? `Bonjour ! Un créneau se libère ${f.quand} près de chez vous. Ça vous dit ? Réservez ici : washboard.fr/book/eclat-mobile`} onChange={e => c.setForm('msg', e.target.value)} />
          </label>
          <div className="f-actions"><button className="btn btn-encre" onClick={() => c.toast('Envoyé à Nadia, Karim et Lucas. La première réponse prend le créneau.')}>Envoyer aux 3 clients</button><Fermer c={c} /></div>
        </>
      )
    case 'options':
      return (
        <>
          <Tete t="Ta journée" s="Samedi 17 octobre" />
          <div className="f-actions">
            <button className="btn btn-ligne" onClick={() => c.toast('Tournée lancée : les rendez-vous s’enchaînent dans l’ordre le plus court.')}>Commencer la tournée</button>
            <button className="btn btn-ligne" onClick={() => c.toast('Journée bloquée : plus aucune réservation possible aujourd’hui.')}>Bloquer le reste de la journée</button>
            <button className="btn btn-ligne" onClick={() => c.toast('Ta journée est partagée avec ton équipe.')}>Partager ma journée</button>
            <Fermer c={c} />
          </div>
        </>
      )
    case 'actions': {
      const cl = clientVu(f.id, etat)
      const non = !!etat.nePlus[f.id]
      return (
        <>
          <Tete t={cl.nom} s="Actions sur la fiche" />
          <div className="f-actions">
            <button className="btn btn-ligne" onClick={() => c.ouvrir({ t: 'f-rappel' })}>Ajouter un rappel</button>
            <button className="btn btn-ligne" onClick={() => { c.dispatch({ t: 'nePlus', id: f.id }); c.fermer(); c.toast(non ? 'Ce client peut de nouveau être contacté.' : 'Ce client ne recevra plus ni relance ni demande d’avis.') }}>{non ? 'Recontacter ce client' : 'Ne plus contacter'}</button>
            <button className="btn btn-ligne" onClick={() => c.toast('Export de toutes ses données prêt (RGPD).')}>Exporter ses données</button>
            <button className="btn btn-ligne" onClick={() => c.toast('Fiche modifiable : nom, téléphone, véhicules, notes.')}>Modifier la fiche</button>
            <Fermer c={c} />
          </div>
        </>
      )
    }
    case 'doc': {
      const d = tousDocs(etat).find(x => x.n === f.n)
      if (!d) return null
      const facture = d.t === 'Facture'
      const mail = !facture || estPro(c, d.cli)
      return (
        <>
          <Tete t={`${d.t} ${d.n}`} s={d.cli} />
          <Lignes l={[['Date', d.date], ['Montant', eur(d.p), true], ['Statut', d.st]]} />
          <div className="f-actions">
            {facture && d.st !== 'Payée' ? <button className="btn btn-encre" onClick={() => { c.dispatch({ t: 'payer', n: d.n }); c.fermer(); c.toast(`Facture ${d.n} marquée payée : elle entre dans l’encaissé.`) }}>Marquer payée</button> : null}
            {!facture ? <button className="btn btn-encre" onClick={() => c.toast('Devis accepté : la facture est créée depuis son contenu.')}>Le client a accepté</button> : null}
            {mail
              ? <button className="btn btn-ligne" onClick={() => c.toast(`${d.t} renvoyé${facture ? 'e' : ''} par email à ${d.cli}.`)}>Renvoyer par email</button>
              : <button className="btn btn-ligne" onClick={() => c.toast(`Lien de la facture copié : ${d.cli} la retrouve aussi depuis son lien de confirmation.`)}>Copier le lien de la facture</button>}
            <Fermer c={c} />
          </div>
        </>
      )
    }
  }
}
