import { ReservationClient } from './demo'

const POINTS = [
  { n: '01', titre: 'Sans compte, sans appli', texte: 'Il choisit son véhicule et sa prestation, le prix s’affiche tout de suite. Citadine, SUV, utilitaire : chacun son tarif.' },
  { n: '02', titre: 'Les créneaux près de chez toi d’abord', texte: 'Si tu as déjà un rendez-vous dans son quartier ce jour-là, les horaires juste avant ou après ressortent, avec ta remise s’il en profite.' },
  { n: '03', titre: 'Un acompte si tu veux', texte: 'Payé par ton propre lien (PayPal, Stripe, SumUp, Lydia, Wero ou virement). Pas réglé à temps : le créneau se libère tout seul.' },
  { n: '04', titre: 'Sa carte de fidélité, dès la réservation', texte: 'Il voit ce qui l’attend au bout. Active une promotion dans la démo du dessus : le bandeau apparaît ici.' },
]

export default function CoteClient() {
  return (
    <section className="section" id="reservation">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Page de réservation</p>
        <h2 className="h2">Ce que voit ton client. <span className="doux">Trois écrans, zéro message.</span></h2>
        <div className="cote">
          <div>
            <div className="points">
              {POINTS.map(p => (
                <div className="point" key={p.n}>
                  <span className="n">{p.n}</span>
                  <div><b>{p.titre}</b><p>{p.texte}</p></div>
                </div>
              ))}
            </div>
            {/* Texte, pas un lien : washboard.fr/book/ton-nom n'est qu'un exemple de lien de laveur. */}
            <p className="url-note">Chaque laveur a son propre lien, par exemple <b>washboard.fr/book/ton-nom</b>, à mettre en bio Instagram, sur TikTok ou sur sa fiche Google.</p>
          </div>
          <div className="aura"><ReservationClient /></div>
        </div>
      </div>
    </section>
  )
}
