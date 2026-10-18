import Navigation from './Navigation'
import PiedDePage from './PiedDePage'
import './base.css'
import './pages.css'

// Coquille commune des pages marketing (blog, métiers, comparatif, légal…) : mêmes jetons,
// navigation et pied que la landing. `etroit` enferme le contenu dans une colonne de lecture ;
// sinon la page gère elle-même ses sections pleine largeur.
export default function Coque({ children, etroit = false }: { children: React.ReactNode; etroit?: boolean }) {
  return (
    <div className="wb-vitrine" id="haut">
      <Navigation horsAccueil />
      <main id="main-content" className="pg">
        {etroit ? <div className="w pg-etroit">{children}</div> : children}
      </main>
      <PiedDePage horsAccueil />
    </div>
  )
}
