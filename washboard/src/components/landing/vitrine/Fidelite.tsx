import FideliteDemo from './FideliteDemo'

const POINTS = [
  { fort: 'Un tampon par prestation, ', doux: 'ou un par véhicule si tu préfères.' },
  { fort: 'Prestation offerte, remise en % ou en € : ', doux: 'options et déplacement offerts au choix.' },
  { fort: 'Ton client reçoit « Votre tampon est arrivé » ', doux: 'par email, avec sa carte.' },
  { fort: 'Incluse dès l’offre gratuite.', doux: '' },
]

export default function Fidelite() {
  return (
    <section className="section" id="fidelite">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Carte de fidélité <span className="badge badge-new">Nouveau</span></p>
        <h2 className="h2">La carte qu’on a envie de remplir.</h2>
        <FideliteDemo
          avant={<p className="chapo" style={{ marginTop: 0 }}>Un tampon à chaque prestation terminée. Au bout, la récompense que tu as choisie s’applique toute seule à la réservation suivante.</p>}
          apres={
            <ul className="fid-liste">
              {POINTS.map(p => <li key={p.fort}><div>{p.fort}{p.doux && <span>{p.doux}</span>}</div></li>)}
            </ul>
          }
        />
      </div>
    </section>
  )
}
