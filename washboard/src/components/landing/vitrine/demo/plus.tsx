'use client'

import type { CSSProperties, ReactNode } from 'react'
import { CarteStatique, CompteARebours } from './composants'
import type { Ctrl } from './ctrl'
import { GUIDE } from './donnees'
import { Bascule, Champ, Pas, PuceReg, RetourPlus, Titre } from './elements'
import { EcranChiffres, EcranDocs } from './ecrans'
import { tousDocs } from './etat'
import { I } from './icones'
import type { SousEcran } from './types'

const note: CSSProperties = { margin: '12px 4px' }

function LignePlus({ c, t, s, val, nouveau }: { c: Ctrl; t: string; s: string; val: SousEcran; nouveau?: boolean }) {
  return (
    <button className="ligne" onClick={() => { c.nav({ sous: val, guide: null }); if (val === 'chiffres') c.dispatch({ t: 'mission', k: 'chiffres' }) }}>
      <span className="corps"><span className="nom">{t} {nouveau ? <span className="badge badge-new">Nouveau</span> : null}</span><span className="det">{s}</span></span>
      <span className="chev">{I.chev}</span>
    </button>
  )
}

function Section({ t, premier, children }: { t: string; premier?: boolean; children: ReactNode }) {
  return <><div className="sec-lib" style={premier ? { marginTop: 0 } : undefined}><span>{t}</span></div><div className="surf">{children}</div></>
}

function Reg({ t, s, children, bloc }: { t: ReactNode; s?: string; children?: ReactNode; bloc?: boolean }) {
  return <div className="reglage" style={bloc ? { display: 'block' } : undefined}><div>{t}{s ? <small>{s}</small> : null}</div>{children}</div>
}

function SousPromo({ c }: { c: Ctrl }) {
  const { promo } = c.etat
  const bascule = () => {
    c.dispatch({ t: 'promo', on: !promo })
    if (!promo) c.toast('Promotion en ligne : le bandeau apparaît sur ta page de réservation.')
  }
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Promotions" s="Une remise pendant une période, annoncée sur ta page" />
      <div className="surf"><Reg t="−10 % ce week-end" s="Toutes les prestations · jusqu’à dimanche 23 h 59"><button className="interr" role="switch" aria-checked={promo} onClick={bascule} aria-label="Activer la promotion" /></Reg></div>
      <div className="sec-lib"><span>Le bandeau sur ta page</span></div>
      <div className="bandeau-promo"><span><b>−10 % ce week-end</b> sur toutes les prestations</span><CompteARebours /></div>
      <p className="ecr-sous" style={note}>{promo ? 'Elle est en ligne : regarde la page de réservation plus bas sur cette page.' : 'Active-la pour la voir apparaître sur ta page de réservation.'}</p>
    </>
  )
}

function SousFid({ c }: { c: Ctrl }) {
  const { r } = c.etat
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Carte de fidélité" s="Un tampon à chaque prestation terminée" />
      <CarteStatique tampons={3} requis={r.fidReq} couleur={r.couleur} recompense={r.fidRec} />
      <div className="surf" style={{ marginTop: 12 }}>
        <Reg t="Tampons pour la récompense" s="De 3 à 20"><Pas c={c} cle="fidReq" /></Reg>
        <Reg bloc t="Récompense" s="Appliquée toute seule à la réservation suivante"><PuceReg c={c} cle="fidRec" opts={['Lavage complet offert', '−20 %', '−10 €']} /></Reg>
        <Reg t="Un tampon par véhicule" s="Pour les forfaits à plusieurs voitures"><Bascule c={c} cle="parVeh" lib="Un tampon par véhicule" /></Reg>
      </div>
      <p className="ecr-sous" style={note}>La carte du client, sur la page de réservation, suit ces réglages.</p>
    </>
  )
}

function SousAcompte({ c }: { c: Ctrl }) {
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Acompte" s="Payé par ton lien, à la réservation" />
      <div className="surf">
        <Reg t="Demander un acompte" s="WashBoard n’encaisse rien"><Bascule c={c} cle="acompteOn" lib="Demander un acompte" /></Reg>
        <Reg bloc t="Montant"><PuceReg c={c} cle="acompte" opts={[20, 30, 50]} fmt={x => `${x} %`} /></Reg>
        <Reg bloc t="Délai pour payer" s="Sinon le créneau se libère tout seul"><PuceReg c={c} cle="acDelai" opts={[1, 2, 24]} fmt={x => `${x} h`} /></Reg>
        <Reg bloc t="Ton lien de paiement"><PuceReg c={c} cle="acLien" opts={['PayPal', 'Stripe', 'SumUp', 'Lydia', 'Wero', 'Virement']} /></Reg>
        <Reg t="Remboursement" s="Annoncé au client avant de réserver"><b>48 h avant</b></Reg>
      </div>
    </>
  )
}

