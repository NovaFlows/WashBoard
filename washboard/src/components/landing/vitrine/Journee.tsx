'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CommandesCarte } from '@/components/fidelite/CarteFidelite3D'
import { IcEtoile, IcFacture, IcItineraire, IcOk, IcPin, IcRaz, IcTel, Logo, Reseau } from './Icones'

// Sous la ligne de flottaison : la carte 3D n'est chargée qu'ici, côté client.
const CarteFidelite3D = dynamic(() => import('@/components/fidelite/CarteFidelite3D'), { ssr: false })

const ETAPES = [
  { h: '08:12', titre: 'Sophie réserve depuis ta bio Instagram', texte: 'Lavage complet, mardi à 14:00, 45 €. Elle a choisi son créneau seule, sans t’écrire.' },
  { h: '08:12', titre: 'Le rendez-vous est déjà dans ton agenda', texte: 'Une notification t’arrive. Rien à recopier, rien à confirmer par message.' },
  { h: '13:40', titre: 'Tu pars : l’adresse est là', texte: 'Itinéraire en un geste. La prestation et le prix viennent de sa réservation.' },
  { h: '15:10', titre: 'Terminé : la facture part, le tampon tombe', texte: 'C’est sa 3e visite, 135 € dépensés chez toi. Sa carte de fidélité avance d’une case.' },
  { h: '18:10', titre: 'Elle reçoit la demande d’avis Google', texte: 'Trois heures après, par SMS ou email. Tu n’as pas eu à y penser.' },
  { h: '+3 mois', titre: 'Pas revenue ? La relance part toute seule', texte: 'Un message au bon moment, et elle reprend rendez-vous sur ta page.' },
]
const HEURES_TEL = ['08:12', '08:13', '13:40', '15:10', '18:10', '10:01']
// L'étape 4 dure plus longtemps : la vraie carte 3D met ~3 s à se retourner avant de recevoir son tampon.
const DUREES = [3500, 3500, 3500, 5500, 3500, 3500]
const TAMPONS_AVANT = 2
const REQUIS = 8

function CarteEtape({ actif }: { actif: boolean }) {
  const ref = useRef<CommandesCarte>(null)
  const [tampons, setTampons] = useState(TAMPONS_AVANT)

  useEffect(() => {
    if (!actif) return
    const id = setTimeout(() => {
      setTampons(TAMPONS_AVANT + 1)
      ref.current?.tamponner(TAMPONS_AVANT, REQUIS)
    }, 650)
    return () => clearTimeout(id)
  }, [actif])

  return (
    <CarteFidelite3D
      ref={ref} couleur="#306090" finition="holo" nom="Éclat Mobile" numero="4F2A"
      requis={REQUIS} tampons={tampons} recompense="Lavage complet offert" scenario="apercu" largeur={250}
    />
  )
}

