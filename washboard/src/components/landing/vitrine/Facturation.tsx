import { requiredPlanLabel } from '@/lib/plan'
import FacturationDemo from './FacturationDemo'

const POINTS = [
  { fort: 'Conforme : SIRET, régime de TVA, mentions obligatoires, ', doux: 'numérotation continue que tu peux reprendre là où tu en étais.' },
  { fort: 'Envoyée par email à tes clients pros. ', doux: 'Un particulier la retrouve depuis son lien de confirmation.' },
  { fort: 'Un devis en un geste, ', doux: 'transformé en facture d’un tap une fois accepté.' },
  { fort: 'Tes anciennes factures importées, ', doux: 'en PDF, en photo ou en ZIP, jusqu’à 200 d’un coup.' },
]

export default function Facturation() {
  return (
    <section className="section" id="facture">
      <div className="w">
        <p className="sur-titre"><span className="pt" />Facturation <span className="badge">{requiredPlanLabel('facturation')}</span></p>
        <h2 className="h2">Ta facture est prête <span className="doux">avant que tu remontes en voiture.</span></h2>
        <div className="fac">
          <div>
            <p className="chapo" style={{ marginTop: 0 }}>Tu marques le rendez-vous « Terminé » : WashBoard émet la facture avec tes mentions et son numéro. Rien à retaper le soir, rien à oublier.</p>
            <ul className="fid-liste">
              {POINTS.map(p => <li key={p.fort}><div>{p.fort}<span>{p.doux}</span></div></li>)}
            </ul>
          </div>
          <div className="fac-demo aura"><FacturationDemo /></div>
        </div>
      </div>
    </section>
  )
}