function SousPrestations({ c }: { c: Ctrl }) {
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Prestations et prix" s="Par catégorie et par type de véhicule" />
      <div className="sec-lib" style={{ marginTop: 0 }}><span>Voiture</span><span>Citadine</span></div>
      <div className="surf">
        <Reg t="Extérieur" s="Carrosserie, jantes, vitres · 45 min"><b className="num">35 €</b></Reg>
        <Reg t="Intérieur" s="Aspiration, plastiques, tapis · 1 h"><b className="num">45 €</b></Reg>
        <Reg t="Lavage complet" s="Intérieur et extérieur · 1 h 30"><Pas c={c} cle="prixComplet" unite=" €" /></Reg>
      </div>
      <div className="sec-lib"><span>Selon le véhicule</span></div>
      <div className="surf">{[['Berline', '+5 €'], ['SUV', '+10 €'], ['Utilitaire', '+20 €']].map(([n, p]) => <Reg key={n} t={n}><b className="num">{p}</b></Reg>)}</div>
      <div className="sec-lib"><span>Canapés et textiles</span></div>
      <div className="surf"><Reg t="Canapé 3 places" s="Injection-extraction · 1 h 30"><b className="num">90 €</b></Reg></div>
      <p className="ecr-sous" style={note}>Change le prix du lavage complet : la page de réservation plus bas suit.</p>
    </>
  )
}

function SousHoraires({ c }: { c: Ctrl }) {
  const { horaires } = c.etat.r
  const j = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Horaires" s="Les créneaux proposés à tes clients" />
      <div className="surf">
        {j.map((n, i) => (
          <Reg key={n} t={n} s={horaires[i] ? '8:00 – 19:00' : 'Fermé'}>
            <button className="interr" role="switch" aria-checked={horaires[i]} aria-label={`${n} ouvert`} onClick={() => c.regler({ horaires: horaires.map((x, k) => (k === i ? !x : x)) })} />
          </Reg>
        ))}
      </div>
      <div className="sec-lib"><span>Congés à venir</span></div>
      <div className="surf"><Reg t="Vacances" s="4 → 7 novembre · toute l’équipe"><span className="st st-gris">Bloqué</span></Reg></div>
    </>
  )
}

function SousApparence({ c }: { c: Ctrl }) {
  const { couleur } = c.etat.r
  const cs = ['#306090', '#16161A', '#0F7A55', '#C2185B', '#6D28D9', '#E0533D']
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Apparence de ma page" s="Ce que voient tes clients" />
      <div className="apercu-page" style={{ background: couleur }}><span className="lg">ÉM</span><b>Éclat Mobile</b><small>Lavage auto à domicile · Bordeaux</small></div>
      <div className="surf" style={{ marginTop: 12 }}>
        <Reg bloc t="Couleur de ta page" s="Elle colore aussi la carte de fidélité">
          <div className="nuances" style={{ marginTop: 10 }}>
            {cs.map(x => <button key={x} className="nuance" style={{ background: x }} onClick={() => c.regler({ couleur: x })} aria-pressed={couleur === x} aria-label={`Couleur ${x}`} />)}
          </div>
        </Reg>
        <Reg t="Logo" s="Carré, fond transparent conseillé"><b>ÉM</b></Reg>
        <Reg t="Photo de fond" s="Visible en haut de ta page"><b>Aucune</b></Reg>
      </div>
      <p className="ecr-sous" style={note}>Choisis une couleur : la page de réservation plus bas change aussi.</p>
    </>
  )
}

function copier(c: Ctrl, lien: string) {
  const presse = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  if (!presse) { c.toast(lien); return }
  presse.writeText(lien).then(() => c.toast('Lien copié.'), () => c.toast(lien))
}

function SousLiens({ c }: { c: Ctrl }) {
  const l = [['Instagram', 'instagram'], ['TikTok', 'tiktok'], ['Google', 'google'], ['WhatsApp', 'whatsapp']]
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Mes liens" s="Un lien par réseau, pour savoir d’où viennent tes clients" />
      <div className="surf">
        {l.map(([n, k]) => (
          <div className="reglage" key={k}>
            <div>{n}<small className="num">washboard.fr/book/eclat-mobile?src={k}</small></div>
            <button className="btn btn-ligne btn-mini" onClick={() => copier(c, `https://washboard.fr/book/eclat-mobile?src=${k}`)}>Copier</button>
          </div>
        ))}
      </div>
    </>
  )
}

