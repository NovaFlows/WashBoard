import Link from 'next/link'
import { AppOrdinateur, AppTelephone } from './demo'
import { IcFleche } from './Icones'
import TitreRotatif from './TitreRotatif'

export default function Heros() {
  return (
    <section className="heros">
      <div className="w">
        <div>
          <TitreRotatif />
          <p className="chapo">Le logiciel des laveurs auto et du detailing à domicile. Tes clients réservent en ligne, ton agenda se remplit tout seul, tes factures partent dès que tu termines, et ta carte de fidélité les fait revenir.</p>
          <div className="heros-cta">
            <Link className="btn btn-accent" href="/signup">Essayer 1 mois gratuit</Link>
            <a className="btn btn-ligne" href="#demo">Manipuler la démo</a>
          </div>
          <p className="rassure">Sans carte bancaire. Ensuite, une offre gratuite sans limite de durée.</p>
          <div className="preuves"><span>Pensé pour le téléphone</span><span>Aussi sur ordinateur</span><span>S’installe comme une appli</span></div>
        </div>
        <div className="scene" role="group" aria-label="Aperçu de WashBoard sur ordinateur et sur téléphone">
          <div className="ecran-dk"><AppOrdinateur ecranInitial="agenda" /></div>
          <div className="scene-tel"><AppTelephone /></div>
          <p className="scene-legende"><span>Touche les onglets : tout fonctionne, avec des données fictives.</span><IcFleche /></p>
        </div>
      </div>
    </section>
  )
}