export default function Journee() {
  const [etape, setEtape] = useState(0)
  const [tour, setTour] = useState(0)
  const [visible, setVisible] = useState(false)
  const bloc = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cible = bloc.current
    if (!cible) return
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 })
    obs.observe(cible)
    return () => obs.disconnect()
  }, [])

  const enMarche = visible
  useEffect(() => {
    if (!enMarche || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setTimeout(() => setEtape(e => (e + 1) % ETAPES.length), DUREES[etape])
    return () => clearTimeout(id)
  }, [enMarche, etape, tour])

  const aller = useCallback((n: number) => { setEtape(n); setTour(t => t + 1) }, [])

  // La carte 3D n'existe que sur l'étape 4 (et le temps de son fondu) : elle rejoue son intro à chaque passage.
  const carte = etape === 3 || etape === 4

  // La scène active est remontée à chaque clic (clé = tour) : ses animations repartent de zéro,
  // même quand on reclique sur l'étape déjà affichée.
  const scene = (n: number, classe: string, contenu: React.ReactNode, remonter = true) => (
    <div className={`h-sc ${classe}${etape === n ? ' on' : ''}`} aria-hidden={etape !== n}>
      {remonter ? <div style={{ display: 'contents' }} key={etape === n ? `on-${tour}` : 'off'}>{contenu}</div> : contenu}
    </div>
  )

  return (
    <section className="section" id="journee">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Une journée avec WashBoard</p>
        <h2 className="h2">De la réservation à la fidélisation. <span className="doux">Sans rien recopier.</span></h2>
        <p className="chapo">Sophie a trouvé Éclat Mobile sur Instagram. Voici tout ce qui se passe ensuite, et tout ce que tu n’as plus à faire.</p>
        <div className={`histoire${enMarche ? '' : ' pause'}`} ref={bloc}>
          <div>
            <ol className="h-etapes">
              {ETAPES.map((e, k) => (
                <li key={e.titre}>
                  <button type="button" aria-current={etape === k ? 'step' : undefined} onClick={() => aller(k)}>
                    <span className="hh">{e.h}</span>
                    <span><b>{e.titre}</b><span className="texte">{e.texte}</span></span>
                    {etape === k && <span className="prog" key={tour} style={{ '--duree': `${DUREES[k]}ms` } as React.CSSProperties} />}
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="h-raz" onClick={() => aller(0)}><IcRaz />Remettre la journée à zéro</button>
          </div>
          <div className="aura h-scene">
            <div className="tel">
              <div className={`tel-ecran${etape === 0 ? ' clair' : ''}`}>
                <div className="ilot" />
                <div className="etat"><span className="num">{HEURES_TEL[etape]}</span><Reseau /></div>

                {scene(0, 'verrou', <>
                  <div className="v-heure num">08:12</div>
                  <div className="v-date">Mardi 14 octobre</div>
                  <div className="notif">
                    <Logo />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="n-t"><b>WashBoard</b><span>maintenant</span></div>
                      <b>Nouvelle réservation</b>
                      <p>Sophie B. · Lavage complet · mar. 14:00 · 45 €</p>
                    </div>
                  </div>
                </>)}

                {scene(1, '', <>
                  <div className="ecr-tete"><div><p className="ecr-titre">Mardi 14</p><p className="ecr-sous">3 rendez-vous · 155 €</p></div></div>
                  <div className="creneau"><div className="t"><b>09:30</b><small>10:15</small></div><span className="barre-c" style={{ background: 'var(--vert)' }} /><div className="surf carte-c"><div className="r"><span className="nom">Karim B.</span><span className="prix num">45 €</span></div><div className="det">Intérieur</div></div></div>
                  <div className="creneau"><div className="t"><b>14:00</b><small>15:30</small></div><span className="barre-c" style={{ background: 'var(--vert)' }} /><div className="surf carte-c neuf"><div className="r"><span className="nom">Sophie B.</span><span className="prix num">45 €</span></div><div className="det">Lavage complet · Citadine</div><div className="bas"><span>Instagram</span><span className="st st-vert">Nouveau</span></div></div></div>
                  <div className="creneau"><div className="t"><b>16:30</b><small>17:30</small></div><span className="barre-c" style={{ background: 'var(--vert)' }} /><div className="surf carte-c"><div className="r"><span className="nom">Lucas B.</span><span className="prix num">65 €</span></div><div className="det">Lavage complet</div></div></div>
                  <div className="mini-n" style={{ marginTop: 'auto' }}><Logo /><div><b>Nouvelle réservation</b><br />Sophie B. vient de réserver depuis Instagram.</div></div>
                </>)}

                {scene(2, '', <>
                  <div className="ecr-tete"><div><p className="ecr-titre">Mardi 14 octobre</p><p className="ecr-sous">Prochain rendez-vous dans 20 min</p></div></div>
                  <div className="surf prochain">
                    <div className="haut"><span className="heure">14:00</span><div className="qui"><b>Sophie B.</b><span className="det" style={{ color: 'var(--gris)', fontSize: 13 }}>Lavage complet</span><div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}><span className="st st-vert">Confirmé</span><b className="num" style={{ fontWeight: 550 }}>45 €</b></div></div></div>
                    <div className="adr"><IcPin /><span>5 rue Sainte-Catherine, Bordeaux</span></div>
                    <div className="duo"><span className="btn btn-accent pulse"><IcItineraire />Itinéraire</span><span className="btn btn-ligne"><IcTel />Appeler</span></div>
                  </div>
                  <div className="sec-lib"><span>Sa fiche</span></div>
                  <div className="surf"><div className="ligne"><span className="corps"><span className="nom">3e visite</span><span className="det">Dernière fois : lavage complet en juillet</span></span><span className="prix">90 €</span></div></div>
                </>)}

                {scene(3, '', <>
                  <div className="ecr-tete"><div><p className="ecr-titre">Terminé</p><p className="ecr-sous">Sophie B. · 45 € encaissés</p></div><span className="rond plein" style={{ background: 'var(--vert)' }}><IcOk /></span></div>
                  <div className="h-ok"><IcFacture />Facture F-00044 créée</div>
                  <div className="sec-lib"><span>Sa carte de fidélité</span><span>3 / 8</span></div>
                  <div style={{ margin: '-14px -6px -30px', minHeight: 190 }}>{carte && <CarteEtape key={tour} actif={etape === 3} />}</div>
                  <div className="mini-n" style={{ marginTop: 14 }}><Logo /><div>Sophie reçoit « Votre tampon est arrivé » par email.</div></div>
                </>, false)}

                {scene(4, 'sms', <>
                  <div className="sms-tete"><span className="av">ÉM</span><b>Éclat Mobile</b>Aujourd’hui 18:10</div>
                  <div className="bul g">Merci Sophie pour votre confiance ! Si vous avez 30 secondes, votre avis nous aide beaucoup : <u>g.page/eclat-mobile</u></div>
                  <div className="bul d" style={{ animationDelay: '.5s' }}>Avec plaisir, c’est fait !</div>
                  <div className="avis-c" style={{ animationDelay: '.9s' }}>
                    <b>Sophie B.</b> · Avis Google
                    <div className="etoiles">{[0, 1, 2, 3, 4].map(k => <IcEtoile key={k} delai={1.1 + k * 0.12} />)}</div>
                    Voiture comme neuve, ponctuel et très soigneux. Je recommande.
                  </div>
                </>)}

                {scene(5, 'sms', <>
                  <div className="sms-tete"><span className="av">ÉM</span><b>Éclat Mobile</b>14 janvier · 10:00</div>
                  <div className="bul g">Bonjour Sophie, ça fait 3 mois depuis votre dernier lavage. Un créneau cette semaine ? Réservez en 1 minute : <u>washboard.fr/book/eclat-mobile</u></div>
                  <div className="bul d" style={{ animationDelay: '.6s' }}>Oh oui, je réserve pour samedi !</div>
                  <div className="mini-n" style={{ animationDelay: '1.1s', marginTop: 'auto' }}><Logo /><div><b>Nouvelle réservation</b><br />Sophie B. · samedi 10:00 · 4e visite</div></div>
                </>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