function SousAvis({ c }: { c: Ctrl }) {
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Avis Google" s="Une demande après chaque prestation terminée" />
      <div className="surf">
        <Reg t="Demander un avis" s="Après chaque prestation terminée"><Bascule c={c} cle="avis" lib="Demander un avis" /></Reg>
        <Reg bloc t="Envoyé par"><PuceReg c={c} cle="canal" opts={['Email', 'SMS']} /></Reg>
        <Reg t="Délai après la prestation"><Pas c={c} cle="delai" unite=" h" /></Reg>
        <Reg bloc t="SMS ce mois" s="12 envoyés sur 150 inclus"><span className="jauge-l"><i style={{ width: '8%' }} /></span></Reg>
      </div>
      <div className="sec-lib"><span>Ce que reçoit ton client</span></div>
      <div className="bulle-sms">Merci pour votre confiance ! Si vous avez 30 secondes, votre avis nous aide beaucoup : <u>g.page/eclat-mobile</u></div>
    </>
  )
}

function SousRelance({ c }: { c: Ctrl }) {
  const { r } = c.etat
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Relance client" s="Faire revenir un client qui ne réserve plus" />
      <div className="surf">
        <Reg t="Relancer automatiquement" s="4 clients concernés ce mois"><Bascule c={c} cle="relance" lib="Relancer automatiquement" /></Reg>
        <Reg bloc t="Après combien de temps sans rendez-vous ?"><PuceReg c={c} cle="relMois" opts={[1, 2, 3, 6]} fmt={x => `${x} mois`} /></Reg>
      </div>
      <div className="sec-lib"><span>Le message</span></div>
      <div className="bulle-sms">Bonjour, ça fait {r.relMois} mois depuis votre dernier lavage. Un créneau cette semaine ? Réservez en 1 minute : <u>washboard.fr/book/eclat-mobile</u></div>
    </>
  )
}

function SousProfil({ c }: { c: Ctrl }) {
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Mon profil" s="Ce qui apparaît sur tes factures" />
      <div className="surf" style={{ padding: '6px 14px 14px' }}>
        <Champ c={c} nom="p-ent" lib="Nom de l’entreprise" def="Éclat Mobile" />
        <Champ c={c} nom="p-nom" lib="Ton nom" def="Julien Roussel" />
        <Champ c={c} nom="p-tel" lib="Téléphone" def="06 12 34 56 78" />
        <Champ c={c} nom="p-adr" lib="Adresse de départ" def="14 cours Victor Hugo, Bordeaux" />
        <Champ c={c} nom="p-siret" lib="SIRET" def="912 345 678 00012" />
      </div>
      <div className="f-actions"><button className="btn btn-encre" onClick={() => c.toast('Profil enregistré. Tes prochaines factures le reprennent.')}>Enregistrer</button></div>
    </>
  )
}

function SousAbonnement({ c }: { c: Ctrl }) {
  const o = [['Découverte', '0 €', '5 réservations par mois'], ['Starter', '19 €/mois', 'Compta, factures, avis, relances'], ['Pro', '49 €/mois', 'Illimité, créneaux groupés'], ['Business', 'dès 129 €/mois', 'Équipe, planning collectif']]
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Abonnement" s="Pro · essai gratuit jusqu’au 14 novembre" />
      <div className="surf" style={{ padding: 16 }}>
        <small style={{ color: 'var(--gris)' }}>Ton essai</small>
        <div className="heros-chiffre" style={{ fontSize: 34 }}>27 jours</div>
        <p className="var-vert">Tout est débloqué, sans carte bancaire</p>
      </div>
      <div className="surf" style={{ marginTop: 12 }}>
        {o.map(([n, p, d]) => (
          <Reg key={n} t={<>{n} <span className="num" style={{ color: 'var(--gris)', fontWeight: 450 }}>· {p}</span></>} s={d}>
            {n === 'Pro' ? <span className="st st-vert">Ton essai</span> : <button className="btn btn-ligne btn-mini" onClick={() => c.toast('Paiement sécurisé par Stripe (démo).')}>Choisir</button>}
          </Reg>
        ))}
      </div>
    </>
  )
}

function SousGuide({ c }: { c: Ctrl }) {
  const { v } = c
  const q = v.qGuide.trim().toLowerCase()
  const l = GUIDE.map((g, i) => [g, i] as const).filter(([g]) => !q || (g[0] + g[1]).toLowerCase().includes(q))
  return (
    <>
      <RetourPlus c={c} />
      <Titre t="Guide" s="Toutes les réponses, écran par écran" />
      <div className="recherche">{I.loupe}<input value={v.qGuide} onChange={e => c.maj({ qGuide: e.target.value })} placeholder="Chercher : fidélité, acompte…" aria-label="Chercher dans le guide" /></div>
      <div className="surf" style={{ marginTop: 12 }}>
        {l.length ? l.map(([g, i]) => (
          <button key={i} className="ligne" style={{ display: 'block' }} onClick={() => c.maj({ guide: v.guide === i ? null : i })} aria-expanded={v.guide === i}>
            <span className="nom" style={{ whiteSpace: 'normal' }}>{g[0]}</span>
            {v.guide === i ? <span className="det" style={{ whiteSpace: 'normal', marginTop: 6, lineHeight: 1.45 }}>{g[1]}</span> : null}
          </button>
        )) : <p style={{ padding: 18, color: 'var(--gris)', textAlign: 'center' }}>Aucune réponse ne correspond.</p>}
      </div>
    </>
  )
}

export function EcranPlus({ c }: { c: Ctrl }) {
  const { dk, v, etat } = c
  const sous = v.sous
  if (sous === 'docs') return <EcranDocs c={c} />
  if (sous === 'chiffres') return <EcranChiffres c={c} />
  if (sous === 'promo') return <SousPromo c={c} />
  if (sous === 'fid') return <SousFid c={c} />
  if (sous === 'acompte') return <SousAcompte c={c} />
  if (sous === 'prestations') return <SousPrestations c={c} />
  if (sous === 'horaires') return <SousHoraires c={c} />
  if (sous === 'apparence') return <SousApparence c={c} />
  if (sous === 'liens') return <SousLiens c={c} />
  if (sous === 'avis') return <SousAvis c={c} />
  if (sous === 'relance') return <SousRelance c={c} />
  if (sous === 'profil') return <SousProfil c={c} />
  if (sous === 'abonnement') return <SousAbonnement c={c} />
  if (sous === 'guide') return <SousGuide c={c} />

  const { r } = etat
  const ouverts = r.horaires.filter(Boolean).length
  return (
    <>
      <Titre t="Plus" s="Ta page, tes réglages, ton abonnement" />
      <Section t="Ta page de réservation" premier>
        <LignePlus c={c} t="Prestations et prix" s={`Lavage complet à ${r.prixComplet} € · 4 types de véhicule`} val="prestations" />
        <LignePlus c={c} t="Promotions" s={etat.promo ? '−10 % en cours, jusqu’à dimanche' : 'Aucune promotion en cours'} val="promo" nouveau />
        <LignePlus c={c} t="Acompte" s={r.acompteOn ? `${r.acompte} % à la réservation · ${r.acLien}` : 'Désactivé'} val="acompte" nouveau />
        <LignePlus c={c} t="Carte de fidélité" s={`${r.fidReq} tampons · ${r.fidRec.toLowerCase()}`} val="fid" nouveau />
        <LignePlus c={c} t="Horaires" s={`${ouverts} jours ouverts · 8 h – 19 h`} val="horaires" />
        <LignePlus c={c} t="Apparence de ma page" s="Logo, couleur, photo de fond" val="apparence" />
        <LignePlus c={c} t="Mes liens" s="Un lien par réseau" val="liens" />
      </Section>
      <Section t="Automatismes">
        <LignePlus c={c} t="Avis Google" s={r.avis ? `${r.delai} h après chaque prestation · ${r.canal}` : 'Désactivés'} val="avis" />
        <LignePlus c={c} t="Relance client" s={r.relance ? `${r.relMois} mois sans rendez-vous · SMS` : 'Désactivée'} val="relance" />
      </Section>
      <Section t="Gestion">
        <LignePlus c={c} t="Devis et factures" s={`${tousDocs(etat).length} documents`} val="docs" />
        {dk ? null : <LignePlus c={c} t="Chiffres" s="Argent, acquisition, clients" val="chiffres" />}
      </Section>
      <Section t="Compte">
        <LignePlus c={c} t="Mon profil" s="Éclat Mobile · Julien Roussel" val="profil" />
        <LignePlus c={c} t="Abonnement" s="Pro · essai jusqu’au 14 novembre" val="abonnement" />
        <LignePlus c={c} t="Guide" s="Toutes les réponses, écran par écran" val="guide" />
      </Section>
    </>
  )
}
